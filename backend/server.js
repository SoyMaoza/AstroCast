// server.js
require('dotenv').config(); // Carga la clave API del archivo .env
const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = 3000;

// Configuración Básica
app.use(express.json()); 

// Configuración de CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Inicialización de Gemini y Gestión de Sesiones
// 🛑 CORRECCIÓN: PASAMOS LA CLAVE EXPLÍCITAMENTE USANDO process.env 🛑
const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
const ai = new GoogleGenAI({
    apiKey: process.env.API_KEY // --- MEJORA: Usar el nombre de variable correcto del .env ---
});
const MODEL_NAME = "gemini-2.5-flash";

// Objeto para mantener el historial de chat por usuario (simulación de sesiones)
const sessions = {}; 

const getChatSession = (sessionId) => {
    if (!sessions[sessionId]) {
        // Crea una nueva sesión de chat si no existe para ese ID
        sessions[sessionId] = ai.chats.create({ 
            model: MODEL_NAME 
        });
        console.log(`[INFO] Nueva sesión creada para el ID: ${sessionId}`);
    }
    return sessions[sessionId];
};

// --- RUTA PRINCIPAL DE CHAT: /api/chat ---
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;
    const sessionId = req.body.sessionId || 'default_user_test';

    if (!userMessage) {
        return res.status(400).json({ error: 'Falta el campo "message" en el cuerpo de la petición.' });
    }

    console.log(`\n[PETICIÓN] Sesión: ${sessionId} | Mensaje: ${userMessage}`);

    // --- MEJORA: Manejo de errores robusto para streaming ---
    // Configura los headers para una respuesta en streaming (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const chat = getChatSession(sessionId);
        // --- CORRECCIÓN: Enviar el mensaje en el formato de objeto requerido por la API ---
        // La API espera un objeto con una propiedad 'parts' que es un array.
        const result = await chat.sendMessageStream([{ text: userMessage }]);

        // Itera sobre los trozos de la respuesta y los envía al cliente
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            // Formato Server-Sent Event: "data: {json_string}\n\n"
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
    } catch (error) {
        console.error(`[ERROR] en la API de Gemini para sesión ${sessionId}:`, error);
        // Si hay un error, envía un evento de error al cliente antes de cerrar.
        const errorMessage = JSON.stringify({ error: 'Error al contactar al asistente de IA.' });
        res.write(`data: ${errorMessage}\n\n`);
    } finally {
        // Asegúrate de que la conexión siempre se cierre, incluso si hay un error.
        res.end();
    }
});

// 4. Iniciar el Servidor
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor de chat ejecutándose en http://localhost:${PORT}`);
});