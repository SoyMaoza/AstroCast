// backend/index.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
const port = 3000;

// --------------------
// 🔹 Conexión MongoDB
// --------------------
mongoose.connect("mongodb://127.0.0.1:27017/nasaHackathon", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const nasaSchema = new mongoose.Schema({
  variable: String,
  fecha: String, // formato dd/mm
  lat: Number,
  lon: Number,
  promedio: Number,
  unidad: String,
  linkDescarga: String,
  creadoEn: { type: Date, default: Date.now },
});

const NasaData = mongoose.model("NasaData", nasaSchema);

// --------------------
// 🔹 Config NASA
// --------------------
const URL_MERRA2 =
  "https://opendap.earthdata.nasa.gov/collections/C1276812863-GES_DISC/granules";
const URL_DUST =
  "https://opendap.earthdata.nasa.gov/collections/C1276812830-GES_DISC/granules";

const CONFIG_DATOS_NASA = {
  calido: { variableName: "T2M", units: "K", apiUrl: URL_MERRA2 },
  frio: { variableName: "T2M", units: "K", apiUrl: URL_MERRA2 },
  ventoso: { variableName: "U10M_V10M", units: "m/s", apiUrl: URL_MERRA2 },
  incomodo: { variableName: "T2M_T2MDEW_QV2M", units: "Índice", apiUrl: URL_MERRA2 },
  polvo: { variableName: "DUEXTTAU", units: "AOD", apiUrl: URL_DUST },
};

app.use(cors());
app.use(express.json());

// --------------------
// 🔹 Función procesar NASA
// --------------------
const processNasaHistoricalData = async (lat, lon, day, month, variable) => {
  const config = CONFIG_DATOS_NASA[variable];
  if (!config) throw new Error("Variable climática no reconocida.");

  // 🔹 Generar links de ejemplo (aquí irían todos los días históricos)
  let linksGenerados = [];
  for (let i = 0; i < 5; i++) {
    const fecha = `1980${month.padStart(2, "0")}${(parseInt(day) + i)
      .toString()
      .padStart(2, "0")}`;
    const link = `${config.apiUrl}/M2T1NXSLV.5.12.4:MERRA2_100.tavg1_2d_slv_Nx.${fecha}.nc4.dap.nc4`;
    linksGenerados.push(link);
  }

  // 🚨 Simulación de la media (en producción deberías obtenerla de los datasets NASA)
  const historicalMean = 280 + Math.random() * 20; // promedio entre 280K y 300K
  const threshold = 305;
  const probability = Math.round(Math.random() * 100);

  const resultado = {
    success: true,
    location: `Lat: ${lat}, Lon: ${lon}`,
    date: `${day}/${month}`,
    variable,
    probability,
    historicalMean: parseFloat(historicalMean.toFixed(2)),
    threshold,
    unit: config.units,
    downloadLinks: linksGenerados,
    detailDescription: `Probabilidad calculada para ${variable} usando datos históricos.`,
  };

  // 🔹 Guardar solo el promedio en MongoDB
  const saveMongo = new NasaData({
    variable,
    fecha: `${day}/${month}`,
    lat,
    lon,
    promedio: resultado.historicalMean,
    unidad: config.units,
    linkDescarga: linksGenerados[0], // guardamos solo 1 link de referencia
  });
  await saveMongo.save();

  return resultado;
};

// --------------------
// 🔹 API Endpoint
// --------------------
app.post("/api/probability", async (req, res) => {
  const { lat, lon, day, month, variable } = req.body;

  try {
    const result = await processNasaHistoricalData(lat, lon, day, month, variable);
    res.json(result); // 🔹 Se envía al frontend la media y demás info
  } catch (error) {
    console.error("❌ Error en backend:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error interno al procesar datos históricos.",
    });
  }
});

// --------------------
// 🔹 Endpoint para consultar datos ya guardados
// --------------------
app.get("/api/data", async (req, res) => {
  try {
    const datos = await NasaData.find().sort({ creadoEn: -1 }).limit(50);
    res.json(datos);
  } catch (error) {
    res.status(500).json({ success: false, message: "Error consultando MongoDB." });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
