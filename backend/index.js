// =================================================================
//                     IMPORTS Y CONFIGURACIÓN INICIAL
// =================================================================
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { execFile } = require('child_process'); // <-- AÑADIDO: Para ejecutar comandos externos
require('dotenv').config();

const app = express();
const port = 3000;

// =================================================================
//                           MIDDLEWARES
// =================================================================
app.use(cors());
app.use(express.json());

// =================================================================
//                         CONEXIÓN A MONGODB
// =================================================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Conectado a MongoDB Atlas"))
    .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));

// =================================================================
//                   ESQUEMA Y MODELO DE MONGODB
// (Se usa para guardar los resultados y tener un historial)
// =================================================================
const ClimateDaySchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    variable: { type: String, required: true, enum: ["calido", "frio", "humedo", "ventoso", "incomodo", "polvo"] },
    probability: { type: Number, required: true },
    historicalMean: { type: Number, required: true },
    threshold: { type: Number, required: true },
    unit: { type: String, required: true },
    detailDescription: { type: String },
    downloadLink: { type: String },
}, { timestamps: true });

ClimateDaySchema.index({ day: 1, month: 1, lat: 1, lon: 1, variable: 1 });
const ClimateDay = mongoose.model("ClimateDay", ClimateDaySchema);

// =================================================================
//           CONFIGURACIÓN DE LA API Y VARIABLES DE NASA
// =================================================================
const MERRA2_SLV_URL = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/MERRA2/M2T1NXSLV.5.12.4/1980/MERRA2_100.tavg1_2d_slv_Nx.19800101.nc4";
const MERRA2_AER_URL = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/MERRA2/M2T1NXAER.5.12.4/1980/MERRA2_100.tavg1_2d_aer_Nx.19800101.nc4";

const CONFIG_VARIABLES_NASA = {
    calido: {
        apiVariable: "T2M",
        datasetUrl: MERRA2_SLV_URL,
        unit: "K",
        // El umbral se define como el percentil 90 histórico para ese día.
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false, // Es peor si está POR ENCIMA del umbral.
    },
    frio: {
        apiVariable: "T2M",
        datasetUrl: MERRA2_SLV_URL,
        unit: "K",
        // El umbral se define como el percentil 10 histórico.
        threshold: (stats) => stats.p10,
        isBelowThresholdWorse: true, // Es peor si está POR DEBAJO del umbral.
    },
    ventoso: {
        // Esta es una variable compuesta
        apiVariable: ["U10M", "V10M"],
        datasetUrl: MERRA2_SLV_URL,
        unit: "m/s",
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    polvo: {
        apiVariable: "DUEXTTAU",
        datasetUrl: MERRA2_AER_URL,
        unit: "1 (sin dimensión)",
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    // NOTA: "húmedo" e "incómodo" requieren datasets diferentes o cálculos más complejos
    // que se pueden añadir más tarde. Se omiten por ahora para centrarse en MERRA-2.
};

// =================================================================
//        MANEJO DE AUTENTICACIÓN Y CACHÉ DE COORDENADAS
// =================================================================
const coordinateCache = new Map();

// =================================================================
//                      FUNCIONES HELPERS
// =================================================================

/**
 * Realiza una petición GET usando curl.exe para evitar problemas de autenticación de axios.
 * @param {string} url - La URL a la que se hará la petición.
 * @param {boolean} isJson - Si se espera una respuesta JSON (texto) o binaria.
 * @returns {Promise<Buffer|object>} - Los datos de la respuesta.
 */
function fetchWithCurl(url, isJson = false) {
    return new Promise((resolve, reject) => {
        // -n: usa _netrc; -L: sigue redirecciones; -k: ignora errores de certificado.
        // -c y -b: usan un archivo de cookies para mantener la sesión a través de las redirecciones.
        const cookieFile = 'nasa-cookies.txt';
        const args = ['-n', '-L', '-k', '-c', cookieFile, '-b', cookieFile, url];
        const options = { encoding: isJson ? 'utf8' : 'buffer', maxBuffer: 1024 * 1024 * 50 };

        execFile('curl.exe', args, options, (error, stdout, stderr) => {
            if (error) {
                // Limpiamos el mensaje de error para que sea más legible.
                const cleanStderr = stderr.toString().split('\n').filter(line => !line.startsWith('  % Total')).join('\n');
                return reject(new Error(`Fallo en curl: ${cleanStderr || error.message}`));
            }
            resolve(isJson ? JSON.parse(stdout) : stdout);
        });
    });
}

/**
 * Encuentra el índice del valor más cercano en un array.
 * @param {number} target El valor a buscar (ej. latitud del usuario).
 * @param {number[]} arr El array de coordenadas del dataset.
 * @returns {number} El índice del valor más cercano.
 */
function findClosestIndex(target, arr) {
    let closestIndex = 0;
    let minDiff = Math.abs(target - arr[0]);
    for (let i = 1; i < arr.length; i++) {
        const diff = Math.abs(target - arr[i]);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
        }
    }
    return closestIndex;
}

/**
 * Obtiene las coordenadas (lat, lon) de un dataset y las guarda en caché.
 * @param {string} datasetUrl La URL base del dataset de OPeNDAP.
 * @returns {Promise<{lats: number[], lons: number[]}>}
 */
async function getCoordinates(datasetUrl) {
    if (coordinateCache.has(datasetUrl)) {
        console.log(`[Cache] Coordenadas obtenidas de la caché para ${datasetUrl.slice(-20)}`);
        return coordinateCache.get(datasetUrl);
    }

    console.log(`[NASA API] Obteniendo coordenadas para ${datasetUrl.slice(-20)}`);
    const coordUrl = `${datasetUrl}.dods?lat,lon`;
    const buffer = await fetchWithCurl(coordUrl, false);

    // La respuesta .dods es texto, necesitamos parsearlo para extraer los datos.
    const text = buffer.toString();
    const latMatch = text.match(/Float64 lat\[lat = (\d+)\];\s*([\s\S]*?)Float64 lon/);
    const lonMatch = text.match(/Float64 lon\[lon = (\d+)\];\s*([\s\S]*?)Data:/);

    if (!latMatch || !lonMatch) throw new Error("No se pudieron parsear las coordenadas del dataset.");
    
    const lats = latMatch[2].split(',').map(Number);
    const lons = lonMatch[2].split(',').map(Number);

    const coords = { lats, lons };
    coordinateCache.set(datasetUrl, coords);
    return coords;
}

/**
 * Calcula estadísticas para un día específico a partir de una serie de tiempo completa.
 * @param {number[]} timeSeries - Array de valores de la variable (ej. temperaturas).
 * @param {number[]} timeValues - Array de valores de tiempo (minutos desde 1980-01-01).
 * @param {number} day - Día del mes (1-31).
 * @param {number} month - Mes del año (1-12).
 * @returns {object} Objeto con media, p10, p90 y valores del día.
 */
function calculateStatistics(timeSeries, timeValues, day, month) {
    const baseDate = new Date('1980-01-01T00:30:00Z');
    const dailyValues = [];

    for (let i = 0; i < timeValues.length; i++) {
        const currentDate = new Date(baseDate.getTime() + timeValues[i] * 60000);
        if (currentDate.getUTCMonth() + 1 === month && currentDate.getUTCDate() === day) {
            if (isFinite(timeSeries[i])) { // Asegurarse de que no es NaN o Infinity
                dailyValues.push(timeSeries[i]);
            }
        }
    }

    if (dailyValues.length === 0) {
        throw new Error(`No se encontraron datos históricos para la fecha ${day}/${month}.`);
    }

    dailyValues.sort((a, b) => a - b);
    const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
    const p10 = dailyValues[Math.floor(dailyValues.length * 0.10)];
    const p90 = dailyValues[Math.floor(dailyValues.length * 0.90)];

    return { mean, p10, p90, values: dailyValues };
}

// =================================================================
//                 RUTA PRINCIPAL DE LA API
// =================================================================
app.post("/api/climate-probability", async (req, res) => {
    const { lat, lon, day, month, variable } = req.body;

    try {
        const config = CONFIG_VARIABLES_NASA[variable];
        if (!config) {
            return res.status(400).json({ success: false, message: `Variable '${variable}' no soportada.` });
        }
        
        console.log(`\n[Request] Procesando: ${variable} para ${day}/${month} en (Lat:${lat}, Lon:${lon})`);

        // 1. Obtener coordenadas y encontrar índices
        const { lats, lons } = await getCoordinates(config.datasetUrl);
        const latIndex = findClosestIndex(lat, lats);
        const lonIndex = findClosestIndex(lon, lons);
        console.log(`[Index] Índices encontrados -> Lat: ${latIndex}, Lon: ${lonIndex}`);

        // 2. Obtener la serie de tiempo de la(s) variable(s)
        let timeSeries;
        const timeUrl = `${config.datasetUrl}.json?time`;
        const timeResponse = await fetchWithCurl(timeUrl, true);
        const timeValues = timeResponse.time;
        
        if (Array.isArray(config.apiVariable)) { // Caso especial para 'ventoso'
            console.log(`[NASA API] Obteniendo series para ${config.apiVariable.join(', ')}...`);
            const [u10mUrl, v10mUrl] = config.apiVariable.map(v => 
                `${config.datasetUrl}.json?${v}[0:1:${timeValues.length-1}][${latIndex}][${lonIndex}]`
            );
            const [u10mResponse, v10mResponse] = await Promise.all([ fetchWithCurl(u10mUrl, true), fetchWithCurl(v10mUrl, true) ]);
            const u10mValues = u10mResponse[config.apiVariable[0]];
            const v10mValues = v10mResponse[config.apiVariable[1]];
            // Calcular la magnitud del vector del viento
            timeSeries = u10mValues.map((u, i) => Math.sqrt(u*u + v10mValues[i]*v10mValues[i]));
        } else {
            console.log(`[NASA API] Obteniendo serie para ${config.apiVariable}...`);
            const dataUrl = `${config.datasetUrl}.json?${config.apiVariable}[0:1:${timeValues.length-1}][${latIndex}][${lonIndex}]`;
            const dataResponse = await fetchWithCurl(dataUrl, true);
            timeSeries = dataResponse[config.apiVariable];
        }

        // 3. Calcular estadísticas históricas para el día solicitado
        const stats = calculateStatistics(timeSeries, timeValues, parseInt(day), parseInt(month));
        const thresholdValue = config.threshold(stats);

        // 4. Calcular la probabilidad
        let adverseDays = 0;
        if (config.isBelowThresholdWorse) {
            adverseDays = stats.values.filter(v => v < thresholdValue).length;
        } else {
            adverseDays = stats.values.filter(v => v > thresholdValue).length;
        }
        const probability = Math.round((adverseDays / stats.values.length) * 100);

        // 5. Formatear y enviar respuesta
        const result = {
            success: true,
            location: `(Lat: ${lats[latIndex].toFixed(2)}, Lon: ${lons[lonIndex].toFixed(2)})`,
            date: `${day}/${month}`,
            variable: variable,
            probability: probability,
            historicalMean: parseFloat(stats.mean.toFixed(2)),
            threshold: parseFloat(thresholdValue.toFixed(2)),
            unit: config.unit,
            detailDescription: `Probabilidad del ${probability}% de que la condición '${variable}' exceda el umbral histórico (${parseFloat(thresholdValue.toFixed(2))} ${config.unit}) para esta fecha y ubicación, basado en datos de 1980-presente.`,
            downloadLink: config.datasetUrl
        };
        
        // 6. Guardar en DB (opcional, pero bueno para caché)
        try {
            const record = new ClimateDay({ ...result, lat, lon, day, month });
            await record.save();
            console.log("[DB] Resultado guardado en la base de datos.");
        } catch (dbError) {
            console.error("[DB] Error al guardar el resultado:", dbError.message);
        }

        res.json(result);

    } catch (error) {
        console.error("❌ ERROR FATAL EN LA RUTA API:", error.message);
        if (error.response?.status === 401) {
           return res.status(401).json({ success: false, message: "Error de NASA API: 401 No autorizado. Revisa tus credenciales en el archivo .env" });
        }
        res.status(500).json({ success: false, message: "Error interno del servidor.", error: error.message });
    }
});


// =================================================================
//              RUTAS ADICIONALES Y ARRANQUE DEL SERVIDOR
// =================================================================
app.get("/", (req, res) => {
    res.send("Servidor AstroCast API (OPeNDAP) está funcionando.");
});

app.listen(port, () => {
    console.log(`\n🚀 Servidor de API de AstroCast corriendo en http://localhost:${port}`);
    console.log(`   Asegúrate de que tus variables de entorno (.env) están configuradas.`);
    console.log(`   ¡No olvides ejecutar 'npm run dev' en otra terminal para el frontend!\n`);
});