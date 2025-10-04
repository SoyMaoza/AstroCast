// Usando CommonJS:
const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');
const dotenv = require('dotenv');
// NOTE: Se requiere que este archivo exista en tu estructura:
const { obtenerEstadisticasHistoricas } = require('./data/Clima.js');
const { execFile } = require('child_process');
dotenv.config();
const mongoose = require("mongoose");
const app = express();
const port = 3001;

// Configurar middlewares
app.use(cors());
app.use(express.json());

// --- Configuración de Gemini ---
const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const modelName = "gemini-1.5-flash";
let chat = null;

function initializeChat() {
    console.log(`Inicializando sesión de chat con el modelo ${modelName}...`);
    chat = ai.chats.create({
        model: modelName,
        config: {
            systemInstruction: "Eres un asistente de chatbot amigable y servicial, diseñado para responder preguntas de forma concisa. Si te piden información de usuario o algo relacionado a ayuda, debes responder con un mensaje que incluya el hipervínculo en formato **Markdown**: [Página de Ayuda](http://localhost:5173/info). De preferencia que tus respuestas no sean tan largas, tienes permitido dar información sobre su ubicación si te la piden, solo los datos que tienes acceso. ",
        },
    });
}
initializeChat();

// --- Ruta API de Chat ---
app.post('/api/chat', async (req, res) => {
    // --- INICIO DE NUEVOS LOGS DE DIAGNÓSTICO ---
    console.log("\n\n--- Nueva Petición a /api/chat ---");
    console.log("Cuerpo de la petición recibido:", req.body);
    // --- FIN DE NUEVOS LOGS DE DIAGNÓSTICO ---

    const { message, lat, lon, date, variable } = req.body;

    if (!message) {
        console.log("❌ Error: El mensaje es vacío o no existe.");
        return res.status(400).json({ error: 'El mensaje es requerido.' });
    }

    try {
        const lowerCaseMessage = message.toLowerCase();
        console.log("Mensaje en minúsculas para análisis:", `"${lowerCaseMessage}"`); // Log para ver el mensaje

        const esConsultaAyuda = (
            lowerCaseMessage.includes('ayuda') ||
            lowerCaseMessage.includes('info') ||
            lowerCaseMessage.includes('soporte') ||
            lowerCaseMessage.includes('usuario') ||
            lowerCaseMessage.includes('compartir') ||
            lowerCaseMessage.includes('historial')
        );

        if (esConsultaAyuda) {
            console.log("✅ ¡REGLA DE AYUDA ACTIVADA! Enviando respuesta con hipervínculo.");
            const markdownResponse = "Para más información sobre la aplicación o para compartir tu historial de chat, por favor visita nuestra **[Página de Ayuda](http://localhost:5173/info)**.";
            return res.json({ text: markdownResponse });
        }

        console.log("ℹ️ La regla de ayuda no se activó. Procesando con otras lógicas o con IA...");

        // --- Lógica de Resumen de Consulta ---
        const pideResumenConsulta = (lat && lon && date) &&
        (lowerCaseMessage.includes('mi información') ||
        lowerCaseMessage.includes('mis datos') ||
        lowerCaseMessage.includes('mi latitud') ||
        lowerCaseMessage.includes('dame la informacion'));

        if (pideResumenConsulta) {
            console.log("✅ Lógica de Resumen activada.");
            const textoRespuesta = `¡Claro! Aquí están los datos de la consulta que tienes seleccionada:\n\n- **Ubicación:**\n  - Latitud: ${lat}\n  - Longitud: ${lon}\n- **Fecha seleccionada:**\n  - Mes: ${date.split('-')[0]}\n  - Día: ${date.split('-')[1]}\n- **Condición a Analizar:** ${variable || 'No seleccionada'}\n\nSi quieres que analice el clima para estos datos, solo pregunta algo como: "dime el pronóstico del clima".`;
            return res.json({ text: textoRespuesta });
        }

        // --- Lógica de Clima ---
        const esConsultaClima = (lat && lon && date) &&
        (lowerCaseMessage.includes('clima') ||
        lowerCaseMessage.includes('pronóstico') ||
        lowerCaseMessage.includes('analiza') ||
        lowerCaseMessage.includes('dime'));

        let responseText;

        if (esConsultaClima) {
            console.log("✅ Lógica de Clima activada.");
            const estadisticas = await obtenerEstadisticasHistoricas({ lat: parseFloat(lat), lon: parseFloat(lon) }, date, new Date().getFullYear() - 5, new Date().getFullYear() - 1);
            const resumenDatos = estadisticas.generarTextoResumen();
            const promptMejorado = `Basándote en los siguientes datos históricos para la ubicación con latitud ${lat} y longitud ${lon} en la fecha ${date}, responde a la pregunta del usuario de una manera amigable y conversacional. Explica qué significan estas probabilidades. No menciones los años analizados a menos que te lo pregunten.\n\nDatos del Análisis Histórico:\n${resumenDatos}\n\nPregunta del usuario: "${message}"`;
            const response = await chat.sendMessage({ message: promptMejorado });
            responseText = response.text;
        } else {
            console.log("🤖 Enviando mensaje a la IA de Gemini...");
            const response = await chat.sendMessage({ message: message });
            responseText = response.text;
        }

        return res.json({ text: responseText });

    } catch (error) {
        console.error('❌ Error al comunicarse con la API de Gemini:', error);
        res.status(500).json({ error: 'Error interno del servidor al procesar el chat.' });
    }
});


// =================================================================
// EL RESTO DEL CÓDIGO PERMANECE IGUAL
// =================================================================

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ Conectado a MongoDB Atlas"))
.catch((err) => console.error("❌ Error al conectar a MongoDB:", err));

// =================================================================
//                   ESQUEMA Y MODELO DE MONGODB
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
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    frio: {
        apiVariable: "T2M",
        datasetUrl: MERRA2_SLV_URL,
        unit: "K",
        threshold: (stats) => stats.p10,
        isBelowThresholdWorse: true,
    },
    ventoso: {
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
};

// =================================================================
//        MANEJO DE AUTENTICACIÓN Y CACHÉ DE COORDENADAS
// =================================================================
const coordinateCache = new Map();

// =================================================================
//                      FUNCIONES HELPERS
// =================================================================

function fetchWithCurl(url, isJson = false) {
    return new Promise((resolve, reject) => {
        const cookieFile = 'nasa-cookies.txt';
        const args = ['-n', '-L', '-k', '-c', cookieFile, '-b', cookieFile, url];
        const options = { encoding: isJson ? 'utf8' : 'buffer', maxBuffer: 1024 * 1024 * 50 };

        execFile('curl.exe', args, options, (error, stdout, stderr) => {
            if (error) {
                const cleanStderr = stderr.toString().split('\n').filter(line => !line.startsWith('  % Total')).join('\n');
                return reject(new Error(`Fallo en curl: ${cleanStderr || error.message}`));
            }
            resolve(isJson ? JSON.parse(stdout) : stdout);
        });
    });
}

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

async function getCoordinates(datasetUrl) {
    if (coordinateCache.has(datasetUrl)) {
        console.log(`[Cache] Coordenadas obtenidas de la caché para ${datasetUrl.slice(-20)}`);
        return coordinateCache.get(datasetUrl);
    }

    console.log(`[NASA API] Obteniendo coordenadas para ${datasetUrl.slice(-20)}`);
    const coordUrl = `${datasetUrl}.dods?lat,lon`;
    const buffer = await fetchWithCurl(coordUrl, false);

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

function calculateStatistics(timeSeries, timeValues, day, month) {
    const baseDate = new Date('1980-01-01T00:30:00Z');
    const dailyValues = [];

    for (let i = 0; i < timeValues.length; i++) {
        const currentDate = new Date(baseDate.getTime() + timeValues[i] * 60000);
        if (currentDate.getUTCMonth() + 1 === month && currentDate.getUTCDate() === day) {
            if (isFinite(timeSeries[i])) {
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

        const { lats, lons } = await getCoordinates(config.datasetUrl);
        const latIndex = findClosestIndex(lat, lats);
        const lonIndex = findClosestIndex(lon, lons);
        console.log(`[Index] Índices encontrados -> Lat: ${latIndex}, Lon: ${lonIndex}`);

        let timeSeries;
        const timeUrl = `${config.datasetUrl}.json?time`;
        const timeResponse = await fetchWithCurl(timeUrl, true);
        const timeValues = timeResponse.time;

        if (Array.isArray(config.apiVariable)) {
            console.log(`[NASA API] Obteniendo series para ${config.apiVariable.join(', ')}...`);
            const [u10mUrl, v10mUrl] = config.apiVariable.map(v =>
                `${config.datasetUrl}.json?${v}[0:1:${timeValues.length-1}][${latIndex}][${lonIndex}]`
            );
            const [u10mResponse, v10mResponse] = await Promise.all([ fetchWithCurl(u10mUrl, true), fetchWithCurl(v10mUrl, true) ]);
            const u10mValues = u10mResponse[config.apiVariable[0]];
            const v10mValues = v10mResponse[config.apiVariable[1]];
            timeSeries = u10mValues.map((u, i) => Math.sqrt(u*u + v10mValues[i]*v10mValues[i]));
        } else {
            console.log(`[NASA API] Obteniendo serie para ${config.apiVariable}...`);
            const dataUrl = `${config.datasetUrl}.json?${config.apiVariable}[0:1:${timeValues.length-1}][${latIndex}][${lonIndex}]`;
            const dataResponse = await fetchWithCurl(dataUrl, true);
            timeSeries = dataResponse[config.apiVariable];
        }

        const stats = calculateStatistics(timeSeries, timeValues, parseInt(day), parseInt(month));
        const thresholdValue = config.threshold(stats);

        let adverseDays = 0;
        if (config.isBelowThresholdWorse) {
            adverseDays = stats.values.filter(v => v < thresholdValue).length;
        } else {
            adverseDays = stats.values.filter(v => v > thresholdValue).length;
        }
        const probability = Math.round((adverseDays / stats.values.length) * 100);

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
});