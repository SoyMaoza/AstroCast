const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const port = 3000;



const URL_MERRA2_OPENDAP =
  "https://opendap.earthdata.nasa.gov/collections/C1276812863-GES_DISC/granules/M2T1NXSLV.5.12.4%3AMERRA2_100.tavg1_2d_slv_Nx.19800102.nc4.dap.nc4?dap4.ce=/QV2M;/T2M;/T2MDEW;/U10M;/V10M;/time;/lat;/lon";

const URL_DUST_OPENDAP =
  "https://opendap.earthdata.nasa.gov/collections/C1276812830-GES_DISC/granules/M2T1NXAER.5.12.4%3AMERRA2_100.tavg1_2d_aer_Nx.19800102.nc4.dap.nc4?dap4.ce=/DUEXTTAU;/time;/lat;/lon";


app.use(cors());
app.use(express.json());

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
      `Seleccione todos los campos.`
    );

  console.log(
    `\n[Backend] Solicitud para: ${variable}. Fuente conceptual: ${config.apiUrl}`
  );
  await new Promise((resolve) => setTimeout(resolve, 2000));

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

  return {
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
    `\n🚀 Servidor de API de la NASA (Hackathon Mock) corrienado en http://localhost:${port}`
  );
  console.log(
    `\n¡plebes, no olviden ejecutar 'npm run dev' en otra terminal para el frontend!\n`
  );
});
