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
const modelName = "gemini-2.5-flash";
let chat = null;

function initializeChat() {
    console.log(`Inicializando sesión de chat con el modelo ${modelName}...`);
    chat = ai.chats.create({
        model: modelName,
        config: {
            systemInstruction: "You are a friendly and helpful chatbot assistant, designed to answer questions concisely. If asked for user information or help-related topics, you must respond with a message that includes a Markdown hyperlink: [Help Page](http://localhost:5173/faq). Preferably, your answers should not be too long. You are allowed to provide information about the user's location if requested, using only the data you have access to. If asked for the location, also provide the place corresponding to the coordinates. For example, if given a latitude and longitude, convert it to the corresponding location.",
        },
    });
}
initializeChat();

// --- Ruta API de Chat ---
app.post('/api/chat', async (req, res) => {
    // --- INICIO DE NUEVOS LOGS DE DIAGNÓSTICO ---
    console.log("\n\n--- New Request to /api/chat ---");
    console.log("Request body received:", req.body);
    // --- FIN DE NUEVOS LOGS DE DIAGNÓSTICO ---

    const { message, lat, lon, day, month, variable } = req.body;

    if (!message) {
        console.log("❌ Error: Message is empty or does not exist.");
        return res.status(400).json({ error: 'Message is required.' });
    }

    try {
        const lowerCaseMessage = message.toLowerCase(); // Keep this in lowercase for matching
        console.log("Lowercase message for analysis:", `"${lowerCaseMessage}"`); // Log to see the message

        const esConsultaAyuda = (
            lowerCaseMessage.includes('ayuda') ||
            lowerCaseMessage.includes('info') ||
            lowerCaseMessage.includes('soporte') ||
            lowerCaseMessage.includes('usuario') ||
            lowerCaseMessage.includes('compartir') ||
            lowerCaseMessage.includes('historial')
        );

        if (esConsultaAyuda) {
            console.log("✅ HELP RULE ACTIVATED! Sending response with hyperlink.");
            const markdownResponse = "For more information about the application or to share your chat history, please visit our **Help Page**.";
            return res.json({ text: markdownResponse });
        }

        console.log("ℹ️ Help rule not activated. Processing with other logic or AI...");

        // --- Lógica de Resumen de Consulta ---
        const pideResumenConsulta = (lat && lon && day && month) &&
        (lowerCaseMessage.includes('mi información') ||
        lowerCaseMessage.includes('mis datos') ||
        lowerCaseMessage.includes('mi latitud') ||
        lowerCaseMessage.includes('dame la informacion') ||
        lowerCaseMessage.includes('mi ubicación') || // <-- NUEVA CONDICIÓN
        lowerCaseMessage.includes('cual es mi ubicacion')); // <-- NUEVA CONDICIÓN

        if (pideResumenConsulta) {
            console.log("✅ Summary Logic activated.");
            const textoRespuesta = `Of course! Here is the data for your selected query:\n\n- **Location:**\n  - Latitude: ${lat}\n  - Longitude: ${lon}\n- **Selected Date:**\n  - Month: ${month}\n  - Day: ${day}\n- **Condition to Analyze:** ${variable || 'Not selected'}\n\nIf you want me to analyze the weather for this data, just ask something like: "tell me the weather forecast".`;
            return res.json({ text: textoRespuesta });
        }

        // --- Lógica de Clima ---
        const esConsultaClima = (lat && lon && day && month) &&
        (lowerCaseMessage.includes('clima') ||
        lowerCaseMessage.includes('pronóstico') ||
        lowerCaseMessage.includes('analiza') ||
        lowerCaseMessage.includes('dime'));

        let responseText;

        if (esConsultaClima) {
            console.log("✅ Climate Logic activated.");
            const estadisticas = await obtenerEstadisticasHistoricas({ lat: parseFloat(lat), lon: parseFloat(lon) }, `${month}-${day}`, new Date().getFullYear() - 5, new Date().getFullYear() - 1);
            const resumenDatos = estadisticas.generarTextoResumen();
            const promptMejorado = `Based on the following historical data for the location with latitude ${lat} and longitude ${lon} on the date ${month}-${day}, answer the user's question in a friendly and conversational manner. Explain what these probabilities mean. Do not mention the analyzed years unless asked.\n\nHistorical Analysis Data:\n${resumenDatos}\n\nUser's question: "${message}"`;
            const response = await chat.sendMessage({ message: promptMejorado });
            responseText = response.text;
        } else {
            console.log("🤖 Sending message to Gemini AI...");
            const response = await chat.sendMessage({ message: message });
            responseText = response.text;
        }

        return res.json({ text: responseText });

    } catch (error) {
        console.error('❌ Error communicating with Gemini API:', error);
        res.status(500).json({ error: 'Internal server error while processing chat.' });
    }
});


// =================================================================
// EL RESTO DEL CÓDIGO PERMANECE IGUAL
// =================================================================

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch((err) => console.error("❌ Error connecting to MongoDB:", err));

// =================================================================
//                   ESQUEMA Y MODELO DE MONGODB
// =================================================================
const ClimateDaySchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    variable: { type: String, required: true, enum: ["warm", "cold", "windy", "dusty", "humid", "uncomfortable", "rainy", "snowy", "cloudy"] },
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
const GPM_IMERG_URL_TEMPLATE = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07"; // CORRECCIÓN: GPM no usa el endpoint /hyrax/


const CONFIG_VARIABLES_NASA = {
    warm: {
        apiVariable: "T2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "K",
        // NUEVO UMBRAL: La media más 1.5 desviaciones estándar.
        threshold: (stats) => stats.mean + 1.5 * stats.stdDev,
        isBelowThresholdWorse: false, // Es peor si está POR ENCIMA del umbral.
    },
    cold: {
        apiVariable: "T2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "K",
        // NUEVO UMBRAL: La media menos 1.5 desviaciones estándar.
        threshold: (stats) => stats.mean - 1.5 * stats.stdDev,
        isBelowThresholdWorse: true, // Es peor si está POR DEBAJO del umbral.
    },
    windy: {
        apiVariable: ["U10M", "V10M"],
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE, // CORRECCIÓN: Usar la plantilla correcta para variables de superficie.
        unit: "m/s",
        threshold: (stats) => stats.mean + 1.5 * stats.stdDev, // Umbral basado en la media
        isBelowThresholdWorse: false,
    },
    dusty: {
        apiVariable: "DUEXTTAU",
        datasetUrlTemplate: MERRA2_AER_URL_TEMPLATE,
        unit: "1 (dimensionless)",
        threshold: (stats) => stats.mean + 2.0 * stats.stdDev, // Para polvo, un umbral más extremo
        isBelowThresholdWorse: false,
    },
    humid: {
        apiVariable: "QV2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "kg/kg",
        threshold: (stats) => stats.p90, // Usamos el percentil 90 como umbral de referencia
        isBelowThresholdWorse: false,
    },
    uncomfortable: {
        apiVariable: ["T2M", "QV2M", "PS"], // Necesita Temperatura, Humedad Específica y Presión
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "°C (Heat Index)",
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    rainy: {
        apiVariable: "precipitation", // CORRECCIÓN FINAL: La variable en GPM IMERG V7 es 'precipitation'.
        datasetUrlTemplate: GPM_IMERG_URL_TEMPLATE,
        startYear: 2000, // Los datos de GPM IMERG comienzan en junio de 2000
        unit: "mm/day",
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    snowy: {
        apiVariable: "PRECSN", // Precipitación de Nieve
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "mm/day",
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    cloudy: {
        apiVariable: "CLDTOT", // Fracción Total de Nubes
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "%", // La API lo da como fracción (0-1), lo convertiremos
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
        const path = require('path');
        const cookieFile = path.join(__dirname, 'nasa-cookies.txt');
        
        // ======================================================= //
        // AQUÍ ESTÁ EL CAMBIO MÁS IMPORTANTE
        // Ahora busca .netrc en la carpeta del proyecto (backend/)
        // ======================================================= //
        const netrcFile = path.join(__dirname, '.netrc');

        const args = ['-L', '-k', '--netrc-file', netrcFile, '-c', cookieFile, '-b', cookieFile, url];
        const options = { encoding: isJson ? 'utf8' : 'buffer', maxBuffer: 1024 * 1024 * 50 };

        // ======================================================= //
        //              AQUÍ ESTÁ LA CORRECCIÓN
        // Se cambió 'curl.exe' por 'curl' para que funcione en
        // macOS, Linux y Windows.
        // ======================================================= //
        execFile('curl', args, options, (error, stdout, stderr) => {
            if (error) {
                const cleanStderr = stderr.toString().split('\n').filter(line => !line.startsWith('  % Total')).join('\n');
                return reject(new Error(`Fallo en curl: ${cleanStderr || error.message}`));
            }

            if (isJson) {
                try {
                    resolve(JSON.parse(stdout));
                } catch (jsonError) {
                    if (stdout.trim().startsWith('<!DOCTYPE html')) {
                        console.error("DEBUG: Curl output was HTML, likely an authentication or server error. First 500 chars:", stdout.slice(0, 500) + "...");
                        return reject(new Error(`JSON parsing error: The NASA API response is not valid JSON. It appears to be an HTML page (possibly a login or error page). Please check your Earthdata Login credentials in the .netrc file.`));
                    }
                    return reject(new Error(`JSON parsing error: ${jsonError.message}. Response received: ${stdout.slice(0, 200)}...`));
                }
            } else {
                resolve(stdout);
            }
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
        console.log(`[Cache] Coordinates retrieved from cache for ${datasetUrl.slice(-20)}`);
        return coordinateCache.get(datasetUrl);
    }

    console.log(`[NASA API] Fetching coordinates for ${datasetUrl.slice(-20)}`);
    // --- MEJORA: Usar la respuesta .json en lugar de .dods para evitar parseo manual ---
    const coordUrl = `${datasetUrl}.json?lat,lon`;
    try {
        const coordResponse = await fetchWithCurl(coordUrl, true); // true para que parsee como JSON

        // --- MEJORA: La estructura de GPM y MERRA-2 es diferente ---
        const latLeaf = coordResponse.leaves?.find(leaf => leaf.name === 'lat') || coordResponse.nodes?.find(n => n.name === 'Grid')?.leaves?.find(l => l.name === 'lat');
        const lonLeaf = coordResponse.leaves?.find(leaf => leaf.name === 'lon') || coordResponse.nodes?.find(n => n.name === 'Grid')?.leaves?.find(l => l.name === 'lon');

        if (!latLeaf || !lonLeaf || !latLeaf.data || !lonLeaf.data) {
            console.error("[DEBUG] Estructura de respuesta de coordenadas inesperada:", JSON.stringify(coordResponse, null, 2));
            throw new Error("Could not get coordinates from the dataset in JSON format. Check the URL in the console.");
        }

        const lats = latLeaf.data;
        const lons = lonLeaf.data;
        
        const coords = { lats, lons };
        coordinateCache.set(datasetUrl, coords);
        return coords;
    } catch (error) {
        console.error(`[ERROR] Coordinate URL that failed: ${coordUrl}`);
        throw error; // Re-lanzar el error original para que sea capturado por la ruta principal
    }
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
        throw new Error(`No historical data found for the date ${day}/${month}.`);
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
    const variableName = Array.isArray(config.apiVariable) ? 'windy' : config.apiVariable;

    // 1. Revisar la caché de estadísticas en la BD
    const cachedStat = await HistoricalStat.findOne({ day, month, latIndex, lonIndex, variable: variableName });
    if (cachedStat) {
        console.log(`[Cache-Stats] Statistics found in DB for ${day}/${month}. They will be used for the threshold, but the probability will be recalculated.`);
        // Aunque tengamos la estadística, necesitamos los valores para la probabilidad.
        // Procedemos a calcularlos de nuevo. El umbral usará el valor cacheado si es posible.
    }
    console.log(`[NASA API] Calculating historical statistics for ${day}/${month}. This may take a while...`);

    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const allHistoricalValues = [];

    // 2. Iterar por todos los años disponibles (1980-2016 para esta colección)
    const startYear = config.startYear || 1980; // Usar el año de inicio de la config, o 1980 por defecto
    const endYear = new Date().getFullYear(); // Analizar hasta el año actual
    const yearPromises = [];
    const now = new Date(); // Obtenemos la fecha actual una vez

    for (let year = startYear; year <= endYear; year++) {
        const urlTemplate = config.datasetUrlTemplate;
        const queryDate = new Date(year, month - 1, day);

        // --- MEJORA: No intentar descargar datos de fechas futuras o no disponibles ---
        if (urlTemplate.includes('GPM_3IMERGDF')) {
            // El dataset GPM IMERG "Final" tiene un retraso de ~3.5 meses. Usamos 4 por seguridad.
            const availabilityDate = new Date(queryDate);
            availabilityDate.setMonth(availabilityDate.getMonth() + 4);
            if (availabilityDate > now) {
                console.log(`[INFO] Search stopped in year ${year} for GPM because data is not yet available (approx. 3.5-month delay).`);
                break;
            }
        } else {
            // Para otros datasets (MERRA-2), solo verificamos que la fecha no sea futura.
            if (queryDate > now) {
                console.log(`[INFO] Search stopped in year ${year} because the date is in the future.`);
                break;
            }
        }
        let datasetFileName;

        // --- LÓGICA PARA CONSTRUIR URLS DE MÚLTIPLES DATASETS ---
        if (urlTemplate.includes('GPM_3IMERGDF')) {
            // Formato de archivo para GPM IMERG Daily
            // CORRECCIÓN FINAL: Usar el formato de nombre de archivo V07B validado.
            datasetFileName = `3B-DAY.MS.MRG.3IMERG.${year}${monthStr}${dayStr}-S000000-E235959.V07B.nc4`; // Nombre de archivo original y correcto
        } else {
            // Formato de archivo para MERRA-2
            const filePrefix = getMerra2FilePrefix(year);
            const datasetType = config.datasetUrlTemplate.includes('AER') ? 'aer' : 'slv';
            datasetFileName = `MERRA2_${filePrefix}.tavg1_2d_${datasetType}_Nx.${year}${monthStr}${dayStr}.nc4`;
        }

        const baseDatasetUrl = `${urlTemplate}/${year}/${monthStr}/${datasetFileName}`;
        
        // Función para obtener los datos de un año
        const fetchYearData = async (currentUrl) => {
            const fetchData = async (url) => {
                // --- LÓGICA EXISTENTE PARA MERRA-2 ---
                if (Array.isArray(config.apiVariable)) {
                    // --- LÓGICA PARA MÚLTIPLES VARIABLES (ventoso, incomodo) ---
                    const variableUrls = config.apiVariable.map(v => encodeURI(`${url}.json?${v}[0:1:23][${latIndex}][${lonIndex}]`));
                    const responses = await Promise.all(variableUrls.map(vUrl => fetchWithCurl(vUrl, true)));

                    const dataArrays = responses.map((response, i) => {
                        const leaf = response.nodes?.[0]?.leaves?.find(l => l.name === config.apiVariable[i]);
                        if (!leaf?.data) throw new Error(`Datos para la variable ${config.apiVariable[i]} incompletos.`);
                        return leaf.data.flat(Infinity);
                    });

                    console.log(`[NASA API] Download for year ${year} completed. URLs: ${variableUrls.join(', ')}`);

                    if (variableName === 'windy') {
                        const [u10mValues, v10mValues] = dataArrays;
                        const windData = u10mValues.map((u, i) => Math.sqrt(u * u + v10mValues[i] * v10mValues[i]));
                        console.log(`       Values (wind): [${windData.map(v => v.toFixed(2)).join(', ')}]`);
                        return windData;
                    }

                    if (variableName === 'uncomfortable') {
                        const [t2mValues, qv2mValues, psValues] = dataArrays;
                        const heatIndexData = t2mValues.map((t_k, i) => {
                            const t_c = t_k - 273.15; // Temperatura en Celsius
                            const qv = qv2mValues[i]; // Humedad específica (kg/kg)
                            const p = psValues[i];   // Presión (Pa)

                            // 1. Calcular presión de vapor de saturación (e_s) en hPa
                            const e_s = 6.1094 * Math.exp((17.625 * t_c) / (t_c + 243.04));
                            // 2. Calcular presión de vapor (e) en hPa
                            const e = (qv * (p / 100)) / (0.622 + 0.378 * qv);
                            // 3. Calcular Humedad Relativa (RH)
                            const rh = Math.min(100, (e / e_s) * 100);

                            // 4. Calcular Índice de Calor (HI) - fórmula simple para T > 26.7°C
                            if (t_c < 26.7) return t_c; // Por debajo de ~27°C, el HI es igual a la temperatura
                            const t_f = t_c * 1.8 + 32; // Convertir a Fahrenheit para la fórmula
                            let hi_f = -42.379 + 2.04901523 * t_f + 10.14333127 * rh - 0.22475541 * t_f * rh - 6.83783e-3 * t_f * t_f - 5.481717e-2 * rh * rh + 1.22874e-3 * t_f * t_f * rh + 8.5282e-4 * t_f * rh * rh - 1.99e-6 * t_f * t_f * rh * rh;
                            return (hi_f - 32) / 1.8; // Convertir de vuelta a Celsius
                        });
                        console.log(`       Values (Heat Index): [${heatIndexData.map(v => v.toFixed(2)).join(', ')}]`);
                        return heatIndexData;
                    }

                    // Si no es 'incomodo' ni 'ventoso', pero es un array, devolvemos vacío para evitar errores.
                    return []; 
                } else { // Caso de variable simple
                    let dataUrl;
                    // --- CORRECCIÓN: La estructura de GPM IMERG Daily es diferente ---
                    // No tiene dimensión de tiempo, y el orden de lat/lon puede ser distinto.
                    // La estructura es [lon][lat] para este dataset.
                    // --- CORRECCIÓN FINAL: La variable NO está en un nodo "Grid" y no tiene dimensión de tiempo ---
                    // --- CORRECCIÓN GPM: La estructura es [tiempo][lon][lat], se debe incluir el índice de tiempo [0]. ---
                    if (urlTemplate.includes('GPM_3IMERGDF')) {
                        dataUrl = encodeURI(`${url}.json?${config.apiVariable}[0][${lonIndex}][${latIndex}]`);
                    } else {
                        dataUrl = encodeURI(`${url}.json?${config.apiVariable}[0:1:23][${latIndex}][${lonIndex}]`);
                    }
                    const dataResponse = await fetchWithCurl(dataUrl, true);
                    // La respuesta de GPM es diferente, el dato viene en un nodo "Grid"
                    const dataLeaf = dataResponse.nodes?.[0]?.leaves?.find(l => l.name === config.apiVariable) || dataResponse.nodes?.find(n => n.name === 'Grid')?.leaves?.find(l => l.name === config.apiVariable);
                    if (!dataLeaf?.data) throw new Error("Datos simples incompletos");
                    let simpleData = dataLeaf.data.flat(Infinity); // GPM Daily tiene un solo valor
                    
                    // --- CONVERSIÓN DE UNIDADES ---
                    if (variableName === 'rainy' && urlTemplate.includes('GPM_3IMERGDF')) {
                        // CORRECCIÓN: GPM Daily (GPM_3IMERGDF) viene en mm/hr. Se debe multiplicar por 24 para obtener mm/día.
                        // El valor es un array con un solo elemento.
                        simpleData = [simpleData[0] * 24];
                    } else if (variableName === 'snowy') { // Assuming snowy will use MERRA-2 (kg m-2 s-1)
                        simpleData = simpleData.map(v => v * 86400);
                    }

                    console.log(`[NASA API] Download for year ${year} completed. URL: ${dataUrl}`);
                    console.log(`       Values (${config.apiVariable}): [${simpleData.map(v => v.toFixed(5)).join(', ')}]`); // IMPROVEMENT: Show more decimals
                    return simpleData;
                }
            };

            try {
                return await fetchData(currentUrl);
            } catch (e) {
                // --- MEJORA: Lógica de reintento para MERRA2_401 ---
                // Si el error es por recibir HTML (síntoma de un 404) y cumple las condiciones, reintentamos.
                if (year >= 2011 && currentUrl.includes("MERRA2_400") && e.message.includes("Parece ser una página HTML")) {
                    console.warn(`[WARN] Download failed with MERRA2_400 for year ${year}. Retrying with MERRA2_401...`);
                    const retryUrl = currentUrl.replace("MERRA2_400", "MERRA2_401");
                    return await fetchData(retryUrl).catch(retryError => {
                        console.error(`[ERROR] Retry with MERRA2_401 also failed for year ${year}. Skipping...`);
                        // --- MEJORA: Loguear URLs específicas en el fallo del reintento ---
                        if (Array.isArray(config.apiVariable)) {
                            const failedUrls = config.apiVariable.map(v => encodeURI(`${retryUrl}.json?${v}[0:1:23][${latIndex}][${lonIndex}]`));
                            console.error(`       Failed URLs: ${failedUrls.join(', ')}`);
                        } else {
                            console.error(`       Failed URL: ${encodeURI(`${retryUrl}.json?${config.apiVariable}[0:1-23][${latIndex}][${lonIndex}]`)}`);
                        }
                        return [];
                    });
                }
                // --- MEJORA SOLICITADA: Loguear la URL que falla ---
                let failedUrl;
                if (urlTemplate.includes('GPM_3IMERGDF')) {
                    // --- CORRECCIÓN: Usar el formato de URL correcto para GPM en el log de errores ---
                    failedUrl = `${baseDatasetUrl}.json?${config.apiVariable}[0][${lonIndex}][${latIndex}]`;
                } else if (Array.isArray(config.apiVariable)) {
                    failedUrl = `${baseDatasetUrl} (for variables ${config.apiVariable.join(', ')})`;
                } else {
                    failedUrl = `${baseDatasetUrl}.json?${config.apiVariable}[0:1:23][${latIndex}][${lonIndex}]`;
                }

                // Si un año falla (ej. archivo no existe), lo ignoramos y continuamos.
                console.warn(`[WARN] Could not get data for year ${year}. Skipping...`);
                console.warn(`       Failed URL: ${failedUrl}`);
                return [];
            }
        };
        yearPromises.push(fetchYearData(baseDatasetUrl));
    }

    // 3. Ejecutar todas las peticiones en paralelo y recolectar los datos
    const yearlyData = await Promise.all(yearPromises);
    yearlyData.forEach(values => allHistoricalValues.push(...values.filter(isFinite)));

    if (allHistoricalValues.length === 0) {
        throw new Error(`No valid historical data found for the date ${day}/${month} in all consulted years.`);
    }

    // 4. Calcular estadísticas sobre el conjunto de datos completo
    allHistoricalValues.sort((a, b) => a - b);
    const mean = allHistoricalValues.reduce((a, b) => a + b, 0) / allHistoricalValues.length;
    const p10 = allHistoricalValues[Math.floor(allHistoricalValues.length * 0.10)];
    const p90 = allHistoricalValues[Math.floor(allHistoricalValues.length * 0.90)];
    // --- NUEVO CÁLCULO: Desviación Estándar ---
    const variance = allHistoricalValues.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (allHistoricalValues.length - 1);
    const stdDev = Math.sqrt(variance);

    console.log(`[Stats] Final historical average calculated: ${mean.toFixed(4)}`);
    const stats = { mean, p10, p90, stdDev, values: allHistoricalValues, fromCache: !!cachedStat };

    // 5. Guardar las nuevas estadísticas en la caché de la BD
    if (!cachedStat) { // Solo guardamos si no existía en la caché
        const newStat = new HistoricalStat({
            day, month, latIndex, lonIndex, variable: variableName,
            mean: stats.mean, p10: stats.p10, p90: stats.p90, stdDev: stats.stdDev
        });
        await newStat.save();
        console.log(`[Cache-Stats] New statistics saved to DB.`);
    }

    return stats;
}

// =================================================================
//                 RUTA PRINCIPAL DE LA API
// =================================================================
app.post("/api/climate-probability", async (req, res) => {
    const { lat, lon, day, month, variable } = req.body;
    const HISTORICAL_RANGE = `1980-${new Date().getFullYear()}`; // Rango de años para mostrar en la descripción

    // --- MEJORA: Implementar lógica de caché con la base de datos ---
    try {
        // --- CORRECCIÓN DE CACHÉ: Redondear coordenadas para una caché más efectiva ---
        const latRounded = parseFloat(lat.toFixed(2));
        const lonRounded = parseFloat(lon.toFixed(2));
        const cachedResult = await ClimateDay.findOne({ lat: latRounded, lon: lonRounded, day, month, variable });

        if (cachedResult) {
            console.log(`[Cache] Result found in database for ${variable} at (Lat:${latRounded}, Lon:${lonRounded})`);
            return res.json(cachedResult); // Devuelve el resultado cacheado y termina la ejecución.
        }
    } catch (cacheError) {
        console.error("[Cache] Error searching the database cache:", cacheError.message);
    }

    try {
        const config = CONFIG_VARIABLES_NASA[variable];
        if (!config) {
            return res.status(400).json({ success: false, message: `Variable '${variable}' not supported.` });
        }

        // --- CORRECCIÓN: Definir variables de fecha al principio ---
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');

        console.log(`\n[Request] Processing: ${variable} for ${day}/${month} at (Lat:${lat}, Lon:${lon})`);

        let referenceDatasetUrl;

        if (config.datasetUrlTemplate.includes('GPM_3IMERGDF')) {
            // Para GPM, la grilla es constante, podemos usar cualquier archivo válido.
            // --- MEJORA: Usar una fecha fija y sabida que existe para la referencia de coordenadas ---
            const referenceDatasetFileName = `3B-DAY.MS.MRG.3IMERG.20230101-S000000-E235959.V07B.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/2023/01/${referenceDatasetFileName}`;
        } else {
            // Para MERRA-2, usamos un año de referencia para obtener la grilla.
            const referenceYear = '2016';
            const datasetType = config.datasetUrlTemplate.includes('AER') ? 'aer' : 'slv';
            const referenceFilePrefix = getMerra2FilePrefix(referenceYear);
            const referenceDatasetFileName = `MERRA2_${referenceFilePrefix}.tavg1_2d_${datasetType}_Nx.${referenceYear}${monthStr}${dayStr}.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/${referenceYear}/${monthStr}/${referenceDatasetFileName}`;
        }

        // 1. Obtener coordenadas y encontrar índices
        const { lats, lons } = await getCoordinates(referenceDatasetUrl);
        const latIndex = findClosestIndex(lat, lats);
        const lonIndex = findClosestIndex(lon, lons);
        console.log(`[Index] Indexes found -> Lat: ${latIndex}, Lon: ${lonIndex}`);

        // 2. Obtener estadísticas históricas (de la BD o calculándolas)
        const stats = await getHistoricalStatistics(config, day, month, latIndex, lonIndex);
        const displayThreshold = config.isBelowThresholdWorse ? stats.p10 : stats.p90;

        // --- LÓGICA DE PROBABILIDAD ABSOLUTA (GENERAL) ---
        // Mapea un valor de un rango a otro (ej. temperatura a un porcentaje)
        const mapRange = (value, in_min, in_max, out_min, out_max) => {
            return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
        };

        let probability;
        // Escalas absolutas para cada variable
        switch (variable) {
            case 'warm': // Scale from 20°C (293.15K) to 35°C (308.15K)
                probability = mapRange(stats.mean, 293.15, 308.15, 0, 100);
                break;
            case 'cold': // NEW SCALE: 20°C (293.15K) to 0°C (273.15K)
                probability = mapRange(stats.mean, 293.15, 273.15, 0, 100);
                break;
            case 'windy': // Scale from 0 m/s to 15 m/s
                probability = mapRange(stats.mean, 0, 15, 0, 100);
                break;
            case 'dusty': // NEW SCALE: 0 to 0.1 for better perception
                probability = mapRange(stats.mean, 0, 0.1, 0, 100);
                break;
            case 'humid': // Scale from 0.005 kg/kg to 0.020 kg/kg
                probability = mapRange(stats.mean, 0.005, 0.020, 0, 100);
                break;
            case 'uncomfortable': // Heat Index scale from 27°C to 41°C
                probability = mapRange(stats.mean, 27, 41, 0, 100);
                break;
            case 'rainy': {
                // --- CORRECCIÓN: La probabilidad de lluvia se basa en la frecuencia, no en la cantidad promedio ---
                // Contamos cuántos días en el historial tuvieron una precipitación significativa (> 0.2 mm/día)
                // y aplicamos Suavizado de Laplace (add-one smoothing) para evitar probabilidades de 0% o 100%.
                const diasConLluvia = stats.values.filter(p => p > 0.2).length;
                const totalDias = stats.values.length;
                // Fórmula: ((aciertos + 1) / (total de intentos + 2)) * 100
                probability = totalDias > 0 ? ((diasConLluvia + 1) / (totalDias + 2)) * 100 : 0;
                break;
            }
            case 'snowy':
                probability = 0; // Lógica pendiente
                break;
            case 'cloudy':
                probability = 0; // Lógica pendiente
                break;
            default:
                // Fallback por si se añade una variable sin escala definida
                probability = 0;
        }

        // Asegurarse de que la probabilidad esté entre 0 y 100
        probability = Math.max(0, Math.min(100, Math.round(probability)));

        // 4. Formatear y enviar respuesta
        const detailDescription = `The probability of the '${variable}' condition occurring is ${probability}%, based on the historical average of ${stats.mean.toFixed(2)} ${config.unit} for the range ${HISTORICAL_RANGE}.`;

        const result = {
            success: true,
            location: `(Lat: ${lats[latIndex].toFixed(2)}, Lon: ${lons[lonIndex].toFixed(2)})`,
            date: `${day}/${month}`,
            variable: variable,
            probability: probability,
            historicalMean: parseFloat(stats.mean.toFixed(4)), // MEJORA: Enviar más decimales al frontend
            threshold: parseFloat(displayThreshold.toFixed(1)), // Mostramos el percentil como umbral principal
            unit: config.unit,
            detailDescription: detailDescription,
            downloadLink: "https://disc.gsfc.nasa.gov/datasets/M2T1NXSLV_5.12.4/summary" // Link genérico a la colección
        };
        
        // 5. Guardar en DB el resultado final para el usuario
        try {
            // --- CORRECCIÓN DE CACHÉ: Guardar con las coordenadas redondeadas ---
            const latRounded = parseFloat(lat.toFixed(2));
            const lonRounded = parseFloat(lon.toFixed(2));
            const record = new ClimateDay({ ...result, lat: latRounded, lon: lonRounded, day, month });

            await record.save();
            console.log("[DB] Result saved to the database successfully.");
            // --- CORRECCIÓN: Enviar la respuesta DESPUÉS de guardar en la BD ---
            res.json(result);
        } catch (dbError) {
            console.error("[DB] Error saving the result:", dbError.message);
            // Si falla el guardado, igualmente enviamos el resultado al usuario.
            res.json(result);
        }

    } catch (error) {
        console.error("❌ FATAL ERROR IN API ROUTE:", error.message);
        if (error.response?.status === 401) {
            return res.status(401).json({ success: false, message: "NASA API Error: 401 Unauthorized. Check your credentials in the .env file" });
        }
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
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
        // --- MEJORA: Añadir limpieza de ambas cachés ---
        const climateResult = await ClimateDay.deleteMany({});
        const statsResult = await HistoricalStat.deleteMany({});
        const message = `Cache cleared: ${climateResult.deletedCount} climate results and ${statsResult.deletedCount} statistics records deleted.`;
        console.log(`[Cache] ${message}`);
        res.json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error clearing cache.", error: error.message });
    }
});

app.get("/", (req, res) => {
    res.send("AstroCast API Server (OPeNDAP) is running.");
});

app.listen(port, () => {
    console.log(`\n🚀 AstroCast API Server running at http://localhost:${port}`);
    console.log(`   Ensure your environment variables (.env) are configured.`);
});