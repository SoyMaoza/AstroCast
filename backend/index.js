// =================================================================
//                     IMPORTS Y CONFIGURACIÓN INICIAL
// =================================================================
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

// --- MEJORA: Importar la lógica del clima ---
const { obtenerEstadisticasHistoricas } = require("./data/Clima.js");

dotenv.config();
const app = express();
const port = process.env.PORT || 3001;

// =================================================================
//                           MIDDLEWARES
// =================================================================
app.use(cors());
app.use(express.json());

// =================================================================
//                  CONEXIÓN A MONGODB (opcional)
// =================================================================
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Conectado a MongoDB Atlas"))
    .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));
}

// =================================================================
//                   CONFIGURACIÓN GEMINI
// =================================================================
const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const modelName = "gemini-2.5-flash";
let chat = null;

function initializeChat() {
  console.log(`Inicializando sesión de chat con el modelo ${modelName}...`);
  chat = ai.chats.create({
    model: modelName,
    config: {
      systemInstruction:
        "Eres un asistente de chatbot amigable y servicial. Si te piden ayuda sobre la app, redirígelos a 'http://localhost:5173/info'.",
    },
  });
}
initializeChat();

// =================================================================
//                         RUTA DE CHAT
// =================================================================
app.post("/api/chat", async (req, res) => {
  const { message, lat, lon, date, variable } = req.body;
  if (!message) return res.status(400).json({ error: "El mensaje es requerido." });

  try {
    // Detecta si el usuario pide un resumen de sus propios datos
    const pideResumenConsulta =
      lat &&
      lon &&
      date &&
      (message.toLowerCase().includes("mi información") ||
        message.toLowerCase().includes("mis datos") ||
        message.toLowerCase().includes("mi latitud"));

    if (pideResumenConsulta) {
      const textoRespuesta = `Aquí están los datos que proporcionaste:\n- Latitud: ${lat}\n- Longitud: ${lon}\n- Fecha: ${date}\n- Variable: ${variable || "No seleccionada"}`;
      return res.json({ text: textoRespuesta });
    }

    // Si el mensaje es de clima
    const esConsultaClima =
      lat &&
      lon &&
      date &&
      (message.toLowerCase().includes("clima") ||
        message.toLowerCase().includes("pronóstico") ||
        message.toLowerCase().includes("analiza"));

    if (esConsultaClima) {
      console.log("Consulta de clima detectada...");
      const anioActual = new Date().getFullYear();
      const estadisticas = await obtenerEstadisticasHistoricas(
        { lat: parseFloat(lat), lon: parseFloat(lon) },
        date,
        anioActual - 5,
        anioActual - 1
      );
      const resumenDatos = estadisticas.generarTextoResumen();

      const prompt = `
        Basado en estos datos históricos de lat ${lat}, lon ${lon} y fecha ${date}, 
        responde de forma clara al usuario:
        ${resumenDatos}
        Pregunta del usuario: "${message}"
      `;

      const response = await chat.sendMessage({ message: prompt });
      return res.json({ text: response.text });
    }

    // Chat normal
    const response = await chat.sendMessage({ message });
    return res.json({ text: response.text });
  } catch (error) {
    console.error("❌ Error en chat:", error);
    res.status(500).json({ error: "Error interno en chat." });
  }
});

// =================================================================
//                         ENDPOINT DE CLIMA NASA
// (Se deja toda la lógica que habías armado con fetchWithCurl y stats)
// =================================================================
// 👉 Aquí iría tu código de NASA con CONFIG_VARIABLES_NASA, fetchWithCurl,
// calculateStatistics, etc. como en tu versión larga.
// Ejemplo de ruta:
app.post("/api/climate-probability", async (req, res) => {
  res.json({ message: "Aquí se conecta con NASA (pendiente integrar)." });
});

// =================================================================
//                   ARRANQUE DEL SERVIDOR
// =================================================================
app.get("/", (req, res) => {
  res.send("Servidor AstroCast API está funcionando 🚀");
});

app.listen(port, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${port}`);
});
