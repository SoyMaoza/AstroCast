const mongoose = require("mongoose");
const express = require("express");
const fetch = require("node-fetch");
const { Reader } = require("netcdfjs");
const path = require('path');
const { format, addDays, getDayOfYear } = require('date-fns');
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

// --- CONFIGURACIÓN ---
const NASA_API_TOKEN = process.env.NASA_API_TOKEN || 'eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6ImFicmFoYW03NCIsImV4cCI6MTc2NDM3NDM5OSwiaWF0IjoxNzU5MTgwNzM0LCJpc3MiOiJodHRwczovL3Vycy5lYXJ0aGRhdGEubmFzYS5nb3YiLCJpZGVudGl0eV9wcm92aWRlciI6ImVkbF9vcHMiLCJhY3IiOiJlZGwiLCJhc3N1cmFuY2VfbGV2ZWwiOjN9.JtX-hH_NucBgkPjjyViTxxMLlORbVIEjGLlAeGGPGBKoNG6rqzvg4n5vH3yCDH5RzPhVmrlGRPImOPXFq5l8Gz1ITrfijple8ZA5AAasKqLBb_ekdyWSXCB9O4pIQRmetJimSi4n9rwUyNF9tOrJ8-TvcjCA23kWUNTGRnqneBmoVfbpup7rxifLoUScBb2wXLtmjJFTP8rSY0iVY64n6HLRBJUgESefj64hSvt50xODAg3ayX_g1BwioG2otGmuqcFt7qV0k5EfEJJd2bGtbQD-LocTAwUaG_Wq0XFYN2QQw1LBOMm4q94DdI2Va1XzMO6RfBBEIFZvuoclNTvjZw'; // Usa variables de entorno en producción
const ANIO_INICIO_HISTORICO = 1980;
const ANIO_FIN_HISTORICO = 2023; // Usar un año completo reciente

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

// CORREGIDO: Se unificaron las dos declaraciones de CONFIG_DATOS_NASA en una sola y se corrigieron las URLs.
const CONFIG_DATOS_NASA = {
  calido: { variableName: "T2M", units: "K", apiUrl: URL_MERRA2 },
  frio: { variableName: "T2M", units: "K", apiUrl: URL_MERRA2 },
  ventoso: {
    variableName: "U10M_V10M",
    units: "m/s",
    apiUrl: URL_MERRA2,
  },
  incomodo: {
    variableName: "T2M_T2MDEW_QV2M",
    units: "Índice (Combinado)",
    apiUrl: URL_MERRA2,
  },
  polvo: {
    variableName: "DUEXTTAU",
    units: "AOD",
    apiUrl: URL_DUST,
  },
};

// --- NUEVOS MODELOS DE DATOS PARA PROCESAMIENTO ---

const historicalAverageSchema = new mongoose.Schema({
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    dayOfYear: { type: Number, required: true }, // 1-366
    averages: {
        temperature: { type: Number }, // T2M en Kelvin
        windSpeed: { type: Number },   // U10M, V10M en m/s
    },
    yearsProcessed: { type: [Number] }
}, { timestamps: true });

historicalAverageSchema.index({ lat: 1, lon: 1, dayOfYear: 1 }, { unique: true });
const HistoricalAverage = mongoose.model("HistoricalAverage", historicalAverageSchema);

const processingStateSchema = new mongoose.Schema({
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    lastProcessedYear: { type: Number, required: true },
    accumulators: { type: Map, of: { sum: Number, count: Number } } // "dayOfYear-variable" -> {sum, count}
});
const ProcessingState = mongoose.model("ProcessingState", processingStateSchema);

// --- LÓGICA DE PROCESAMIENTO HISTÓRICO ---

/**
 * Orquesta la obtención de datos. Si ya están cacheados, los devuelve.
 * Si no, inicia el proceso de cálculo en segundo plano.
 */
async function processNasaHistoricalData(lat, lon, day, month, variable) {
    const date = new Date(2023, month - 1, day); // Año no bisiesto para obtener dayOfYear
    const dayOfYear = getDayOfYear(date);

    const cachedData = await HistoricalAverage.findOne({ lat, lon, dayOfYear });

    if (cachedData) {
        console.log(`[Cache] Datos encontrados para ${lat},${lon} en el día ${dayOfYear}`);
        // Aquí transformarías el dato cacheado al formato de respuesta esperado
        // Por ahora, devolvemos un mensaje simple.
        return {
            success: true,
            location: `Lat: ${lat}, Lon: ${lon}`,
            date: `${day}/${month}`,
            variable,
            probability: 50, // Calcular probabilidad basada en el promedio
            historicalMean: cachedData.averages.temperature, // Ejemplo
            threshold: 305,
            unit: "K",
            detailDescription: `Promedio histórico de ${cachedData.yearsProcessed.length} años.`,
        };
    }

    console.log(`[Cache] No hay datos para ${lat},${lon} día ${dayOfYear}. Iniciando cálculo.`);
    // Inicia el cálculo en segundo plano sin esperar a que termine (fire and forget)
    calculateAndStoreHistoricalAverages(lat, lon).catch(err => {
        console.error(`[ERROR] Falló el cálculo en segundo plano para ${lat},${lon}:`, err);
    });

    // Devuelve una respuesta inmediata al usuario
    return {
        success: false,
        message: "Los datos históricos para esta ubicación no estaban pre-calculados. Se ha iniciado el proceso. Por favor, intente de nuevo en unos minutos.",
        reprocessing: true,
    };
}

/**
 * Procesa el rango de años completo para una ubicación, guardando el progreso.
 */
async function calculateAndStoreHistoricalAverages(lat, lon) {
    const state = await ProcessingState.findOne({ lat, lon }) || { accumulators: new Map() };
    const startYear = state.lastProcessedYear ? state.lastProcessedYear + 1 : ANIO_INICIO_HISTORICO;

    console.log(`[Procesando] Ubicación ${lat},${lon} desde el año ${startYear}`);

    for (let year = startYear; year <= ANIO_FIN_HISTORICO; year++) {
        let currentDate = new Date(year, 0, 1);
        while (currentDate.getFullYear() === year) {
            const dayOfYear = getDayOfYear(currentDate);
            const fechaStr = format(currentDate, 'yyyyMMdd');

            try {
                const values = await fetchAndProcessGranule(fechaStr, lat, lon);
                if (values) {
                    // Acumular temperatura
                    let tempKey = `${dayOfYear}-temperature`;
                    let tempAcc = state.accumulators.get(tempKey) || { sum: 0, count: 0 };
                    tempAcc.sum += values.temperature;
                    tempAcc.count++;
                    state.accumulators.set(tempKey, tempAcc);
                }
            } catch (e) {
                console.warn(`No se pudo procesar ${fechaStr}: ${e.message}`);
            }
            currentDate = addDays(currentDate, 1);
        }

        // Guardar progreso parcial cada 5 años
        if (year % 5 === 0 || year === ANIO_FIN_HISTORICO) {
            console.log(`[Checkpoint] Guardando progreso para el año ${year}...`);
            await ProcessingState.updateOne(
                { lat, lon },
                { lastProcessedYear: year, accumulators: state.accumulators },
                { upsert: true }
            );
        }
    }

    // Guardado final de promedios
    console.log("[Finalizando] Calculando y guardando promedios finales...");
    for (const [key, { sum, count }] of state.accumulators.entries()) {
        const [dayOfYear, variable] = key.split('-');
        const average = sum / count;

        await HistoricalAverage.updateOne(
            { lat, lon, dayOfYear: parseInt(dayOfYear) },
            {
                $set: { [`averages.${variable}`]: average },
                $addToSet: { yearsProcessed: { $each: Array.from({ length: ANIO_FIN_HISTORICO - ANIO_INICIO_HISTORICO + 1 }, (_, i) => ANIO_INICIO_HISTORICO + i) } }
            },
            { upsert: true }
        );
    }
    await ProcessingState.deleteOne({ lat, lon }); // Limpiar estado temporal
    console.log(`[Completado] Proceso finalizado para ${lat},${lon}.`);
}

/**
 * Descarga y extrae valores de un solo archivo NetCDF de MERRA-2.
 */
async function fetchAndProcessGranule(fecha, lat, lon) {
    const url = `https://goldsmr4.gesdisc.eosdis.nasa.gov/data/MERRA2/M2T1NXSLV.5.12.4/${fecha.substring(0, 4)}/${fecha.substring(4, 6)}/MERRA2_400.tavg1_2d_slv_Nx.${fecha}.nc4`;

    const resp = await fetch(url, { headers: { "Authorization": `Bearer ${NASA_API_TOKEN}` } });
    if (!resp.ok) throw new Error(`Fallo en la descarga del gránulo ${url}: ${resp.statusText}`);

    const buffer = await resp.arrayBuffer();
    const reader = new Reader(buffer);

    const lats = reader.getDataVariable('lat');
    const lons = reader.getDataVariable('lon');
    const { latIndex, lonIndex } = findNearestGridIndex(lats, lons, lat, lon);

    // Extraer temperatura (T2M) y promediarla para el día
    const T2M = reader.getDataVariable('T2M'); // Shape: [time, lat, lon]
    let tempSum = 0;
    const timeSteps = reader.variables.find(v => v.name === 'T2M').dimensions[0].length;

    for (let t = 0; t < timeSteps; t++) {
        tempSum += T2M[t * lats.length * lons.length + latIndex * lons.length + lonIndex];
    }
    const avgTemp = tempSum / timeSteps;

    return {
        temperature: avgTemp, // en Kelvin
        // Aquí podrías añadir viento, etc.
    };
}

function findNearestGridIndex(lats, lons, targetLat, targetLon) {
    let latIndex = 0, lonIndex = 0;
    let minDistLat = Infinity, minDistLon = Infinity;

    lats.forEach((lat, i) => {
        const dist = Math.abs(lat - targetLat);
        if (dist < minDistLat) {
            minDistLat = dist;
            latIndex = i;
        }
    });
    lons.forEach((lon, i) => {
        const dist = Math.abs(lon - targetLon);
        if (dist < minDistLon) {
            minDistLon = dist;
            lonIndex = i;
        }
    });
    return { latIndex, lonIndex };
}

// --------------------
// 🔹 API Endpoint
// --------------------
app.post("/api/probability", async (req, res) => {
  const { lat, lon, day, month, variable } = req.body;

  try {
    const result = await processNasaHistoricalData(parseFloat(lat), parseFloat(lon), parseInt(day), parseInt(month), variable);
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
    console.log(
      `\n🚀 Servidor de API de AstroCast corriendo en http://localhost:${port}`
    );
    console.log(
      `\n¡No olvides ejecutar 'npm run dev' en otra terminal para el frontend!\n`
    );
  });
