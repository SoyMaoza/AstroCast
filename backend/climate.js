const express = require('express');
const ClimateDay = require('./ClimateDay.js'); // Import the model
const {
    CONFIG_VARIABLES_NASA,
    getCoordinates,
    findClosestIndex,
    getHistoricalStatistics,
    getMerra2FilePrefix
} = require('./index.js');

const router = express.Router();

router.post("/climate-probability", async (req, res) => {
    const { lat, lon, day, month, variable } = req.body;
    const HISTORICAL_RANGE = `1980-${new Date().getFullYear()}`;

    try {
        const latRounded = parseFloat(lat.toFixed(2));
        const lonRounded = parseFloat(lon.toFixed(2));
        const cachedResult = await ClimateDay.findOne({ lat: latRounded, lon: lonRounded, day, month, variable });

        if (cachedResult) {
            console.log(`[Cache] Result found in database for ${variable} at (Lat:${latRounded}, Lon:${lonRounded})`);
            return res.json(cachedResult);
        }
    } catch (cacheError) {
        console.error("[Cache] Error searching the database cache:", cacheError.message);
    }

    try {
        const config = CONFIG_VARIABLES_NASA[variable];
        if (!config) {
            return res.status(400).json({ success: false, message: `Variable '${variable}' not supported.` });
        }

        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');

        console.log(`\n[Request] Processing: ${variable} for ${day}/${month} at (Lat:${lat}, Lon:${lon})`);

        let referenceDatasetUrl;

        if (config.datasetUrlTemplate.includes('GPM_3IMERGDF')) {
            const referenceDatasetFileName = `3B-DAY.MS.MRG.3IMERG.20230101-S000000-E235959.V07B.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/2023/01/${referenceDatasetFileName}`;
        } else {
            const referenceYear = '2016';
            const datasetType = config.datasetUrlTemplate.includes('AER') ? 'aer' : 'slv';
            const referenceFilePrefix = getMerra2FilePrefix(referenceYear);
            const referenceDatasetFileName = `MERRA2_${referenceFilePrefix}.tavg1_2d_${datasetType}_Nx.${referenceYear}${monthStr}${dayStr}.nc4`;
            referenceDatasetUrl = `${config.datasetUrlTemplate}/${referenceYear}/${monthStr}/${referenceDatasetFileName}`;
        }

        const { lats, lons } = await getCoordinates(referenceDatasetUrl);
        const latIndex = findClosestIndex(lat, lats);
        const lonIndex = findClosestIndex(lon, lons);
        console.log(`[Index] Indexes found -> Lat: ${latIndex}, Lon: ${lonIndex}`);

        const stats = await getHistoricalStatistics(config, day, month, latIndex, lonIndex);
        const displayThreshold = config.isBelowThresholdWorse ? stats.p10 : stats.p90;

        const mapRange = (value, in_min, in_max, out_min, out_max) => {
            return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
        };

        let probability;
        switch (variable) {
            case 'warm': probability = mapRange(stats.mean, 293.15, 308.15, 0, 100); break;
            case 'cold': probability = mapRange(stats.mean, 293.15, 273.15, 0, 100); break;
            case 'windy': probability = mapRange(stats.mean, 0, 15, 0, 100); break;
            case 'dusty': probability = mapRange(stats.mean, 0, 0.1, 0, 100); break;
            case 'humid': probability = mapRange(stats.mean, 0.005, 0.020, 0, 100); break;
            case 'uncomfortable': probability = mapRange(stats.mean, 27, 41, 0, 100); break;
            case 'rainy': {
                const diasConLluvia = stats.values.filter(p => p > 0.2).length;
                const totalDias = stats.values.length;
                probability = totalDias > 0 ? ((diasConLluvia + 1) / (totalDias + 2)) * 100 : 0;
                break;
            }
            default: probability = 0;
        }

        probability = Math.max(0, Math.min(100, Math.round(probability)));

        const detailDescription = `The probability of the '${variable}' condition occurring is ${probability}%, based on the historical average of ${stats.mean.toFixed(2)} ${config.unit} for the range ${HISTORICAL_RANGE}.`;

        const result = {
            success: true,
            location: `(Lat: ${lats[latIndex].toFixed(2)}, Lon: ${lons[lonIndex].toFixed(2)})`,
            date: `${day}/${month}`,
            variable: variable,
            probability: probability,
            historicalMean: parseFloat(stats.mean.toFixed(4)),
            threshold: parseFloat(displayThreshold.toFixed(1)),
            unit: config.unit,
            detailDescription: detailDescription,
            downloadLink: "https://disc.gsfc.nasa.gov/datasets/M2T1NXSLV_5.12.4/summary"
        };

        const record = new ClimateDay({ ...result, lat: parseFloat(lat.toFixed(2)), lon: parseFloat(lon.toFixed(2)), day, month });
        await record.save();
        console.log("[DB] Result saved to the database successfully.");
        res.json(result);

    } catch (error) {
        console.error("❌ FATAL ERROR IN API ROUTE:", error.message);
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
    }
});

module.exports = router;