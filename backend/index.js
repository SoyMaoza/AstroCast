// backend/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios'); 
const app = express();
const port = 3000;

// URL OPeNDAP que TÚ ENCONTRASTE (incluye T2M, V10M, etc.)
const YOUR_MERRA2_OPENDAP_URL = "https://opendap.earthdata.nasa.gov/collections/C1276812863-GES_DISC/granules/M2T1NXSLV.5.12.4%3AMERRA2_100.tavg1_2d_slv_Nx.19800101.nc4.dap.nc4?dap4.ce=/QV2M;/T2M;/T2MDEW;/U10M;/V10M;/time;/lat;/lon";

// Middleware
app.use(cors()); 
app.use(express.json());

// --- CONFIGURACIÓN DE DATOS Y ENLACES DE LA NASA ---
const NASA_DATA_CONFIG = {
    hot: { variableName: 'T2M', units: 'K', apiUrl: YOUR_MERRA2_OPENDAP_URL },
    cold: { variableName: 'T2M', units: 'K', apiUrl: YOUR_MERRA2_OPENDAP_URL },
    windy: { variableName: 'U10M_V10M', units: 'm/s', apiUrl: YOUR_MERRA2_OPENDAP_URL },
    uncomfortable: { variableName: 'T2M_T2MDEW_QV2M', units: 'Índice (Combinado)', apiUrl: YOUR_MERRA2_OPENDAP_URL },
    wet: {
        variableName: 'precipitation',
        units: 'mm/hr',
        apiUrl: 'https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGHHL.06/2024/09/3B-HHR.MS.MRG.3IMERGHHL.20240924-S100000-E102959.0600.V06A.HDF5' 
    },
    dust: {
        variableName: 'DUEXTTAU', 
        units: 'AOD',
        apiUrl: 'https://opendap.nccs.nasa.gov/dap/MERRA-2/M2T1NXAER.5.12.4/1980/01/MERRA2_100.tavg1_2d_aer_Nx.19800101.nc4' 
    }
};

// --- FUNCIÓN DE PROCESAMIENTO ESTADÍSTICO (SIMULADA Y DETERMINISTA) ---
const processNasaHistoricalData = async (lat, lon, day, month, variable) => {
    const config = NASA_DATA_CONFIG[variable];
    if (!config) throw new Error(`[Backend Error] Variable '${variable}' no soportada.`);

    console.log(`\n[Backend] Solicitud para: ${variable}. Fuente conceptual: ${config.apiUrl}`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simula latencia

    let historicalMean, threshold, probability, locationName, detailDescription = "";
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day); // Aunque no se usa en la simulación, es parte de la entrada

    locationName = `NASA Data Point (Lat: ${latNum.toFixed(2)}, Lon: ${lonNum.toFixed(2)})`;
    if (latNum > 15 && latNum < 25 && lonNum < -105 && lonNum > -115) locationName = "Centro de México (Simulado)";
    
    // --- Lógica de Simulación DETERMINISTA ---
    // Los valores base dependerán de la latitud y el mes, pero no de Math.random()
    // Los "ajustes" están pensados para que los valores parezcan razonables y varíen geográficamente/estacionalmente.
    
    switch (variable) {
        case 'hot':
            historicalMean = 290.0 + (latNum > 0 && monthNum >= 6 && monthNum <= 8 ? 10.0 : 0.0) + (Math.abs(latNum) / 90 * 10); 
            threshold = 305.0; // ~32°C en Kelvin
            // La probabilidad ahora es una función más directa de la media histórica vs el umbral
            probability = Math.min(Math.round(Math.max(0, (historicalMean - (threshold - 20)) * 5)), 95);
            detailDescription = `Basado en T2M. Probabilidad de que la temperatura histórica promedio haya excedido ${threshold.toFixed(1)}K.`;
            break;

        case 'cold':
            historicalMean = 285.0 - (latNum > 0 && (monthNum >= 11 || monthNum <= 2) ? 15.0 : 0.0) - (Math.abs(latNum) / 90 * 15); 
            threshold = 273.15; // 0°C en Kelvin
            probability = Math.min(Math.round(Math.max(0, ((threshold + 10) - historicalMean) * 5)), 95);
            detailDescription = `Basado en T2M. Probabilidad de que la temperatura histórica promedio haya sido inferior a ${threshold.toFixed(1)}K.`;
            break;

        case 'wet':
            historicalMean = 0.1 + (monthNum >= 6 && monthNum <= 9 ? 0.4 : 0.0); // Más lluvia en temporada húmeda
            threshold = 0.8; // Umbral de precipitación en mm/hr
            probability = Math.min(Math.round(Math.max(0, (historicalMean - (threshold - 0.5)) * 100)), 80);
            detailDescription = `Basado en precipitación IMERG. Probabilidad de que la precipitación promedio histórica haya excedido ${threshold.toFixed(1)}mm/hr.`;
            break;

        case 'windy':
            historicalMean = 7.0 + (Math.abs(latNum) / 90 * 3) + (monthNum >= 10 || monthNum <= 3 ? 2.0 : 0.0); // Más viento en latitudes altas o invierno
            threshold = 10.0; // Umbral de "muy ventoso" en m/s
            probability = Math.min(Math.round(Math.max(0, (historicalMean - (threshold - 5)) * 10)), 60);
            detailDescription = `Basado en U10M y V10M. Probabilidad de que la velocidad del viento histórica promedio haya excedido ${threshold.toFixed(1)}m/s.`;
            break;

        case 'uncomfortable':
            // Índice de incomodidad simulado (mayor con más calor y humedad)
            historicalMean = 290.0 + (latNum > 0 && monthNum >= 6 && monthNum <= 8 ? 8.0 : 0.0) + (Math.abs(latNum) / 90 * 5);
            threshold = 308.0; 
            probability = Math.min(Math.round(Math.max(0, (historicalMean - (threshold - 10)) * 5)), 98);
            detailDescription = `Basado en T2M y Dew Point Temp para un índice de incomodidad. Probabilidad de que el índice de incomodidad histórica promedio haya excedido ${threshold.toFixed(1)}.`;
            break;

        case 'dust':
            historicalMean = 0.05 + (Math.abs(latNum) < 30 && monthNum >= 3 && monthNum <= 5 ? 0.2 : 0.0); // Más polvo en desiertos en primavera
            threshold = 0.5; // Umbral de "mucho polvo" (AOD)
            probability = Math.min(Math.round(Math.max(0, (historicalMean - (threshold - 0.3)) * 100)), 40);
            detailDescription = `Basado en AOD. Probabilidad de que la concentración de polvo histórica promedio haya excedido ${threshold.toFixed(2)} AOD.`;
            break;

        default:
            throw new Error("Variable climática no reconocida para el procesamiento.");
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
        detailDescription: detailDescription 
    };
};

// --- RUTA DE API: POST /api/probability ---
app.post('/api/probability', async (req, res) => {
    const { lat, lon, day, month, variable } = req.body;

    // Simulación de fallo para latitud 0, 0
    if (parseFloat(lat) === 0 && parseFloat(lon) === 0) { 
        return res.status(503).json({
            success: false,
            message: "Error de Servicio NASA: El servicio de datos no responde para esta región (Simulación de fallo)."
        });
    }

    try {
        const results = await processNasaHistoricalData(lat, lon, day, month, variable);
        res.json(results);
    } catch (error) {
        console.error("Error en el cálculo del backend:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || "Error interno al procesar datos históricos." 
        });
    }
});


// Inicio del Servidor
app.listen(port, () => {
    console.log(`\n🚀 Servidor de API de la NASA (Hackathon Mock) corriendo en http://localhost:${port}`);
    console.log(`\n¡No olvides ejecutar 'npm run dev' en otra terminal para el frontend!\n`);
});