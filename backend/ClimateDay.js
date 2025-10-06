const mongoose = require("mongoose");
 
const ClimateDaySchema = new mongoose.Schema({
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    variable: { type: String, required: true, enum: ["warm", "cold", "windy", "dusty", "humid", "uncomfortable", "rainy", "snowy", "cloudy"] },
    probability: { type: Number, required: true },
    historicalMean: { type: Number, required: true },
    threshold: { type: Number, required: true },
    unit: { type: String, required: true },
    detailDescription: { type: String },
    downloadLink: { type: String },
}, { timestamps: true }); 

ClimateDaySchema.index({ day: 1, month: 1, lat: 1, lon: 1, variable: 1 });

module.exports = mongoose.model("ClimateDay", ClimateDaySchema);