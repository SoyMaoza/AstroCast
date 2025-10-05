// ✅ Using CommonJS
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { execFile } = require('child_process');
const { GoogleGenAI } = require('@google/genai');
const { obtenerEstadisticasHistoricas } = require('./data/Clima.js');

// ✅ Cargar variables de entorno
dotenv.config();

// ✅ Crear app y definir puerto
const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: ['https://astro-cast.vercel.app', 'http://localhost:5173'], // Orígenes permitidos
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// ✅ Middleware para parsear JSON
app.use(express.json());


// --- Gemini Configuration ---
const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const modelName = "gemini-2.5-flash";
let chat = null;
function initializeChat() {
    console.log(`Initializing chat session with model ${modelName}...`);
    chat = ai.chats.create({
        model: modelName,
        config: {
            systemInstruction: "You are a friendly and helpful chatbot assistant, designed to answer questions concisely. Preferably, your answers should not be too long. You are allowed to give information about their location if they ask for it, but only the data you have access to.",
        },
    });
}
initializeChat();
// --- Chat API Route ---
app.post('/api/chat', async (req, res) => {
    // --- START OF NEW DIAGNOSTIC LOGS ---
    console.log("\n\n--- New Request to /api/chat ---");
    console.log("Request body received:", req.body);
    // --- END OF NEW DIAGNOSTIC LOGS ---
    const { message, lat, lon, date, variable } = req.body;
    if (!message) {
        console.log("❌ Error: Message is empty or does not exist.");
        return res.status(400).json({ error: 'Message is required.' });
    }
    try {
        const lowerCaseMessage = message.toLowerCase();
        console.log("Lowercase message for analysis:", `"${lowerCaseMessage}"`); // Log to see the message
        const esConsultaAyuda = (
            lowerCaseMessage.includes('help') ||
            lowerCaseMessage.includes('support') ||
            lowerCaseMessage.includes('user') ||
            lowerCaseMessage.includes('share') ||
            lowerCaseMessage.includes('record') ||
            lowerCaseMessage.includes('faq') || // 'faq' is already a keyword
            lowerCaseMessage.includes('help') || // --- MEJORA: Entender "pregunta" o "preguntas" ---
            lowerCaseMessage.includes('question') || // --- MEJORA: Entender "pregunta" o "preguntas" ---
            lowerCaseMessage.includes('doubt') // --- MEJORA: Entender "duda" o "dudas" ---
        );
        if (esConsultaAyuda) {
            console.log("✅ HELP RULE ACTIVATED! Sending redirect command to /faq.");
            // --- MEJORA: Enviar un objeto con una instrucción de redirección ---
            return res.json({
                text: "Of course! You can find more information on our [Frequently Asked Questions page](/faq). I'll take you there now.",
                redirect: "/faq" 
            });
        }
        console.log("ℹ️ Help rule was not triggered. Processing with other logic or with AI...");
        // --- Query Summary Logic ---
        const requestSummaryConsultation = (lat && lon && date) &&
        (lowerCaseMessage.includes('information') ||
        lowerCaseMessage.includes('data') ||
        lowerCaseMessage.includes('latitude') ||
        lowerCaseMessage.includes('longitude'));
        if (requestSummaryConsultation) {
            console.log("✅ Summary logic activated.");
            const answerTest = `Of course! Here is the data for the query you have selected:\n\n- **Location:**\n  - Latitude: ${lat}\n  - Longitude: ${lon}\n- **Selected Date:**\n  - Month: ${date.split('-')[0]}\n  - Day: ${date.split('-')[1]}\n- **Condition to Analyze:** ${variable || 'Not selected'}\n\nIf you want me to analyze the weather for this data, just ask something like: "tell me the weather forecast".`;
            return res.json({ text: answerTest });
        }
        // --- Climate Logic ---
        const esConsultaClima = (lat && lon && date) &&
        (lowerCaseMessage.includes('weather') ||
        lowerCaseMessage.includes('pronóstico') ||
        lowerCaseMessage.includes('weather') ||
        lowerCaseMessage.includes('forecast') ||
        lowerCaseMessage.includes('dime'));
        let responseText;
        if (esConsultaClima) {
            console.log("✅ Climate logic activated.");
            const estadisticas = await obtenerEstadisticasHistoricas({ lat: parseFloat(lat), lon: parseFloat(lon) }, date, new Date().getFullYear() - 5, new Date().getFullYear() - 1);
            const resumenDatos = estadisticas.generarTextoResumen();
            const promptMejorado = `Based on the following historical data for the location with latitude ${lat} and longitude ${lon} on the date ${date}, answer the user's question in a friendly and conversational way. Explain what these probabilities mean. Do not mention the years analyzed unless asked.\n\nHistorical Analysis Data:\n${resumenDatos}\n\nUser's question: "${message}"`;
            const response = await chat.sendMessage({ message: promptMejorado });
            responseText = response.text;
        } else {
            console.log("🤖 Sending message to Gemini AI...");
            const response = await chat.sendMessage({ message: message });
            responseText = response.text;
        }
        return res.json({ text: responseText });
    } catch (error) {
        console.error('❌ Error communicating with the Gemini API:', error);
        res.status(500).json({ error: 'Internal server error while processing chat.' });
    }
});
// =================================================================
// THE REST OF THE CODE REMAINS THE SAME
// =================================================================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch((err) => console.error("❌ Error connecting to MongoDB:", err));
// =================================================================
//                   MONGODB SCHEMA AND MODEL
// =================================================================
const ClimateDaySchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }, // 'lluvioso' is not a valid enum value for path `variable`.
    variable: { type: String, required: true, enum: ["warm", "cold", "windy", "dusty", "humid", "incomodo", "rainy", "snowy", "cloudy"] },
    probability: { type: Number, required: true },
    historicalMean: { type: Number, required: true },
    threshold: { type: Number, required: true },
    unit: { type: String, required: true },
    detailDescription: { type: String },
    downloadLink: { type: String },
}, { timestamps: true });
ClimateDaySchema.index({ day: 1, month: 1, lat: 1, lon: 1, variable: 1 });
const ClimateDay = mongoose.model("ClimateDay", ClimateDaySchema);
// --- IMPROVEMENT: New schema to cache calculated historical statistics ---
const HistoricalStatSchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    latIndex: { type: Number, required: true },
    lonIndex: { type: Number, required: true },
    variable: { type: String, required: true },
    mean: { type: Number, required: true },
    p10: { type: Number, required: true },
    p90: { type: Number, required: true },
    stdDev: { type: Number, required: true }, // <-- ADDED: We will save the standard deviation
}, { timestamps: true });
HistoricalStatSchema.index({ day: 1, month: 1, latIndex: 1, lonIndex: 1, variable: 1 });
const HistoricalStat = mongoose.model("HistoricalStat", HistoricalStatSchema);
// =================================================================
//           NASA API CONFIGURATION AND VARIABLES
// =================================================================
// --- FIX: Base URLs updated to use the /hyrax/ structure and be dynamic ---
// They will be used as templates to build the final URL.
const MERRA2_SLV_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXSLV.5.12.4";
const MERRA2_AER_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXAER.5.12.4";
const MERRA2_INT_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXINT.5.12.4"; // <-- ADDED: Dataset for snow
const MERRA2_RAD_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXRAD.5.12.4"; // <-- ADDED: Dataset for clouds/radiation
const GPM_IMERG_URL_TEMPLATE = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07"; // FIX: GPM does not use the /hyrax/ endpoint


const CONFIG_VARIABLES_NASA = {
    warm: {
        apiVariable: "T2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "K",
        // NEW THRESHOLD: The mean plus 1.5 standard deviations.
        threshold: (stats) => stats.mean + 1.5 * stats.stdDev,
        isBelowThresholdWorse: false, // It's worse if it's ABOVE the threshold.
    },
    cold: {
        apiVariable: "T2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "K",
        // NEW THRESHOLD: The mean minus 1.5 standard deviations.
        threshold: (stats) => stats.mean - 1.5 * stats.stdDev,
        isBelowThresholdWorse: true, // It's worse if it's BELOW the threshold.
    },
    windy: {
        apiVariable: ["U10M", "V10M"],
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE, // FIX: Use the correct template for surface variables.
        unit: "m/s",
        threshold: (stats) => stats.mean + 1.5 * stats.stdDev, // Threshold based on the mean
        isBelowThresholdWorse: false,
    },
    dusty: {
        apiVariable: "DUEXTTAU",
        datasetUrlTemplate: MERRA2_AER_URL_TEMPLATE,
        unit: "1 (dimensionless)",
        threshold: (stats) => stats.mean + 2.0 * stats.stdDev, // For dusty, a more extreme threshold
        isBelowThresholdWorse: false,
    },
    humid: {
        apiVariable: "QV2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "kg/kg",
        threshold: (stats) => stats.p90, // We use the 90th percentile as a reference threshold
        isBelowThresholdWorse: false,
    },
    incomodo: {
        apiVariable: ["T2M", "QV2M", "PS"], // Needs Temperature, Specific Humidity, and Pressure
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "°C (Heat Index)",
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    rainy: {
        apiVariable: "precipitation", // FINAL FIX: The variable in GPM IMERG V7 is 'precipitation'.
        datasetUrlTemplate: GPM_IMERG_URL_TEMPLATE,
        unit: "mm/day", // FIX: Add the unit for precipitation
        startYear: 1998, // GPM IMERG data starts in June 1998
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    snowy: {
        apiVariable: "PRECSN", // Snowfall
        datasetUrlTemplate: MERRA2_INT_URL_TEMPLATE,
        unit: "mm/day",
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    cloudy: {
        apiVariable: "CLDTOT", // Total Cloud Fraction
        datasetUrlTemplate: MERRA2_RAD_URL_TEMPLATE,
        unit: "fraction (0-1)", // The API gives it as a fraction (0-1)
        threshold: (stats) => 0.75, // A day is "very cloudy" if its average cloud cover is >= 75%
        isBelowThresholdWorse: false,
    },
};
// =================================================================
//        AUTHENTICATION AND COORDINATE CACHE HANDLING
// =================================================================
const coordinateCache = new Map();
// =================================================================
//                      HELPER FUNCTIONS
// =================================================================
function fetchWithCurl(url, isJson = false) {
    return new Promise((resolve, reject) => {
        const path = require('path');
        const cookieFile = path.join(__dirname, 'nasa-cookies.txt');
        
        // ======================================================= //
        // HERE IS THE MOST IMPORTANT CHANGE
        // Now it looks for .netrc in the project folder (backend/)
        // ======================================================= //
        const netrcFile = path.join(__dirname, '.netrc');
        const args = ['-L', '-k', '--netrc-file', netrcFile, '-c', cookieFile, '-b', cookieFile, url];
        const options = { encoding: isJson ? 'utf8' : 'buffer', maxBuffer: 1024 * 1024 * 50 };
        // ======================================================= //
        //              HERE IS THE FIX
        // 'curl.exe' was changed to 'curl' to work on
        // macOS, Linux, and Windows.
        // ======================================================= //
        execFile('curl', args, options, (error, stdout, stderr) => {
            if (error) {
                const cleanStderr = stderr.toString().split('\n').filter(line => !line.startsWith('  % Total')).join('\n');
                return reject(new Error(`Curl failed: ${cleanStderr || error.message}`));
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
        console.log(`[Cache] Coordinates obtained from cache for ${datasetUrl.slice(-20)}`);
        return coordinateCache.get(datasetUrl);
    }
    console.log(`[NASA API] Getting coordinates for ${datasetUrl.slice(-20)}`);
    // --- IMPROVEMENT: Use the .json response instead of .dods to avoid manual parsing ---
    const coordUrl = `${datasetUrl}.json?lat,lon`;
    try {
        const coordResponse = await fetchWithCurl(coordUrl, true); // true to parse as JSON
        // --- IMPROVEMENT: The structure of GPM and MERRA-2 is different ---
        const latLeaf = coordResponse.leaves?.find(leaf => leaf.name === 'lat') || coordResponse.nodes?.find(n => n.name === 'Grid')?.leaves?.find(l => l.name === 'lat');
        const lonLeaf = coordResponse.leaves?.find(leaf => leaf.name === 'lon') || coordResponse.nodes?.find(n => n.name === 'Grid')?.leaves?.find(l => l.name === 'lon');
        if (!latLeaf || !lonLeaf || !latLeaf.data || !lonLeaf.data) {
            console.error("[DEBUG] Unexpected coordinate response structure:", JSON.stringify(coordResponse, null, 2));
            throw new Error("Could not get dataset coordinates in JSON format. Check the URL in the console.");
        }
        const lats = latLeaf.data;
        const lons = lonLeaf.data;
        
        const coords = { lats, lons };
        coordinateCache.set(datasetUrl, coords);
        return coords;
    } catch (error) {
        // --- IMPROVEMENT: Show the failed URL in the error ---
        console.error(`[ERROR] Coordinate URL that failed: ${coordUrl}`);
        throw error; // Re-throw the original error to be caught by the main route
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
 * --- NEW HELPER FUNCTION ---
 * Determines the correct MERRA-2 file prefix (`100`, `200`, `300`, `400`) based on the year.
 * @param {number} year - The year to query.
 * @returns {string} - The dataset prefix (e.g., "100", "200").
 */
function getMerra2FilePrefix(year) {
    if (year >= 2011) return "400";
    if (year >= 2001) return "300"; // The change to 300 occurs in 2001
    if (year >= 1992) return "200";
    if (year >= 1980) return "100";
    // In case an out-of-range year is used
    return "400";
}
/**
 * --- NEW MAIN FUNCTION ---
 * Gets and calculates historical statistics for a specific point and date,
 * iterating through all available years. It uses a DB cache to avoid
 * recalculation.
 * @param {object} config - La configuración de la variable.
 * @param {number} day - Day of the month.
 * @param {number} month - Month of the year.
 * @param {number} latIndex - Latitude index.
 * @param {number} lonIndex - Longitude index.
 * @returns {Promise<object>} - Object with { mean, p10, p90, values }.
 */
async function getHistoricalStatistics(config, day, month, latIndex, lonIndex) {
    const variableName = Array.isArray(config.apiVariable) ? 'windy' : config.apiVariable;
    // 1. Check the statistics cache in the DB
    const cachedStat = await HistoricalStat.findOne({ day, month, latIndex, lonIndex, variable: variableName });
    if (cachedStat) {
        console.log(`[Cache-Stats] Statistics found in DB for ${day}/${month}. They will be used for the threshold, but the probability will be recalculated.`);
        // Even if we have the statistic, we need the values for the probability.
        // We proceed to calculate them again. The threshold will use the cached value if possible.
    }
    console.log(`[NASA API] Calculating historical statistics for ${day}/${month}. This may take a while...`);
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const allHistoricalValues = [];
    // 2. Iterate through all available years (1980-2016 for this collection)
    const startYear = config.startYear || 1980; // Use the start year from the config, or 1980 by default
    const endYear = new Date().getFullYear(); // Analyze up to the current year
    const yearPromises = [];
    const now = new Date(); // Get the current date once
    for (let year = startYear; year <= endYear; year++) {
        const urlTemplate = config.datasetUrlTemplate;
        const queryDate = new Date(year, month - 1, day);
        // --- IMPROVEMENT: Do not attempt to download data for future or unavailable dates ---
        if (urlTemplate.includes('GPM_3IMERGDF')) {
            // The GPM IMERG "Final" dataset has a delay of ~3.5 months. We use 4 for safety.
            const availabilityDate = new Date(queryDate);
            availabilityDate.setMonth(availabilityDate.getMonth() + 4);
            if (availabilityDate > now) {
                console.log(`[INFO] Search stopped in year ${year} for GPM because data is not yet available (delay of ~3.5 months).`);
                break;
            }
        } else {
            // For other datasets (MERRA-2), we just check that the date is not in the future.
            if (queryDate > now) {
                console.log(`[INFO] Search stopped in year ${year} because the date is in the future.`);
                break;
            }
        }
        let datasetFileName;
        // --- LOGIC TO BUILD URLS FOR MULTIPLE DATASETS ---
        if (urlTemplate.includes('GPM_3IMERGDF')) {
            // File format for GPM IMERG Daily
            // FINAL FIX: Use the validated V07B filename format.
            datasetFileName = `3B-DAY.MS.MRG.3IMERG.${year}${monthStr}${dayStr}-S000000-E235959.V07B.nc4`; // Original and correct filename
        } else {
            // File format for MERRA-2
            const filePrefix = getMerra2FilePrefix(year);
            let datasetType;
            if (config.datasetUrlTemplate.includes('AER')) datasetType = 'aer';
            else if (config.datasetUrlTemplate.includes('INT')) datasetType = 'int';
            else if (config.datasetUrlTemplate.includes('RAD')) datasetType = 'rad';
            else datasetType = 'slv';

            datasetFileName = `MERRA2_${filePrefix}.tavg1_2d_${datasetType}_Nx.${year}${monthStr}${dayStr}.nc4`;
        }

        const baseDatasetUrl = `${urlTemplate}/${year}/${monthStr}/${datasetFileName}`;
        
        // Function to get data for one year.
        const fetchYearData = async (currentUrl) => {
            const fetchData = async (url) => {
                // --- EXISTING LOGIC FOR MERRA-2 ---
                if (Array.isArray(config.apiVariable)) {
                    // --- LOGIC FOR MULTIPLE VARIABLES (windy, incomodo) ---
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
                    if (variableName === 'incomodo') {
                        const [t2mValues, qv2mValues, psValues] = dataArrays;
                        const heatIndexData = t2mValues.map((t_k, i) => {
                            const t_c = t_k - 273.15; // Temperature in Celsius
                            const qv = qv2mValues[i]; // Specific humidity (kg/kg)
                            const p = psValues[i];   // Pressure (Pa)
                            // 1. Calculate saturation vapor pressure (e_s) in hPa
                            const e_s = 6.1094 * Math.exp((17.625 * t_c) / (t_c + 243.04));
                            // 2. Calculate vapor pressure (e) in hPa
                            const e = (qv * (p / 100)) / (0.622 + 0.378 * qv);
                            // 3. Calculate Relative Humidity (RH)
                            const rh = Math.min(100, (e / e_s) * 100);
                            // 4. Calculate Heat Index (HI) - simple formula for T > 26.7°C
                            if (t_c < 26.7) return t_c; // Below ~27°C, HI is equal to the temperature
                            const t_f = t_c * 1.8 + 32; // Convert to Fahrenheit for the formula
                            let hi_f = -42.379 + 2.04901523 * t_f + 10.14333127 * rh - 0.22475541 * t_f * rh - 6.83783e-3 * t_f * t_f - 5.481717e-2 * rh * rh + 1.22874e-3 * t_f * t_f * rh + 8.5282e-4 * t_f * rh * rh - 1.99e-6 * t_f * t_f * rh * rh;
                            return (hi_f - 32) / 1.8; // Convert back to Celsius
                        });
                        console.log(`       Values (Heat Index): [${heatIndexData.map(v => v.toFixed(2)).join(', ')}]`);
                        return heatIndexData;
                    }
                    // If it's not 'incomodo' or 'windy', but it's an array, return empty to avoid errors.
                    return []; 
                } else { // Caso de variable simple
                    let dataUrl; // Simple variable case
                    // --- FIX: The GPM IMERG Daily structure is different ---
                    // It has no time dimension, and the lat/lon order may be different.
                    // The structure is [lon][lat] for this dataset.
                    // --- FINAL FIX: The variable is NOT in a "Grid" node and has no time dimension ---
                    // --- GPM FIX: The structure is [time][lon][lat], the time index [0] must be included. ---
                    if (urlTemplate.includes('GPM_3IMERGDF')) {
                        dataUrl = encodeURI(`${url}.json?${config.apiVariable}[0][${lonIndex}][${latIndex}]`);
                    } else {
                        dataUrl = encodeURI(`${url}.json?${config.apiVariable}[0:1:23][${latIndex}][${lonIndex}]`);
                    }
                    const dataResponse = await fetchWithCurl(dataUrl, true);
                    // The GPM response is different, the data comes in a "Grid" node
                    const dataLeaf = dataResponse.nodes?.[0]?.leaves?.find(l => l.name === config.apiVariable) || dataResponse.nodes?.find(n => n.name === 'Grid')?.leaves?.find(l => l.name === config.apiVariable);
                    if (!dataLeaf?.data) throw new Error("Datos simples incompletos");
                    let simpleData = dataLeaf.data.flat(Infinity); // GPM Daily has a single value
                    
                    // --- UNIT CONVERSION ---
                    if (variableName === 'rainy' && urlTemplate.includes('GPM_3IMERGDF')) {
                        // FIX: GPM Daily (GPM_3IMERGDF) comes in mm/hr. It must be multiplied by 24 to get mm/day.
                        // The value is an array with a single element.
                        simpleData = [simpleData[0] * 24];
                    } else if (config.apiVariable === 'PRECSN') { // Logic for Snow
                        // --- SNOW CONVERSION LOGIC ---
                        // PRECSN is a flux (kg m-2 s-1). To get the daily total in mm:
                        const sumOfHourlyRates = simpleData.reduce((total, rateStr) => total + (parseFloat(rateStr) || 0), 0);
                        const totalNieveDiaria = sumOfHourlyRates * 3600;

                        simpleData = [totalNieveDiaria]; // We return a single daily value.
                    } else if (config.apiVariable === 'T2M') {
                        // --- DIFFERENTIATED LOGIC FOR WARM AND COLD ---
                        if (config.isBelowThresholdWorse === false) { // This is 'warm'
                            // For 'warm', we are interested in the MAXIMUM of the day.
                            const maxTempOfDay = Math.max(...simpleData.filter(v => isFinite(v)));
                            simpleData = isFinite(maxTempOfDay) ? [maxTempOfDay] : [];
                        } else { // This is 'cold'
                            // For 'cold', we are interested in the MINIMUM of the day.
                            const minTempOfDay = Math.min(...simpleData.filter(v => isFinite(v)));
                            simpleData = isFinite(minTempOfDay) ? [minTempOfDay] : [];
                        }
                    } else if (config.apiVariable === 'CLDTOT') {
                        // For 'cloudy', we average the daily cloud fraction. The value remains a fraction (0-1).
                        const sumOfHourlyFractions = simpleData.reduce((total, fracStr) => total + (parseFloat(fracStr) || 0), 0);
                        const averageDailyFraction = sumOfHourlyFractions / simpleData.length;

                        simpleData = [averageDailyFraction]; // Keep as a fraction (0-1)
                    }

                    console.log(`[NASA API] Download for year ${year} completed. URL: ${dataUrl}`);
                    console.log(`       Calculated Daily Total (${config.apiVariable}): [${simpleData[0]?.toFixed(8) || 'ERROR'}]`);
                    return simpleData;
                }
            };
            try {
                return await fetchData(currentUrl);
            } catch (e) {
                // --- IMPROVEMENT: Retry logic for MERRA2_401 ---
                // If the error is due to receiving HTML (a symptom of a 404) and the conditions are met, we retry.
                if (year >= 2011 && currentUrl.includes("MERRA2_400") && e.message.includes("Parece ser una página HTML")) {
                    console.warn(`[WARN] Download with MERRA2_400 failed for year ${year}. Retrying with MERRA2_401...`);
                    const retryUrl = currentUrl.replace("MERRA2_400", "MERRA2_401");
                    return await fetchData(retryUrl).catch(retryError => {
                        console.error(`[ERROR] Retry with MERRA2_401 also failed for year ${year}. Skipping...`);
                        // --- IMPROVEMENT: Log specific URLs on retry failure ---
                        if (Array.isArray(config.apiVariable)) {
                            const failedUrls = config.apiVariable.map(v => encodeURI(`${retryUrl}.json?${v}[0:1:23][${latIndex}][${lonIndex}]`));
                            console.error(`       Failed URLs: ${failedUrls.join(', ')}`);
                        } else {
                            console.error(`       Failed URL: ${encodeURI(`${retryUrl}.json?${config.apiVariable}[0:1:23][${latIndex}][${lonIndex}]`)}`);
                        }
                        return []; // Return empty array to continue
                    });
                }
                // --- REQUESTED IMPROVEMENT: Log the failing URL ---
                let failedUrl;
                if (urlTemplate.includes('GPM_3IMERGDF')) {
                    // --- FIX: Use the correct URL format for GPM in the error log. ---
                    failedUrl = `${baseDatasetUrl}.json?${config.apiVariable}[0][${lonIndex}][${latIndex}]`;
                } else if (Array.isArray(config.apiVariable)) {
                    failedUrl = `${baseDatasetUrl} (para variables ${config.apiVariable.join(', ')})`;
                } else {
                    failedUrl = `${baseDatasetUrl}.json?${config.apiVariable}[0:1:23][${latIndex}][${lonIndex}]`;
                }
                // If a year fails (e.g., file does not exist), we ignore it and continue.
                console.warn(`[WARN] Could not get data for year ${year}. Skipping...`);
                console.warn(`       Failed URL: ${failedUrl}`);
                return [];
            }
        };
        yearPromises.push(fetchYearData(baseDatasetUrl));
    }
    // 3. Execute all requests in parallel and collect the data
    const yearlyData = await Promise.all(yearPromises);
    yearlyData.forEach(values => allHistoricalValues.push(...values.filter(isFinite)));
    if (allHistoricalValues.length === 0) {
        throw new Error(`No valid historical data found for the date ${day}/${month} in all queried years.`);
    }
    // 4. Calculate statistics on the complete dataset
    allHistoricalValues.sort((a, b) => a - b);
    const mean = allHistoricalValues.reduce((a, b) => a + b, 0) / allHistoricalValues.length;
    const p10 = allHistoricalValues[Math.floor(allHistoricalValues.length * 0.10)];
    const p90 = allHistoricalValues[Math.floor(allHistoricalValues.length * 0.90)];
    // --- NEW CALCULATION: Standard Deviation ---
    const variance = allHistoricalValues.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (allHistoricalValues.length - 1);
    const stdDev = Math.sqrt(variance);
    console.log(`[Stats] Final historical average calculated: ${mean.toFixed(4)}`);
    const stats = { mean, p10, p90, stdDev, values: allHistoricalValues, fromCache: !!cachedStat };
    // 5. Save the new statistics to the DB cache
    if (!cachedStat) { // Only save if it didn't exist in the cache
        const newStat = new HistoricalStat({
            day, month, latIndex, lonIndex, variable: variableName,
            mean: stats.mean, p10: stats.p10, p90: stats.p90, stdDev: stats.stdDev
        });
        await newStat.save();
        console.log(`[Cache-Stats] New statistics saved to the DB.`);
    }
    return stats;
}
// =================================================================
//                          API MAIN ROUTE
// =================================================================
app.post("/api/climate-probability", async (req, res) => {
    const { lat, lon, day, month, variable } = req.body;
    // --- IMPROVEMENT: Implement caching logic with the database ---
    try {
        // --- CACHE FIX: Round coordinates for a more effective cache ---
        const latRounded = parseFloat(lat.toFixed(2));
        const lonRounded = parseFloat(lon.toFixed(2));
        const cachedResult = await ClimateDay.findOne({ lat: latRounded, lon: lonRounded, day, month, variable });
        if (cachedResult) {
            console.log(`[Cache] Result found in the database for ${variable} at (Lat:${latRounded}, Lon:${lonRounded})`);
            return res.json(cachedResult); // Return the cached result and end execution.
        }
    } catch (cacheError) {
        console.error("[Cache] Error searching the database cache:", cacheError.message);
    }
    try {
        const config = CONFIG_VARIABLES_NASA[variable];
        if (!config) {
            return res.status(400).json({ success: false, message: `Variable '${variable}' is not supported.` });
        }
        // --- FIX: Define date variables at the beginning ---
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        console.log(`\n[Request] Procesando: ${variable} para ${day}/${month} en (Lat:${lat}, Lon:${lon})`);
        let referenceDatasetUrl;
        if (config.datasetUrlTemplate.includes('GPM_3IMERGDF')) {
            // For GPM, the grid is constant, we can use any valid file.
            // --- IMPROVEMENT: Use a fixed, known-to-exist date for the coordinate reference ---
            const referenceDatasetFileName = `3B-DAY.MS.MRG.3IMERG.20230101-S000000-E235959.V07B.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/2023/01/${referenceDatasetFileName}`;
        } else {
            // For MERRA-2, we use a reference year to get the grid.
            const referenceYear = '2016';
            let datasetType;
            if (config.datasetUrlTemplate.includes('AER')) datasetType = 'aer';
            else if (config.datasetUrlTemplate.includes('INT')) datasetType = 'int';
            else if (config.datasetUrlTemplate.includes('RAD')) datasetType = 'rad';
            else datasetType = 'slv';

            const referenceFilePrefix = getMerra2FilePrefix(referenceYear);
            const referenceDatasetFileName = `MERRA2_${referenceFilePrefix}.tavg1_2d_${datasetType}_Nx.${referenceYear}${monthStr}${dayStr}.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/${referenceYear}/${monthStr}/${referenceDatasetFileName}`;
        }
        // 1. Get coordinates and find indices
        const { lats, lons } = await getCoordinates(referenceDatasetUrl);
        const latIndex = findClosestIndex(lat, lats);
        const lonIndex = findClosestIndex(lon, lons);
        console.log(`[Index] Indices found -> Lat: ${latIndex}, Lon: ${lonIndex}`);
        // 2. Get historical statistics (from DB or by calculating them)
        const stats = await getHistoricalStatistics(config, day, month, latIndex, lonIndex);
        
        // --- FIX: Use the actual threshold from the config function ---
        // This ensures that fixed values (like 0.75 for 'cloudy') are sent correctly.
        const displayThreshold = config.threshold(stats);
        // --- ABSOLUTE PROBABILITY LOGIC (GENERAL) ---
        // Maps a value from one range to another (e.g., temperature to a percentage)
        const mapRange = (value, in_min, in_max, out_min, out_max) => {
            return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
        };
        let probability;
        // Absolute scales for each variable
        switch (variable) {
            case 'warm': // Adjusted scale for higher sensitivity: 24°C (297.15K) to 32°C (305.15K)
                probability = mapRange(stats.mean, 297.15, 305.15, 0, 100);
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
            case 'incomodo': // Heat Index scale from 27°C to 41°C
                probability = mapRange(stats.mean, 27, 41, 0, 100);
                break;
            case 'rainy': {
                // --- FIX: Probability of rain is based on frequency, not average amount ---
                // We count how many days in the history had significant precipitation (> 0.2 mm/day)
                // and apply Laplace smoothing (add-one smoothing) to avoid 0% or 100% probabilities.
                const diasConLluvia = stats.values.filter(p => p > 0.2).length;
                const totalDias = stats.values.length;
                // Formula: ((hits + 1) / (total attempts + 2)) * 100
                probability = totalDias > 0 ? ((diasConLluvia + 1) / (totalDias + 2)) * 100 : 0;
                break;
            }
            case 'snowy': {
                // Adjusted scale: 0 mm/day -> 0%, 10 mm/day (~10 cm of snow) -> 100%
                probability = mapRange(stats.mean, 0, 10, 0, 100);
                break;
            }
            case 'cloudy':
                // --- NEW LOGIC: Probability of cloudy is based on frequency, not average amount ---
                // We count how many days in the history had significant cloudiness (>= 0.75)
                const diasNublados = stats.values.filter(c => c >= 0.75).length;
                const totalDiasNubes = stats.values.length;
                // Laplace smoothing to avoid 0% or 100%
                probability = totalDiasNubes > 0 ? ((diasNublados + 1) / (totalDiasNubes + 2)) * 100 : 0;
                break;
            default:
                // Fallback in case a variable is added without a defined scale
                probability = 0;
        }
        // Ensure the probability is between 0 and 100
        probability = Math.max(0, Math.min(100, Math.round(probability)));
        // 4. Format and send response
        // --- FIX: Make the historical range dynamic based on the variable ---
        const startYear = config.startYear || 1980;
        const historicalRange = `${startYear}-${new Date().getFullYear()}`;
        const detailDescription = `The probability of the '${variable}' condition occurring is ${probability}%, based on the historical average of ${stats.mean.toFixed(2)} ${config.unit} for the range ${historicalRange}.`;
        const result = {
            success: true,
            location: `(Lat: ${lats[latIndex].toFixed(2)}, Lon: ${lons[lonIndex].toFixed(2)})`,
            date: `${day}/${month}`,
            variable: variable,
            probability: probability,
            historicalMean: parseFloat(stats.mean.toFixed(4)), // IMPROVEMENT: Send more decimals to the frontend
            threshold: parseFloat(displayThreshold.toFixed(4)), // Send the correct threshold with more precision
            unit: config.unit,
            detailDescription: detailDescription,
            downloadLink: "https://disc.gsfc.nasa.gov/datasets/M2T1NXSLV_5.12.4/summary" // Generic link to the collection
        };
        
        // 5. Save the final result to the DB for the user
        try {
            // --- CACHE FIX: Save with rounded coordinates ---
            const latRounded = parseFloat(lat.toFixed(2));
            const lonRounded = parseFloat(lon.toFixed(2));
            const record = new ClimateDay({ ...result, lat: latRounded, lon: lonRounded, day, month });
            await record.save();
            console.log("[DB] Result successfully saved to the database.");
            // --- FIX: Send the response AFTER saving to the DB ---
            res.json(result);
        } catch (dbError) {
            console.error("[DB] Error saving the result:", dbError.message);
            // If saving fails, we still send the result to the user.
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
//              NEW DOWNLOAD DATA ROUTE
// =================================================================
app.get("/api/download-data", async (req, res) => {
    const { lat, lon, day, month, variable, format, displayUnit } = req.query; // <-- ADD: Read displayUnit

    if (!lat || !lon || !day || !month || !variable || !format) {
        return res.status(400).json({ success: false, message: "Missing required query parameters: lat, lon, day, month, variable, format." });
    }

    console.log(`\n[Download Request] Preparing raw data for ${variable} on ${day}/${month} at (Lat:${lat}, Lon:${lon})`);

    try {
        const config = CONFIG_VARIABLES_NASA[variable];
        if (!config) {
            return res.status(400).json({ success: false, message: `Variable '${variable}' is not supported.` });
        }

        // --- Reusing existing logic to get data ---
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        let referenceDatasetUrl;
        if (config.datasetUrlTemplate.includes('GPM_3IMERGDF')) {
            const referenceDatasetFileName = `3B-DAY.MS.MRG.3IMERG.20230101-S000000-E235959.V07B.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/2023/01/${referenceDatasetFileName}`;
        } else {
            const referenceYear = '2016';
            let datasetType = config.datasetUrlTemplate.includes('AER') ? 'aer' : (config.datasetUrlTemplate.includes('INT') ? 'int' : (config.datasetUrlTemplate.includes('RAD') ? 'rad' : 'slv'));
            const referenceFilePrefix = getMerra2FilePrefix(referenceYear);
            const referenceDatasetFileName = `MERRA2_${referenceFilePrefix}.tavg1_2d_${datasetType}_Nx.${referenceYear}${monthStr}${dayStr}.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/${referenceYear}/${monthStr}/${referenceDatasetFileName}`;
        }

        const { lats, lons } = await getCoordinates(referenceDatasetUrl);
        const latIndex = findClosestIndex(lat, lats);
        const lonIndex = findClosestIndex(lon, lons);

        const stats = await getHistoricalStatistics(config, parseInt(day), parseInt(month), latIndex, lonIndex);

        // --- FIX: Convert temperature units for the downloaded file ---
        let finalValues = stats.values;
        let finalUnit = config.unit;

        if ((variable === 'warm' || variable === 'cold') && config.unit === 'K' && displayUnit) {
            if (displayUnit.toUpperCase() === 'C') {
                finalValues = stats.values.map(k => k - 273.15);
                finalUnit = '°C';
                console.log(`[Download] Converting ${stats.values.length} values to Celsius.`);
            } else if (displayUnit.toUpperCase() === 'F') {
                finalValues = stats.values.map(k => (k - 273.15) * 9 / 5 + 32);
                finalUnit = '°F';
                console.log(`[Download] Converting ${stats.values.length} values to Fahrenheit.`);
            }
        }
        // --- End of fix ---

        if (format.toLowerCase() === 'json') {
            const filename = `AstroCast_data_${variable}_${day}-${month}.json`;
            const jsonData = JSON.stringify({
                query: { lat, lon, day, month, variable },
                unit: finalUnit,
                historicalValues: finalValues.map(v => parseFloat(v.toFixed(2))) // Round for cleaner output
            }, null, 2); // Pretty-print the JSON

            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            res.setHeader('Content-Type', 'application/json');
            res.send(jsonData);
        } else {
            res.status(400).json({ success: false, message: `Format '${format}' is not supported. Please use 'json'.` });
        }
    } catch (error) {
        console.error("❌ FATAL ERROR IN DOWNLOAD ROUTE:", error.message);
        res.status(500).json({ success: false, message: "Internal server error while preparing data for download.", error: error.message });
    }
});
// =================================================================
//              ADDITIONAL ROUTES AND SERVER STARTUP
// =================================================================
/**
 * UTILITY ROUTE: Deletes all documents from the ClimateDay collection.
 * Useful for cleaning the database during development.
 * To use it, you can make a DELETE request from Postman or curl to:
 * http://localhost:3001/api/clear-cache
 */
app.delete("/api/clear-cache", async (req, res) => {
    try {
        // --- IMPROVEMENT: Add cleaning for both caches ---
        const climateResult = await ClimateDay.deleteMany({});
        const statsResult = await HistoricalStat.deleteMany({});
        const message = `Cache cleared: ${climateResult.deletedCount} climate results and ${statsResult.deletedCount} statistics records deleted.`;
        console.log(`[Cache] ${message}`);
        res.json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error clearing the cache.", error: error.message });
    }
});
app.get("/", (req, res) => {
    res.send("AstroCast API Server (OPeNDAP) is running.");
});
app.listen(port, () => {
    console.log(`\n🚀 AstroCast API server running on http://localhost:${port}`);
    console.log(`   Make sure your environment variables (.env) are configured.`);
});