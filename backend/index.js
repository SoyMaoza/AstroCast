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

// --- MEJORA: Nuevo esquema para cachear las estadísticas históricas calculadas ---
const HistoricalStatSchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    latIndex: { type: Number, required: true },
    lonIndex: { type: Number, required: true },
    variable: { type: String, required: true },
    mean: { type: Number, required: true },
    p10: { type: Number, required: true },
    p90: { type: Number, required: true },
    stdDev: { type: Number, required: true }, // <-- AÑADIDO: Guardaremos la desviación estándar
}, { timestamps: true });
HistoricalStatSchema.index({ day: 1, month: 1, latIndex: 1, lonIndex: 1, variable: 1 });
const HistoricalStat = mongoose.model("HistoricalStat", HistoricalStatSchema);

// =================================================================
//           CONFIGURACIÓN DE LA API Y VARIABLES DE NASA
// =================================================================
// --- CORRECCIÓN: URLs base actualizadas para usar la estructura /hyrax/ y ser dinámicas ---
// Se usarán como plantillas para construir la URL final.
const MERRA2_SLV_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXSLV.5.12.4";
const MERRA2_AER_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXAER.5.12.4";


const CONFIG_VARIABLES_NASA = {
    calido: {
        apiVariable: "T2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "K",
        // NUEVO UMBRAL: La media más 1.5 desviaciones estándar.
        threshold: (stats) => stats.mean + 1.5 * stats.stdDev,
        isBelowThresholdWorse: false, // Es peor si está POR ENCIMA del umbral.
    },
    frio: {
        apiVariable: "T2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "K",
        // NUEVO UMBRAL: La media menos 1.5 desviaciones estándar.
        threshold: (stats) => stats.mean - 1.5 * stats.stdDev,
        isBelowThresholdWorse: true, // Es peor si está POR DEBAJO del umbral.
    },
    ventoso: {
        // Esta es una variable compuesta
        apiVariable: ["U10M", "V10M"],
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "m/s",
        threshold: (stats) => stats.mean + 1.5 * stats.stdDev, // Umbral basado en la media
        isBelowThresholdWorse: false,
    },
    polvo: {
        apiVariable: "DUEXTTAU",
        datasetUrlTemplate: MERRA2_AER_URL_TEMPLATE,
        unit: "1 (sin dimensión)",
        threshold: (stats) => stats.mean + 2.0 * stats.stdDev, // Para polvo, un umbral más extremo
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
        // --netrc-file: especifica la ruta al archivo de credenciales.
        // -c y -b: usan un archivo de cookies para mantener la sesión.
        // Usamos path.join para construir rutas absolutas y evitar problemas.
        const path = require('path');
        const cookieFile = path.join(__dirname, 'nasa-cookies.txt');
        const netrcFile = path.join(process.env.USERPROFILE, '_netrc');
        const args = ['-L', '-k', '--netrc-file', netrcFile, '-c', cookieFile, '-b', cookieFile, url];
        const options = { encoding: isJson ? 'utf8' : 'buffer', maxBuffer: 1024 * 1024 * 50 };

        execFile('curl.exe', args, options, (error, stdout, stderr) => {
            if (error) {
                // Limpiamos el mensaje de error para que sea más legible.
                const cleanStderr = stderr.toString().split('\n').filter(line => !line.startsWith('  % Total')).join('\n');
                return reject(new Error(`Fallo en curl: ${cleanStderr || error.message}`));
            }

            if (isJson) {
                try {
                    resolve(JSON.parse(stdout));
                } catch (jsonError) {
                    // Check if the output looks like HTML, which often indicates an authentication issue
                    if (stdout.trim().startsWith('<!DOCTYPE html')) {
                        console.error("DEBUG: Curl output was HTML, likely an authentication or server error. First 500 chars:", stdout.slice(0, 500) + "...");
                        return reject(new Error(`Error de parseo JSON: La respuesta de la API de NASA no es JSON válido. Parece ser una página HTML (posiblemente de login o error). Por favor, verifica tus credenciales de Earthdata Login en el archivo .netrc.`));
                    }
                    return reject(new Error(`Error de parseo JSON: ${jsonError.message}. Respuesta recibida: ${stdout.slice(0, 200)}...`));
                }
            } else {
                resolve(stdout);
            }
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
    // --- MEJORA: Usar la respuesta .json en lugar de .dods para evitar parseo manual ---
    const coordUrl = `${datasetUrl}.json?lat,lon`;
    const coordResponse = await fetchWithCurl(coordUrl, true); // true para que parsee como JSON

    // --- CORRECCIÓN: La API de NASA devuelve las coordenadas dentro de un array 'leaves' ---
    const latLeaf = coordResponse.leaves?.find(leaf => leaf.name === 'lat');
    const lonLeaf = coordResponse.leaves?.find(leaf => leaf.name === 'lon');

    if (!latLeaf || !lonLeaf || !latLeaf.data || !lonLeaf.data) {
        console.error("[DEBUG] Estructura de respuesta de coordenadas inesperada:", JSON.stringify(coordResponse, null, 2));
        throw new Error("No se pudieron obtener las coordenadas del dataset en formato JSON.");
    }

    const lats = latLeaf.data;
    const lons = lonLeaf.data;

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

/**
 * --- NUEVA FUNCIÓN AUXILIAR ---
 * Determina el prefijo correcto del archivo MERRA-2 (`100`, `200`, `300`, `400`) basado en el año.
 * @param {number} year - El año a consultar.
 * @returns {string} - El prefijo del dataset (ej. "100", "200").
 */
function getMerra2FilePrefix(year) {
    if (year >= 2011) return "400";
    if (year >= 2001) return "300"; // El cambio a 300 ocurre en 2001
    if (year >= 1992) return "200";
    if (year >= 1980) return "100";
    // Por si acaso se usa un año fuera de rango
    return "400";
}

/**
 * --- NUEVA FUNCIÓN PRINCIPAL ---
 * Obtiene y calcula las estadísticas históricas para un punto y fecha específicos,
 * iterando a través de todos los años disponibles. Usa una caché en la BD para evitar
 * recalcular.
 * @param {object} config - La configuración de la variable.
 * @param {number} day - Día del mes.
 * @param {number} month - Mes del año.
 * @param {number} latIndex - Índice de la latitud.
 * @param {number} lonIndex - Índice de la longitud.
 * @returns {Promise<object>} - Objeto con { mean, p10, p90, values }.
 */
async function getHistoricalStatistics(config, day, month, latIndex, lonIndex) {
    const variableName = Array.isArray(config.apiVariable) ? 'ventoso' : config.apiVariable;

    // 1. Revisar la caché de estadísticas en la BD
    const cachedStat = await HistoricalStat.findOne({ day, month, latIndex, lonIndex, variable: variableName });
    if (cachedStat) {
        console.log(`[Cache-Stats] Estadísticas históricas encontradas en la BD para ${day}/${month} en índices ${latIndex},${lonIndex}`);
        // Devolvemos las estadísticas cacheadas. El cálculo de probabilidad se hará con estos datos.
        return { mean: cachedStat.mean, p10: cachedStat.p10, p90: cachedStat.p90, stdDev: cachedStat.stdDev, fromCache: true };
    }

    console.log(`[NASA API] Calculando estadísticas históricas para ${day}/${month}. Esto puede tardar...`);

    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const allHistoricalValues = [];

    // 2. Iterar por todos los años disponibles (1980-2016 para esta colección)
    const startYear = 1980;
    const endYear = 2020; // <-- CORRECCIÓN: Usar el rango estable y consistente (1980-2020) para evitar 404s en años recientes.
    const yearPromises = [];

    for (let year = startYear; year <= endYear; year++) {
        const filePrefix = getMerra2FilePrefix(year); // <-- Usamos la nueva función
        const datasetType = config.datasetUrlTemplate.includes('AER') ? 'aer' : 'slv';
        const datasetFileName = `MERRA2_${filePrefix}.tavg1_2d_${datasetType}_Nx.${year}${monthStr}${dayStr}.nc4`;
        const baseDatasetUrl = `${config.datasetUrlTemplate}/${year}/${monthStr}/${datasetFileName}`;

        // Función para obtener los datos de un año
        const fetchYearData = async (currentUrl) => {
            try {
                if (Array.isArray(config.apiVariable)) { // Caso 'ventoso'
                    const [u10mUrl, v10mUrl] = config.apiVariable.map(v => encodeURI(`${currentUrl}.json?${v}[0:1:23][${latIndex}][${lonIndex}]`)); // El currentUrl ya es correcto
                    const [u10mResponse, v10mResponse] = await Promise.all([fetchWithCurl(u10mUrl, true), fetchWithCurl(v10mUrl, true)]);
                    const u10mLeaf = u10mResponse.nodes?.[0]?.leaves?.find(l => l.name === config.apiVariable[0]);
                    const v10mLeaf = v10mResponse.nodes?.[0]?.leaves?.find(l => l.name === config.apiVariable[1]);
                    if (!u10mLeaf?.data || !v10mLeaf?.data) return [];
                    const u10mValues = u10mLeaf.data.flat(Infinity);
                    const v10mValues = v10mLeaf.data.flat(Infinity);
                    const windData = u10mValues.map((u, i) => Math.sqrt(u * u + v10mValues[i] * v10mValues[i]));
                    console.log(`[NASA API] Descarga para el año ${year} completada.`);
                    return windData;
                } else { // Caso de variable simple
                    const dataUrl = encodeURI(`${currentUrl}.json?${config.apiVariable}[0:1:23][${latIndex}][${lonIndex}]`);
                    const dataResponse = await fetchWithCurl(dataUrl, true);
                    const dataLeaf = dataResponse.nodes?.[0]?.leaves?.find(l => l.name === config.apiVariable);
                    if (!dataLeaf?.data) return [];
                    const simpleData = dataLeaf.data.flat(Infinity);
                    console.log(`[NASA API] Descarga para el año ${year} completada.`);
                    return simpleData;
                }
            } catch (e) {
                // Si un año falla (ej. archivo no existe), lo ignoramos y continuamos.
                console.warn(`[WARN] No se pudieron obtener datos para el año ${year}. Saltando...`);
                return [];
            }
        };
        yearPromises.push(fetchYearData(baseDatasetUrl));
    }

    // 3. Ejecutar todas las peticiones en paralelo y recolectar los datos
    const yearlyData = await Promise.all(yearPromises);
    yearlyData.forEach(values => allHistoricalValues.push(...values.filter(isFinite)));

    if (allHistoricalValues.length === 0) {
        throw new Error(`No se encontraron datos históricos válidos para la fecha ${day}/${month} en todos los años consultados.`);
    }

    // 4. Calcular estadísticas sobre el conjunto de datos completo
    allHistoricalValues.sort((a, b) => a - b);
    const mean = allHistoricalValues.reduce((a, b) => a + b, 0) / allHistoricalValues.length;
    const p10 = allHistoricalValues[Math.floor(allHistoricalValues.length * 0.10)];
    const p90 = allHistoricalValues[Math.floor(allHistoricalValues.length * 0.90)];
    // --- NUEVO CÁLCULO: Desviación Estándar ---
    const variance = allHistoricalValues.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (allHistoricalValues.length - 1);
    const stdDev = Math.sqrt(variance);

    const stats = { mean, p10, p90, stdDev, values: allHistoricalValues };

    // 5. Guardar las nuevas estadísticas en la caché de la BD
    try {
        const newStat = new HistoricalStat({
            day, month, latIndex, lonIndex, variable: variableName,
            mean: stats.mean, p10: stats.p10, p90: stats.p90, stdDev: stats.stdDev
        });
        await newStat.save();
        console.log(`[Cache-Stats] Nuevas estadísticas guardadas en la BD.`);
    } catch (dbError) {
        console.error("[Cache-Stats] Error al guardar estadísticas en la BD:", dbError.message);
    }

    return stats;
}

// =================================================================
//                 RUTA PRINCIPAL DE LA API
// =================================================================
app.post("/api/climate-probability", async (req, res) => {
    const { lat, lon, day, month, variable } = req.body;
    const HISTORICAL_RANGE = "1980-2020"; // Rango de años para mostrar en la descripción

    // --- MEJORA: Implementar lógica de caché con la base de datos ---
    try {
        const cachedResult = await ClimateDay.findOne({ lat, lon, day, month, variable });
        if (cachedResult) {
            console.log(`[Cache] Resultado encontrado en la base de datos para ${variable} en (Lat:${lat}, Lon:${lon})`);
            return res.json(cachedResult); // Devuelve el resultado cacheado y termina la ejecución.
        }
    } catch (cacheError) {
        console.error("[Cache] Error al buscar en la caché de la base de datos:", cacheError.message);
    }

    try {
        const config = CONFIG_VARIABLES_NASA[variable];
        if (!config) {
            return res.status(400).json({ success: false, message: `Variable '${variable}' no soportada.` });
        }
        
        console.log(`\n[Request] Procesando: ${variable} para ${day}/${month} en (Lat:${lat}, Lon:${lon})`);

        // --- CORRECCIÓN: Construir la URL del dataset dinámicamente ---
        // Necesitamos el mes y día con ceros a la izquierda (ej: 01, 09)
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        // --- CORRECCIÓN DE LÓGICA: Usar el nombre de colección y rango temporal correctos ---
        // La colección MERRA2_100 (M2T1NXSLV/AER) tiene datos hasta 2016.
        // Usaremos un año de referencia (ej. 2016) solo para obtener las coordenadas, ya que la grilla es constante.
        const referenceYear = '2016'; 
        const datasetType = config.datasetUrlTemplate.includes('AER') ? 'aer' : 'slv';
        const referenceFilePrefix = getMerra2FilePrefix(referenceYear);
        const referenceDatasetFileName = `MERRA2_${referenceFilePrefix}.tavg1_2d_${datasetType}_Nx.${referenceYear}${monthStr}${dayStr}.nc4`;
        const referenceDatasetUrl = `${config.datasetUrlTemplate}/${referenceYear}/${monthStr}/${referenceDatasetFileName}`;

        // 1. Obtener coordenadas y encontrar índices
        const { lats, lons } = await getCoordinates(referenceDatasetUrl);
        const latIndex = findClosestIndex(lat, lats);
        const lonIndex = findClosestIndex(lon, lons);
        console.log(`[Index] Índices encontrados -> Lat: ${latIndex}, Lon: ${lonIndex}`);

        // 2. Obtener estadísticas históricas (de la BD o calculándolas)
        const stats = await getHistoricalStatistics(config, day, month, latIndex, lonIndex);
        const thresholdValue = config.threshold(stats);

        // --- LÓGICA DE PROBABILIDAD REVISADA ---
        // 3. Calcular la probabilidad usando el conjunto de datos histórico completo.
        let probability = 0;
        // Si los datos no vienen de la caché, tenemos el array 'values' para calcular.
        if (stats.values && stats.values.length > 0) {
            const adverseHoursInRecentYear = config.isBelowThresholdWorse
                ? stats.values.filter(v => v < thresholdValue).length
                : stats.values.filter(v => v > thresholdValue).length;
            probability = Math.round((adverseHoursInRecentYear / stats.values.length) * 100);
        } else if (stats.fromCache) {
            // Si viene de la caché, no tenemos 'values'. No podemos calcular la probabilidad.
            // Devolvemos un valor placeholder y un mensaje claro.
            probability = -1; // Usamos -1 para indicar que no se calculó.
            console.log("[INFO] Usando estadísticas cacheadas. El cálculo de probabilidad se omite para una respuesta rápida.");
        }

        // 4. Formatear y enviar respuesta
        const detailDescription = probability === -1
            ? `Se usaron estadísticas históricas cacheadas (${HISTORICAL_RANGE}). La media para este día y lugar es ${stats.mean.toFixed(2)} ${config.unit}. El umbral de riesgo es ${thresholdValue.toFixed(2)} ${config.unit}.`
            : `La probabilidad de que la condición '${variable}' ocurra es del ${probability}%, basado en datos de ${HISTORICAL_RANGE}. El umbral de riesgo, calculado a partir de la media, es ${thresholdValue.toFixed(2)} ${config.unit}.`;

        const result = {
            success: true,
            location: `(Lat: ${lats[latIndex].toFixed(2)}, Lon: ${lons[lonIndex].toFixed(2)})`,
            date: `${day}/${month}`,
            variable: variable,
            probability: probability,
            historicalMean: parseFloat(stats.mean.toFixed(1)),
            threshold: parseFloat(thresholdValue.toFixed(1)),
            unit: config.unit,
            detailDescription: detailDescription,
            downloadLink: "https://disc.gsfc.nasa.gov/datasets/M2T1NXSLV_5.12.4/summary" // Link genérico a la colección
        };
        
        // 5. Guardar en DB el resultado final para el usuario
        try {
            const record = new ClimateDay({ ...result, lat, lon, day, month });
            await record.save();
            console.log("[DB] Resultado guardado en la base de datos con éxito.");
            // --- CORRECCIÓN: Enviar la respuesta DESPUÉS de guardar en la BD ---
            res.json(result);
        } catch (dbError) {
            console.error("[DB] Error al guardar el resultado:", dbError.message);
            // Si falla el guardado, igualmente enviamos el resultado al usuario.
            res.json(result);
        }

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
/**
 * RUTA DE UTILIDAD: Borra todos los documentos de la colección ClimateDay.
 * Útil para limpiar la base de datos durante el desarrollo.
 * Para usarla, puedes hacer una petición DELETE desde Postman o curl a:
 * http://localhost:3000/api/clear-cache
 */
app.delete("/api/clear-cache", async (req, res) => {
    try {
        const deleteResult = await ClimateDay.deleteMany({});
        res.json({ success: true, message: `Se han borrado ${deleteResult.deletedCount} registros de la caché.` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al limpiar la caché.", error: error.message });
    }
});

app.get("/", (req, res) => {
    res.send("Servidor AstroCast API (OPeNDAP) está funcionando.");
});

app.listen(port, () => {
    console.log(`\n🚀 Servidor de API de AstroCast corriendo en http://localhost:${port}`);
    console.log(`   Asegúrate de que tus variables de entorno (.env) están configuradas.`);
    console.log(`   ¡No olvides ejecutar 'npm run dev' en otra terminal para el frontend!\n`);
});