// Usando CommonJS:
const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');
const dotenv = require('dotenv');

// --- MEJORA: Importar la lógica del clima ---
const { obtenerEstadisticasHistoricas } = require('./data/Clima.js');


// Cargar variables de entorno del archivo .env
dotenv.config();

const app = express();
const port = 3001;

// Configurar middlewares
app.use(cors()); // Permite peticiones desde el frontend de React (puerto 5173 por defecto)
app.use(express.json()); // Necesario para leer el cuerpo JSON de las peticiones POST

// --- Configuración de Gemini ---
const API_KEY = "AIzaSyCt9sMxyaCMZ0d59Xd2FtZI8QnMJ6bYqCE";
// if (!API_KEY || API_KEY === "AIzaSyCt9sMxyaCMZ0d59Xd2FtZI8QnMJ6bYqCE") {
//     console.error("Error: Por favor, actualiza la GEMINI_API_KEY en el archivo .env");
//     process.exit(1);
// }

const ai = new GoogleGenAI({ apiKey: API_KEY });
const modelName = "gemini-2.5-flash";

// Variable global para mantener la sesión de chat con el historial
let chat = null;

// Función para inicializar la sesión de chat
function initializeChat() {
    console.log(`Inicializando sesión de chat con el modelo ${modelName}...`);
    chat = ai.chats.create({
        model: modelName,
        config: {
            // Instrucción de sistema: define el rol del chatbot
            systemInstruction: "Eres un asistente de chatbot amigable y servicial, diseñado para responder preguntas de forma concisa.",
        },
    });
}

// Inicializar la sesión de chat al iniciar el servidor
initializeChat();

// --- Ruta API de Chat ---
app.post('/api/chat', async (req, res) => {
    // --- MEJORA: Aceptar lat, lon y date desde el frontend ---
    const { message, lat, lon, date, variable } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'El mensaje es requerido.' });
    }

    try {
        // --- MEJORA DEFINITIVA: Detectar si el usuario pide un resumen de su propia consulta ---
        const pideResumenConsulta = (lat && lon && date) && 
                                    (message.toLowerCase().includes('mi información') ||
                                     message.toLowerCase().includes('mis datos') ||
                                     message.toLowerCase().includes('mi latitud') ||
                                     message.toLowerCase().includes('dame la informacion'));

        if (pideResumenConsulta) {
            console.log("Detectada solicitud de resumen de consulta.");
            const textoRespuesta = `¡Claro! Aquí están los datos de la consulta que tienes seleccionada:\n\n- **Ubicación:**\n  - Latitud: ${lat}\n  - Longitud: ${lon}\n- **Fecha seleccionada:**\n  - Mes: ${date.split('-')[0]}\n  - Día: ${date.split('-')[1]}\n- **Condición a Analizar:** ${variable || 'No seleccionada'}\n\nSi quieres que analice el clima para estos datos, solo pregunta algo como: "dime el pronóstico del clima".`;
            return res.json({ text: textoRespuesta });
        }


        // --- MEJORA: Lógica de clima más robusta ---
        // Si se envían lat, lon y date, asumimos que es una consulta de clima.
        const esConsultaClima = (lat && lon && date) && 
                                (message.toLowerCase().includes('clima') || 
                                 message.toLowerCase().includes('pronóstico') ||
                                 message.toLowerCase().includes('analiza') || // Añadimos más palabras clave
                                 message.toLowerCase().includes('dime'));

        if (esConsultaClima) {
            console.log("Detectada consulta de clima. Obteniendo datos históricos...");
            
            // Usamos la fecha y ubicación proporcionadas por el usuario
            const diaDelAnio = date; // Formato esperado "MM-DD"
            const anioActual = new Date().getFullYear();
            const ubicacion = { lat: parseFloat(lat), lon: parseFloat(lon) };

            // Obtenemos las estadísticas de los últimos 5 años
            const estadisticas = await obtenerEstadisticasHistoricas(ubicacion, diaDelAnio, anioActual - 5, anioActual - 1);
            
            // Generamos el resumen de texto que antes se imprimía en consola
            const resumenDatos = estadisticas.generarTextoResumen();

            console.log("Datos para Gemini:", resumenDatos);

            // Creamos un mensaje mejorado para Gemini, dándole los datos y pidiéndole que los explique.
            const promptMejorado = `
                Basándote en los siguientes datos históricos para la ubicación con latitud ${lat} y longitud ${lon} en la fecha ${date}, 
                responde a la pregunta del usuario de una manera amigable y conversacional.
                Explica qué significan estas probabilidades. No menciones los años analizados a menos que te lo pregunten.
                
                Datos del Análisis Histórico:
                ${resumenDatos}

                Pregunta del usuario: "${message}"
            `;
            
            const response = await chat.sendMessage({ message: promptMejorado });
            return res.json({ text: response.text });
        }

        // Si no es una consulta de clima, procedemos con la lógica de chat normal.
        const response = await chat.sendMessage({ message: message });
        return res.json({ text: response.text });

    } catch (error) {
        console.error('Error al comunicarse con la API de Gemini:', error);
        res.status(500).json({ error: 'Error interno del servidor al procesar el chat.' });
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor Node.js escuchando en http://localhost:${port}`);
    console.log("¡Listo para chatear!");
});