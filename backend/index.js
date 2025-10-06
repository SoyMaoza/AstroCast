const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');
const dotenv = require('dotenv');
const { obtenerEstadisticasHistoricas } = require('./data/Clima.js');
const { execFile } = require('child_process');
dotenv.config();
const mongoose = require("mongoose");
const app = express();
const port = process.env.PORT || 3001;



const corsOptions = {
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

app.use(express.json());
const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const modelName = "gemini-2.5-flash";
let chat = null;
function initializeChat() {
    console.log(`Initializing chat session with model ${modelName}...`);
    chat = ai.chats.create({
        model: modelName,
        config: {
            systemInstruction: "You are a friendly and helpful chatbot assistant, designed to answer questions concisely. If asked for user information or anything related to help, you should respond with a message that includes the hyperlink in **Markdown** format: Help Page. Preferably, your answers should not be too long. You are allowed to give information about their location if they ask for it, but only the data you have access to.",
        },
    });
}
initializeChat();
app.post('/api/chat', async (req, res) => {
    console.log("\n\n--- New Request to /api/chat ---");
    console.log("Request body received:", req.body);
    const { message, lat, lon, date, variable, activity } = req.body;

    if (!message) {
        console.log("❌ Error: Message is empty or does not exist.");
        return res.status(400).json({ error: 'Message is required.' });
    }

    try {
        const lowerCaseMessage = message.toLowerCase();
        console.log("Lowercase message for analysis:", `"${lowerCaseMessage}"`);

        const esConsultaAyuda = (
            lowerCaseMessage.includes('help') ||
            lowerCaseMessage.includes('support') ||
            lowerCaseMessage.includes('user') ||
            lowerCaseMessage.includes('share') ||
            lowerCaseMessage.includes('record') ||
            lowerCaseMessage.includes('faq') ||
            lowerCaseMessage.includes('question') ||
            lowerCaseMessage.includes('doubt')
        );

        if (esConsultaAyuda) {
            console.log("✅ HELP RULE ACTIVATED! Sending redirect command to /faq.");
            return res.json({
                text: "Of course! You can find more information on our [Frequently Asked Questions page](/faq). I'll take you there now.",
                redirect: "/faq"
            });
        }
        console.log("ℹ️ Help rule was not triggered. Processing with other logic or with AI...");

        const requestSummaryConsultation = (lat && lon && date) &&
        (lowerCaseMessage.includes('information') ||
        lowerCaseMessage.includes('data') ||
        lowerCaseMessage.includes('latitude') ||
        lowerCaseMessage.includes('longitude'));

        if (requestSummaryConsultation) {
            console.log("✅ Summary logic activated.");
            const answerTest = `Of course! Here is the data for the query you have selected:\n\n- **Location:**\n  - Latitude: ${lat}\n  - Longitude: ${lon}\n- **Selected Date:**\n  - Month: ${date.split('-')[0]}\n  - Day: ${date.split('-')[1]}\n- **Condition to Analyze:** ${variable || 'Not selected'}\n- **Activity:** ${activity || 'Not specified'}\n\nIf you want me to analyze the weather for this data, just ask something like: "tell me the weather forecast".`;
            return res.json({ text: answerTest });
        }

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
            const promptMejorado = `Based on the following historical data for the location with latitude ${lat} and longitude ${lon} on the date ${date}, answer the user's question in a friendly and conversational way.
            The user is planning this activity: "${activity || 'no specific activity'}".
            Use the context of the activity to make your recommendations more specific and useful.
            Explain what these probabilities mean for their activity. Do not mention the years analyzed unless asked.\n\nHistorical Analysis Data:\n${resumenDatos}\n\nUser's question: "${message}"`;

            const response = await chat.sendMessage({ message: promptMejorado });
            responseText = response.text;
        } else {
            console.log("🤖 Sending message to Gemini AI...");
            const contextualPrompt = `The user has this context loaded in their session: Location (Lat: ${lat}, Lon: ${lon}), Date: ${date}, Planned Activity: "${activity || 'none'}".
            \nBased on this context, answer the user's question: "${message}"`;
            
            const response = await chat.sendMessage({ message: contextualPrompt });
            responseText = response.text;
        }
        return res.json({ text: responseText });

    } catch (error) {
        console.error('❌ Error communicating with the Gemini API:', error);
        res.status(500).json({ error: 'Internal server error while processing chat.' });
    }
});
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch((err) => console.error("❌ Error connecting to MongoDB:", err));
const ClimateDaySchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
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
const HistoricalStatSchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    latIndex: { type: Number, required: true },
    lonIndex: { type: Number, required: true },
    variable: { type: String, required: true },
    mean: { type: Number, required: true },
    p10: { type: Number, required: true },
    p90: { type: Number, required: true },
    stdDev: { type: Number, required: true },
}, { timestamps: true });
HistoricalStatSchema.index({ day: 1, month: 1, latIndex: 1, lonIndex: 1, variable: 1 });
const HistoricalStat = mongoose.model("HistoricalStat", HistoricalStatSchema);
const MERRA2_SLV_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXSLV.5.12.4";
const MERRA2_AER_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXAER.5.12.4";
const MERRA2_INT_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXINT.5.12.4";
const MERRA2_RAD_URL_TEMPLATE = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/hyrax/MERRA2/M2T1NXRAD.5.12.4";
const GPM_IMERG_URL_TEMPLATE = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07";


const CONFIG_VARIABLES_NASA = {
    warm: {
        apiVariable: "T2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "K",
        threshold: (stats) => stats.mean + 1.5 * stats.stdDev,
        isBelowThresholdWorse: false,
    },
    cold: {
        apiVariable: "T2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "K",
        threshold: (stats) => stats.mean - 1.5 * stats.stdDev,
        isBelowThresholdWorse: true,
    },
    windy: {
        apiVariable: ["U10M", "V10M"],
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "m/s",
        threshold: (stats) => stats.mean + 1.5 * stats.stdDev,
        isBelowThresholdWorse: false,
    },
    dusty: {
        apiVariable: "DUEXTTAU",
        datasetUrlTemplate: MERRA2_AER_URL_TEMPLATE,
        unit: "(dimensionless)",
        threshold: (stats) => stats.mean + 2.0 * stats.stdDev,
        isBelowThresholdWorse: false,
    },
    humid: {
        apiVariable: "QV2M",
        datasetUrlTemplate: MERRA2_SLV_URL_TEMPLATE,
        unit: "kg/kg",
        threshold: (stats) => stats.p90,
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
        apiVariable: "precipitation",
        datasetUrlTemplate: GPM_IMERG_URL_TEMPLATE,
        unit: "mm/day",
        startYear: 1998,
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    snowy: {
        apiVariable: "PRECSN",
        datasetUrlTemplate: MERRA2_INT_URL_TEMPLATE,
        unit: "mm/day",
        threshold: (stats) => stats.p90,
        isBelowThresholdWorse: false,
    },
    cloudy: {
        apiVariable: "CLDTOT",
        datasetUrlTemplate: MERRA2_RAD_URL_TEMPLATE,
        unit: "fraction (0-1)",
        threshold: (stats) => 0.75,
        isBelowThresholdWorse: false,
    },
};
const coordinateCache = new Map();
function fetchWithCurl(url, isJson = false) {
    return new Promise((resolve, reject) => {
        const path = require('path');
        const cookieFile = path.join(__dirname, 'nasa-cookies.txt');
        const netrcFile = path.join(__dirname, '.netrc');
        const args = ['-L', '-k', '--netrc-file', netrcFile, '-c', cookieFile, '-b', cookieFile, url];
        const options = { encoding: isJson ? 'utf8' : 'buffer', maxBuffer: 1024 * 1024 * 50 };
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
    const coordUrl = `${datasetUrl}.json?lat,lon`;
    try {
        const coordResponse = await fetchWithCurl(coordUrl, true); // true to parse as JSON
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
        console.error(`[ERROR] Coordinate URL that failed: ${coordUrl}`);
        throw error;
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
function getMerra2FilePrefix(year) {
    if (year >= 2011) return "400";
    if (year >= 2001) return "300";
    if (year >= 1992) return "200";
    if (year >= 1980) return "100";
    return "400";
}
async function getHistoricalStatistics(config, day, month, latIndex, lonIndex) {
    const variableName = Array.isArray(config.apiVariable) ? 'windy' : config.apiVariable;
    const cachedStat = await HistoricalStat.findOne({ day, month, latIndex, lonIndex, variable: variableName });
    if (cachedStat) {
        console.log(`[Cache-Stats] Statistics found in DB for ${day}/${month}. They will be used for the threshold, but the probability will be recalculated.`);
    }
    console.log(`[NASA API] Calculating historical statistics for ${day}/${month}. This may take a while...`);
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const allHistoricalValues = [];
    const startYear = config.startYear || 1980;
    const endYear = new Date().getFullYear();
    const yearPromises = [];
    const now = new Date();
    for (let year = startYear; year <= endYear; year++) {
        const urlTemplate = config.datasetUrlTemplate;
        const queryDate = new Date(year, month - 1, day);
        if (urlTemplate.includes('GPM_3IMERGDF')) {
            const availabilityDate = new Date(queryDate);
            availabilityDate.setMonth(availabilityDate.getMonth() + 4);
            if (availabilityDate > now) {
                console.log(`[INFO] Search stopped in year ${year} for GPM because data is not yet available (delay of ~3.5 months).`);
                break;
            }
        } else {
            if (queryDate > now) {
                console.log(`[INFO] Search stopped in year ${year} because the date is in the future.`);
                break;
            }
        }
        let datasetFileName;
        if (urlTemplate.includes('GPM_3IMERGDF')) {
            datasetFileName = `3B-DAY.MS.MRG.3IMERG.${year}${monthStr}${dayStr}-S000000-E235959.V07B.nc4`;
        } else {
            const filePrefix = getMerra2FilePrefix(year);
            let datasetType;
            if (config.datasetUrlTemplate.includes('AER')) datasetType = 'aer';
            else if (config.datasetUrlTemplate.includes('INT')) datasetType = 'int';
            else if (config.datasetUrlTemplate.includes('RAD')) datasetType = 'rad';
            else datasetType = 'slv';

            datasetFileName = `MERRA2_${filePrefix}.tavg1_2d_${datasetType}_Nx.${year}${monthStr}${dayStr}.nc4`;
        }

        const baseDatasetUrl = `${urlTemplate}/${year}/${monthStr}/${datasetFileName}`;
        
        const fetchYearData = async (currentUrl) => {
            const fetchData = async (url) => {
                if (Array.isArray(config.apiVariable)) {
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
                            const t_c = t_k - 273.15;
                            const qv = qv2mValues[i];
                            const p = psValues[i];
                            const e_s = 6.1094 * Math.exp((17.625 * t_c) / (t_c + 243.04));
                            const e = (qv * (p / 100)) / (0.622 + 0.378 * qv);
                            const rh = Math.min(100, (e / e_s) * 100);
                            if (t_c < 26.7) return t_c;
                            const t_f = t_c * 1.8 + 32;
                            let hi_f = -42.379 + 2.04901523 * t_f + 10.14333127 * rh - 0.22475541 * t_f * rh - 6.83783e-3 * t_f * t_f - 5.481717e-2 * rh * rh + 1.22874e-3 * t_f * t_f * rh + 8.5282e-4 * t_f * rh * rh - 1.99e-6 * t_f * t_f * rh * rh;
                            return (hi_f - 32) / 1.8;
                        });
                        console.log(`       Values (Heat Index): [${heatIndexData.map(v => v.toFixed(2)).join(', ')}]`);
                        return heatIndexData;
                    }
                    return []; 
                } else {
                    let dataUrl;
                    if (urlTemplate.includes('GPM_3IMERGDF')) {
                        dataUrl = encodeURI(`${url}.json?${config.apiVariable}[0][${lonIndex}][${latIndex}]`);
                    } else {
                        dataUrl = encodeURI(`${url}.json?${config.apiVariable}[0:1:23][${latIndex}][${lonIndex}]`);
                    }
                    const dataResponse = await fetchWithCurl(dataUrl, true);
                    const dataLeaf = dataResponse.nodes?.[0]?.leaves?.find(l => l.name === config.apiVariable) || dataResponse.nodes?.find(n => n.name === 'Grid')?.leaves?.find(l => l.name === config.apiVariable);
                    if (!dataLeaf?.data) throw new Error("Datos simples incompletos");
                    let simpleData = dataLeaf.data.flat(Infinity);
                    
                    if (variableName === 'rainy' && urlTemplate.includes('GPM_3IMERGDF')) {
                        simpleData = [simpleData[0] * 24];
                    } else if (config.apiVariable === 'PRECSN') {
                        const sumOfHourlyRates = simpleData.reduce((total, rateStr) => total + (parseFloat(rateStr) || 0), 0);
                        const totalNieveDiaria = sumOfHourlyRates * 3600;

                        simpleData = [totalNieveDiaria];
                    } else if (config.apiVariable === 'T2M') {
                        if (config.isBelowThresholdWorse === false) {
                            const maxTempOfDay = Math.max(...simpleData.filter(v => isFinite(v)));
                            simpleData = isFinite(maxTempOfDay) ? [maxTempOfDay] : [];
                        } else {
                            const minTempOfDay = Math.min(...simpleData.filter(v => isFinite(v)));
                            simpleData = isFinite(minTempOfDay) ? [minTempOfDay] : [];
                        }
                    } else if (config.apiVariable === 'CLDTOT') {
                        const sumOfHourlyFractions = simpleData.reduce((total, fracStr) => total + (parseFloat(fracStr) || 0), 0);
                        const averageDailyFraction = sumOfHourlyFractions / simpleData.length;

                        simpleData = [averageDailyFraction];
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
app.post("/api/climate-probability", async (req, res) => {
    const { lat, lon, day, month, variable } = req.body;
    try {
        const latRounded = parseFloat(lat.toFixed(2));
        const lonRounded = parseFloat(lon.toFixed(2));
        const cachedResult = await ClimateDay.findOne({ lat: latRounded, lon: lonRounded, day, month, variable });
        if (cachedResult) {
            console.log(`[Cache] Result found in the database for ${variable} at (Lat:${latRounded}, Lon:${lonRounded})`);
            return res.json(cachedResult);
        }
    } catch (cacheError) {
        console.error("[Cache] Error searching the database cache:", cacheError.message);
    }
    try {
        const config = CONFIG_VARIABLES_NASA[variable];
        if (!config) {
            return res.status(400).json({ success: false, message: `Variable '${variable}' is not supported.` });
        }
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        console.log(`\n[Request] Procesando: ${variable} para ${day}/${month} en (Lat:${lat}, Lon:${lon})`);
        let referenceDatasetUrl;
        if (config.datasetUrlTemplate.includes('GPM_3IMERGDF')) {
            const referenceDatasetFileName = `3B-DAY.MS.MRG.3IMERG.20230101-S000000-E235959.V07B.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/2023/01/${referenceDatasetFileName}`;
        } else {
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
        const { lats, lons } = await getCoordinates(referenceDatasetUrl);
        const latIndex = findClosestIndex(lat, lats);
        const lonIndex = findClosestIndex(lon, lons);
        console.log(`[Index] Indices found -> Lat: ${latIndex}, Lon: ${lonIndex}`);
        const stats = await getHistoricalStatistics(config, day, month, latIndex, lonIndex);
        
        const displayThreshold = config.threshold(stats);
        const mapRange = (value, in_min, in_max, out_min, out_max) => {
            return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
        };
        let probability;
        switch (variable) {
            case 'warm':
                probability = mapRange(stats.mean, 293.15, 308.15, 0, 100);
                break;
            case 'cold':
                probability = mapRange(stats.mean, 293.15, 273.15, 0, 100);
                break;
            case 'windy':
                probability = mapRange(stats.mean, 0, 15, 0, 100);
                break;
            case 'dusty':
                probability = mapRange(stats.mean, 0, 0.1, 0, 100);
                break;
            case 'humid':
                probability = mapRange(stats.mean, 0.005, 0.020, 0, 100);
                break;
            case 'incomodo':
                probability = mapRange(stats.mean, 27, 41, 0, 100);
                break;
            case 'rainy': {
                const diasConLluvia = stats.values.filter(p => p > 0.2).length;
                const totalDias = stats.values.length;
                probability = totalDias > 0 ? ((diasConLluvia + 1) / (totalDias + 2)) * 100 : 0;
                break;
            }
            case 'snowy': {
                probability = mapRange(stats.mean, 0, 10, 0, 100);
                break;
            }
            case 'cloudy':
                const diasNublados = stats.values.filter(c => c >= 0.75).length;
                const totalDiasNubes = stats.values.length;
                probability = totalDiasNubes > 0 ? ((diasNublados + 1) / (totalDiasNubes + 2)) * 100 : 0;
                break;
            default:
                probability = 0;
        }
        probability = Math.max(0, Math.min(100, Math.round(probability)));
        const startYear = config.startYear || 1980;
        const historicalRange = `${startYear}-${new Date().getFullYear()}`;
        const detailDescription = `The probability of the '${variable}' condition occurring is ${probability}%, based on the historical average of ${stats.mean.toFixed(2)} ${config.unit} for the range ${historicalRange}.`;
        const result = {
            success: true,
            location: `(Lat: ${lats[latIndex].toFixed(2)}, Lon: ${lons[lonIndex].toFixed(2)})`,
            date: `${day}/${month}`,
            variable: variable,
            probability: probability,
            historicalMean: parseFloat(stats.mean.toFixed(4)),
            threshold: parseFloat(displayThreshold.toFixed(4)),
            unit: config.unit,
            detailDescription: detailDescription,
            downloadLink: "https://disc.gsfc.nasa.gov/datasets/M2T1NXSLV_5.12.4/summary"
        };
        
        try {
            const latRounded = parseFloat(lat.toFixed(2));
            const lonRounded = parseFloat(lon.toFixed(2));
            const record = new ClimateDay({ ...result, lat: latRounded, lon: lonRounded, day, month });
            await record.save();
            console.log("[DB] Result successfully saved to the database.");
            res.json(result);
        } catch (dbError) {
            console.error("[DB] Error saving the result:", dbError.message);
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
app.get("/api/download-data", async (req, res) => {
    const { lat, lon, day, month, variable, format, displayUnit } = req.query;

    if (!lat || !lon || !day || !month || !variable || !format) {
        return res.status(400).json({ success: false, message: "Missing required query parameters: lat, lon, day, month, variable, format." });
    }

    console.log(`\n[Download Request] Preparing raw data for ${variable} on ${day}/${month} at (Lat:${lat}, Lon:${lon})`);

    try {
        const config = CONFIG_VARIABLES_NASA[variable];
        if (!config) {
            return res.status(400).json({ success: false, message: `Variable '${variable}' is not supported.` });
        }

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

        if (format.toLowerCase() === 'json') {
            const filename = `AstroCast_data_${variable}_${day}-${month}.json`;
            const jsonData = JSON.stringify({
                query: { lat, lon, day, month, variable },
                unit: finalUnit,
                historicalValues: finalValues.map(v => parseFloat(v.toFixed(2)))
            }, null, 2);

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
app.delete("/api/clear-cache", async (req, res) => {
    try {
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