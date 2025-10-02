const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

// MIDDLEWARES
app.use(cors());
app.use(express.json());

// Database connection with MongoDB
mongoose.connect("mongodb+srv://admin:QpDjnHb55FIj60Hq@cluster0.9ank8lv.mongodb.net/astrocast")
    .then(() => console.log("Conectado a MongoDB Atlas"))
    .catch((err) => console.error("Error al conectar a MongoDB:", err));

// Schema Definition
const ClimateDaySchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    variable: { type: String, required: true, enum: [ "calido", "frio", "humedo", "ventoso", "incomodo", "polvo" ]},
    probability: { type: Number, required: true },
    historicalMean: { type: Number, required: true },
    threshold: { type: Number, required: true },
    unit: { type: String, required: true },
    detailDescription: { type: String },
    downloadLink: { type: String },
}, { timestamps: true });

ClimateDaySchema.index({ day: 1, month: 1, variable: 1, lat: 1, lon: 1 });

// Model Definition
const ClimateDay = mongoose.model("ClimateDay", ClimateDaySchema); // <-- CORREGIDO: Definición del modelo

// API Routes
app.get("/", (req, res) => {
    res.send("Express app is running");
});

app.post('/addinfo', async (req, res) => {
    try {
        const newClimateDay = new ClimateDay({
            day: req.body.day,
            month: req.body.month,
            lat: req.body.lat,
            lon: req.body.lon,
            variable: req.body.variable,
            probability: req.body.probability,
            historicalMean: req.body.historicalMean,
            threshold: req.body.threshold,
            unit: req.body.unit,
            detailDescription: req.body.detailDescription,
            downloadLink: req.body.downloadLink,
        });

        await newClimateDay.save();
        console.log("Guardado exitosamente");
        res.status(201).json({
            success: true,
            data: newClimateDay
        });

    } catch (error) {
        console.error("Error al guardar:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

// Creating API for deleting climate day info
app.delete('/deleteinfo', async (req, res) => {
    try {
        const deletedClimateDay = await ClimateDay.findOneAndDelete({ _id: req.body.id });
        if (!deletedClimateDay) {
            return res.status(404).json({ success: false, message: "No se encontró el registro" });
        }
        console.log("Eliminado exitosamente");
        res.json({
            success: true,
            message: "Registro eliminado",
            deletedData: deletedClimateDay
        });
    } catch (error) {
        console.error("Error al eliminar:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

// Creating API for getting all products
app.get('/getinfo', async (req, res) => {
    try {
        let climateDays = await ClimateDay.find({});
        console.log("Todos los registros obtenidos");
        res.send(climateDays);
    } catch (error) {
        console.error("Error al obtener los datos:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

// API para obtener la información de un solo registro por su ID
app.get('/getinfo/:id', async (req, res) => {
    try {
        const recordId = req.params.id;
        const climateDay = await ClimateDay.findById(recordId);
        if (!climateDay) {
            return res.status(404).json({ success: false, message: "Registro no encontrado" });
        }
        res.json({ success: true, data: climateDay });
        console.log("Registro obtenido exitosamente");
    } catch (error) {
        console.error("Error al obtener el registro:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

// API para obtener todos los registros de una fecha específica (todos los años)
app.get('/getinfo/:month/:day', async (req, res) => {
    try {
        const monthParam = req.params.month;
        const dayParam = req.params.day;
        const climateDays = await ClimateDay.find({
            month: monthParam,
            day: dayParam
        });
        console.log(`Búsqueda para fecha ${dayParam}/${monthParam} devolvió ${climateDays.length} registros.`);
        res.json({ success: true, data: climateDays });
    } catch (error) {
        console.error("Error al buscar por fecha:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

const URL_MERRA2_OPENDAP =
  "https://opendap.earthdata.nasa.gov/collections/C1276812863-GES_DISC/granules/M2T1NXSLV.5.12.4%3AMERRA2_100.tavg1_2d_slv_Nx.19800101.nc4.dap.nc4?dap4.ce=/QV2M;/T2M;/T2MDEW;/U10M;/V10M;/time;/lat;/lon";

const URL_DUST_OPENDAP =
  "https://opendap.earthdata.nasa.gov/collections/C1276812830-GES_DISC/granules/M2T1NXAER.5.12.4%3AMERRA2_100.tavg1_2d_aer_Nx.19800101.nc4.dap.nc4?dap4.ce=/DUEXTTAU;/time;/lat;/lon";

const CONFIG_DATOS_NASA = {
  calido: { variableName: "T2M", units: "K", apiUrl: URL_MERRA2_OPENDAP },
  frio: { variableName: "T2M", units: "K", apiUrl: URL_MERRA2_OPENDAP },
  ventoso: {
    variableName: "U10M_V10M",
    units: "m/s",
    apiUrl: URL_MERRA2_OPENDAP,
  },
  incomodo: {
    variableName: "T2M_T2MDEW_QV2M",
    units: "Índice (Combinado)",
    apiUrl: URL_MERRA2_OPENDAP,
  },
  humedo: {
    variableName: "precipitation",
    units: "mm/hr",
    apiUrl:
      "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGHHL.06/2024/09/3B-HHR.MS.MRG.3IMERGHHL.20240924-S100000-E102959.0600.V06A.HDF5",
  },
  polvo: {
    variableName: "DUEXTTAU",
    units: "AOD",
    apiUrl: URL_DUST_OPENDAP,
  },
};

const processNasaHistoricalData = async (lat, lon, day, month, variable) => {
  const config = CONFIG_DATOS_NASA[variable];
  if (!config)
    throw new Error(
      `[Error Backend] Variable '${variable}' no soportada. Asegúrate de que el frontend usa las claves en español.`
    );

  console.log(
    `\n[Backend] Solicitud para: ${variable}. Fuente conceptual: ${config.apiUrl}`
  );
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Simula latencia de red

  let historicalMean,
    threshold,
    probability,
    locationName,
    detailDescription = "";
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);

  locationName = `NASA Data Point (Lat: ${latNum.toFixed(
    2
  )}, Lon: ${lonNum.toFixed(2)})`;
  if (latNum > 15 && latNum < 25 && lonNum < -105 && lonNum > -115)
    locationName = "Centro de México (Simulado)";

  switch (variable) {
    case "calido":
      historicalMean =
        290.0 +
        (latNum > 0 && monthNum >= 6 && monthNum <= 8 ? 10.0 : 0.0) +
        (Math.abs(latNum) / 90) * 10;
      threshold = 305.0;
      probability = Math.min(
        Math.round(Math.max(0, (historicalMean - (threshold - 20)) * 5)),
        95
      );
      detailDescription = `Basado en T2M. Probabilidad de que la temperatura histórica promedio haya excedido ${threshold.toFixed(
        1
      )}K.`;
      break;

    case "frio":
      historicalMean =
        285.0 -
        (latNum > 0 && (monthNum >= 11 || monthNum <= 2) ? 15.0 : 0.0) -
        (Math.abs(latNum) / 90) * 15;
      threshold = 273.15;
      probability = Math.min(
        Math.round(Math.max(0, (threshold + 10 - historicalMean) * 5)),
        95
      );
      detailDescription = `Basado en T2M. Probabilidad de que la temperatura histórica promedio haya sido inferior a ${threshold.toFixed(
        1
      )}K.`;
      break;

    case "humedo":
      historicalMean = 0.1 + (monthNum >= 6 && monthNum <= 9 ? 0.4 : 0.0);
      threshold = 0.8;
      probability = Math.min(
        Math.round(Math.max(0, (historicalMean - (threshold - 0.5)) * 100)),
        80
      );
      detailDescription = `Basado en precipitación IMERG. Probabilidad de que la precipitación promedio histórica haya excedido ${threshold.toFixed(
        1
      )}mm/hr.`;
      break;

    case "ventoso":
      historicalMean =
        7.0 +
        (Math.abs(latNum) / 90) * 3 +
        (monthNum >= 10 || monthNum <= 3 ? 2.0 : 0.0);
      threshold = 10.0;
      probability = Math.min(
        Math.round(Math.max(0, (historicalMean - (threshold - 5)) * 10)),
        60
      );
      detailDescription = `Basado en U10M y V10M. Probabilidad de que la velocidad del viento histórica promedio haya excedido ${threshold.toFixed(
        1
      )}m/s.`;
      break;

    case "incomodo":
      historicalMean =
        290.0 +
        (latNum > 0 && monthNum >= 6 && monthNum <= 8 ? 8.0 : 0.0) +
        (Math.abs(latNum) / 90) * 5;
      threshold = 308.0;
      probability = Math.min(
        Math.round(Math.max(0, (historicalMean - (threshold - 10)) * 5)),
        98
      );
      detailDescription = `Basado en T2M y Dew Point Temp para un índice de incomodidad. Probabilidad de que el índice de incomodidad histórica promedio haya excedido ${threshold.toFixed(
        1
      )}.`;
      break;

    case "polvo":
      historicalMean =
        0.05 +
        (Math.abs(latNum) < 30 && monthNum >= 3 && monthNum <= 5 ? 0.2 : 0.0);
      threshold = 0.5;
      probability = Math.min(
        Math.round(Math.max(0, (historicalMean - (threshold - 0.3)) * 100)),
        40
      );
      detailDescription = `Basado en AOD. Probabilidad de que la concentración de polvo histórica promedio haya excedido ${threshold.toFixed(
        2
      )} AOD.`;
      break;

    default:
      throw new Error(
        "Variable climática no reconocida para el procesamiento."
      );
  }

  const result = {
    success: true,
    location: locationName,
    date: `${day}/${month}`,
    variable: variable,
    probability: probability,
    historicalMean: parseFloat(historicalMean.toFixed(2)),
    threshold: parseFloat(threshold.toFixed(2)),
    unit: config.units,
    downloadLink: config.apiUrl,
    detailDescription: detailDescription,
  };

  // Guardar el resultado en la base de datos (sin bloquear la respuesta al cliente)
  try {
    const newClimateRecord = new ClimateDay({
      day: dayNum,
      month: monthNum,
      lat: latNum,
      lon: lonNum,
      variable: variable,
      probability: result.probability,
      historicalMean: result.historicalMean,
      threshold: result.threshold,
      unit: result.unit,
      detailDescription: result.detailDescription,
      downloadLink: result.downloadLink,
    });
    await newClimateRecord.save();
    console.log(`[DB] Registro guardado para ${variable} en ${latNum},${lonNum}`);
  } catch (dbError) {
    console.error("[DB] Error al guardar el registro:", dbError.message);
  }

  return result;
};

app.post("/api/probability", async (req, res) => {
  const { lat, lon, day, month, variable } = req.body;

  if (parseFloat(lat) === 0 && parseFloat(lon) === 0) {
    return res.status(503).json({
      success: false,
      message:
        "Error de Servicio NASA: El servicio de datos no responde para esta región (Simulación de fallo).",
    });
  }

  try {
    const results = await processNasaHistoricalData(
      lat,
      lon,
      day,
      month,
      variable
    );
    res.json(results);
  } catch (error) {
    console.error("Error en el cálculo del backend:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error interno al procesar datos históricos.",
    });
  }
});

app.listen(port, () => {
    console.log(
      `\n🚀 Servidor de API de AstroCast (Mock) corriendo en http://localhost:${port}`
    );
    console.log(
      `\n¡No olvides ejecutar 'npm run dev' en otra terminal para el frontend!\n`
    );
  });
