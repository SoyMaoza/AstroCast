const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const {
    CONFIG_VARIABLES_NASA,
    getHistoricalStatisticsForVariable
} = require('./index.js');

const router = express.Router();

const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const modelName = "gemini-2.5-flash";
let chat = null;

function initializeChat() {
    console.log(`Inicializando sesión de chat con el modelo ${modelName}...`);
    chat = ai.chats.create({
        model: modelName,
        config: {
            systemInstruction: "You are a friendly and helpful chatbot assistant, designed to answer questions concisely. If asked for user information or help-related topics, you must respond with a message that includes a Markdown hyperlink: Help Page. Preferably, your answers should not be too long. You are allowed to provide information about the user's location if requested, using only the data you have access to. If asked for the location, also provide the place corresponding to the coordinates. For example, if given a latitude and longitude, convert it to the corresponding location.",
        },
    });
}
initializeChat();

router.post('/', async (req, res) => {
    console.log("\n\n--- New Request to /api/chat ---");
    console.log("Request body received:", req.body);

    let { message, lat, lon, day, month, variable, activity } = req.body;

    if (!message) {
        console.log("❌ Error: Message is empty or does not exist.");
        return res.status(400).json({ error: 'Message is required.' });
    }

    try {
        const lowerCaseMessage = message.toLowerCase();
        console.log("Lowercase message for analysis:", `"${lowerCaseMessage}"`);

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

        const pideResumenConsulta = (lat && lon && day && month) &&
        (lowerCaseMessage.includes('mi información') ||
        lowerCaseMessage.includes('mis datos') ||
        lowerCaseMessage.includes('mi latitud') ||
        lowerCaseMessage.includes('dame la informacion') ||
        lowerCaseMessage.includes('mi ubicación') ||
        lowerCaseMessage.includes('cual es mi ubicacion'));

        if (pideResumenConsulta) {
            console.log("✅ Summary Logic activated.");
            const textoRespuesta = `Of course! Here is the data for your selected query:\n\n- **Location:**\n  - Latitude: ${lat}\n  - Longitude: ${lon}\n- **Selected Date:**\n  - Month: ${month}\n  - Day: ${day}\n- **Condition to Analyze:** ${variable || 'Not selected'}\n\nIf you want me to analyze the weather for this data, just ask something like: "tell me the weather forecast".`;
            return res.json({ text: textoRespuesta });
        }

        const nlpPrompt = `
            Analyze the following user message: "${message}".
            Is this a request for a weather probability analysis?
            If yes, extract the location (city/place, and try to correct common spelling mistakes), date (month and day), and the core activity.
            The condition to analyze (like 'rainy', 'warm', 'windy') should be inferred from the activity if not explicit.
            Respond in JSON format.
            If it is a weather query, respond with: {"isWeatherQuery": true, "location": "...", "month": "...", "day": "...", "activity": "..."}.
            If it is NOT a weather query, respond with: {"isWeatherQuery": false}.
            Example for "what's the chance of rain in Culiacan on june 5th for my picnic?": {"isWeatherQuery": true, "location": "Culiacan", "month": "6", "day": "5", "activity": "picnic"}.
        `;

        const nlpResponse = await chat.sendMessage({ message: nlpPrompt });
        let nlpResult;
        try {
            const cleanedResponse = nlpResponse.text.replace(/```json\n|```/g, '').trim();
            nlpResult = JSON.parse(cleanedResponse);
        } catch (e) {
            nlpResult = { isWeatherQuery: false };
        }

        const esConsultaClima = (lat && lon && day && month) &&
        (lowerCaseMessage.includes('clima') ||
        lowerCaseMessage.includes('pronóstico') ||
        lowerCaseMessage.includes('analiza') ||
        lowerCaseMessage.includes('dime'));

        let responseText;

        if (nlpResult.isWeatherQuery) {
            console.log("✅ Natural Language Climate Query Detected:", nlpResult);
            const { location: locationName, month: nlpMonth, day: nlpDay, activity: nlpActivity } = nlpResult;

            if (!locationName || !nlpMonth || !nlpDay) {
                responseText = "I couldn't fully understand your request. Please specify a location, month, and day.";
                return res.json({ text: responseText });
            }

            const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}`;
            const geoResponse = await axios.get(geocodeUrl, { headers: { 'User-Agent': 'AstroCast/1.0' } });
            if (!geoResponse.data || geoResponse.data.length === 0) {
                responseText = `I'm sorry, I couldn't find the location "${locationName}".`;
                return res.json({ text: responseText });
            }
            const { lat: newLat, lon: newLon } = geoResponse.data[0];

            const availableConditions = Object.keys(CONFIG_VARIABLES_NASA).join(', ');
            const activityPrompt = `For the activity "${nlpActivity}", which of these weather conditions is most relevant? Respond with only one word from this list: ${availableConditions}.`;
            const aiVarResponse = await chat.sendMessage({ message: activityPrompt });
            let determinedVariable = aiVarResponse.text.trim().toLowerCase();

            if (!CONFIG_VARIABLES_NASA[determinedVariable]) determinedVariable = 'rainy';

            const estadisticas = await getHistoricalStatisticsForVariable(determinedVariable, { lat: parseFloat(newLat), lon: parseFloat(newLon) }, parseInt(nlpDay), parseInt(nlpMonth));
            const resumenDatos = estadisticas.generarTextoResumen();

            const finalPrompt = `Based on the historical data for "${determinedVariable}", analyze the weather for "${nlpActivity}" at ${locationName} on ${nlpMonth}-${nlpDay}. Explain in a friendly way.\n\nData:\n${resumenDatos}`;
            const finalResponse = await chat.sendMessage({ message: finalPrompt });
            responseText = finalResponse.text;

        } else if (esConsultaClima) { 
            console.log("✅ Climate Logic activated.");
            const estadisticas = await getHistoricalStatisticsForVariable(variable, { lat: parseFloat(lat), lon: parseFloat(lon) }, day, month);
            const resumenDatos = estadisticas.generarTextoResumen();
            const promptMejorado = `Based on historical data for "${variable}", analyze weather for "${activity || message}" at lat ${lat}, lon ${lon} on ${month}-${day}. Explain probabilities conversationally.\n\nData:\n${resumenDatos}\n\nUser: "${message}"`;
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

module.exports = router;