
require('dotenv').config();
const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = 3000;

app.use(express.json()); 

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});
const MODEL_NAME = "gemini-2.5-flash";

const sessions = {}; 

const getChatSession = (sessionId) => {
    if (!sessions[sessionId]) {
        sessions[sessionId] = ai.chats.create({ 
            model: MODEL_NAME 
        });
        console.log(`[INFO] Nueva sesión creada para el ID: ${sessionId}`);
    }
    return sessions[sessionId];
};

app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;
    const sessionId = req.body.sessionId || 'default_user_test';

    if (!userMessage) {
        return res.status(400).json({ error: 'Falta el campo "message" en el cuerpo de la petición.' });
    }

    console.log(`\n[PETICIÓN] Sesión: ${sessionId} | Mensaje: ${userMessage}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const chat = getChatSession(sessionId);
        const result = await chat.sendMessageStream([{ text: userMessage }]);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
    } catch (error) {
        console.error(`[ERROR] en la API de Gemini para sesión ${sessionId}:`, error);
        const errorMessage = JSON.stringify({ error: 'Error al contactar al asistente de IA.' });
        res.write(`data: ${errorMessage}\n\n`);
    } finally {
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor de chat ejecutándose en http://localhost:${PORT}`);
});