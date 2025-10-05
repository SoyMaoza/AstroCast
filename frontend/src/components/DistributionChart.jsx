import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Label, ReferenceArea } from 'recharts';

// --- MEJORA: Funciones de conversión de temperatura ---
const kelvinToCelsius = (k) => k - 273.15;
const kelvinToFahrenheit = (k) => (k - 273.15) * 9/5 + 32;



/**
 * Calcula los puntos para una curva de distribución normal (Campana de Gauss).
 * @param {number} mean - La media (μ) de la distribución.
 * @param {number} stdDev - La desviación estándar (σ).
 * @returns {Array<{x: number, y: number}>} - Un array de puntos para el gráfico.
 */
const generateBellCurveData = (mean, stdDev) => {
    const data = [];
    // We generate points from -3.5 to +3.5 standard deviations from the mean
    for (let i = -3.5; i <= 3.5; i += 0.1) {
        const x = mean + i * stdDev;
        // Formula for the probability density of the normal distribution
        const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
        // --- FIX: Remove x-value rounding to prevent "stair-ish" lines on small scales ---
        data.push({ x: x, y: y });
    }
    return data;
};

const DistributionChart = ({ mean, threshold, unit, displayUnit = 'C' }) => {
    // --- IMPROVEMENT: Dynamic standard deviation for better visualization ---
    // The standard deviation is adjusted based on the unit of the variable
    // to ensure the bell curve has a readable scale.
    let stdDev;
    if (unit && unit.includes('fraction')) { // For cloudy (0-1 scale)
        stdDev = 0.15;
    } else if (unit === 'mm/day') { // For rainy/snowy
        // --- FIX: Make stdDev proportional to the mean for better scaling on small values ---
        // Use a multiple of the mean, with a small minimum value to handle a mean of 0.
        stdDev = Math.max(mean * 1.5, 0.5); 
    } else if (unit === 'kg/kg') { // For humid
        stdDev = 0.002;
    } else { // Default for temperature (K) and wind (m/s)
        stdDev = 8;
    }


    // --- NEW: State to control a simple fade-in animation for all elements ---
    const [animatedOpacity, setAnimatedOpacity] = useState(0);

    useEffect(() => {
        // Reset and trigger the animation when the data changes.
        setAnimatedOpacity(0);
        const timer = setTimeout(() => {
            setAnimatedOpacity(1); // Trigger the fade-in to full opacity
        }, 100); // Short delay to allow the chart to render first
        return () => clearTimeout(timer);
    }, [mean, threshold]); // Rerun animation if data changes

    // --- MEJORA: Comprobación de props para evitar errores ---
    // Si los datos principales no son números válidos, no renderizar el gráfico.
    if (typeof mean !== 'number' || typeof threshold !== 'number') {
        return (
            <div style={{ width: '100%', height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                Datos insuficientes para mostrar la visualización.
            </div>
        );
    }

    // --- MEJORA: Conversión de unidades para visualización ---
    let displayMean = mean;
    let displayThreshold = threshold;
    let displayUnitSymbol = unit;
    let chartData = generateBellCurveData(mean, stdDev);

    if (unit === 'K') {
        if (displayUnit === 'C') {
            displayMean = kelvinToCelsius(mean);
            displayThreshold = kelvinToCelsius(threshold);
            chartData = chartData.map(d => ({ ...d, x: kelvinToCelsius(d.x) }));
            displayUnitSymbol = '°C';
        } else if (displayUnit === 'F') {
            displayMean = kelvinToFahrenheit(mean);
            displayThreshold = kelvinToFahrenheit(threshold);
            chartData = chartData.map(d => ({ ...d, x: kelvinToFahrenheit(d.x) }));
            displayUnitSymbol = '°F';
        }
    }

    // Determina si el umbral representa un riesgo por ser alto o bajo
    const isRiskHigh = threshold > mean;

    // Encuentra el valor máximo y mínimo en el eje X para delimitar el área de riesgo
    // Usamos los valores originales en Kelvin para la lógica del área de riesgo
    const originalChartData = generateBellCurveData(mean, stdDev);
    const xDomain = [originalChartData[0].x, originalChartData[originalChartData.length - 1].x];

    // --- MEJORA: Evitar solapamiento de etiquetas ---
    // La cercanía se calcula sobre los valores mostrados
    const areLabelsClose = Math.abs(displayMean - displayThreshold) < (displayMean / 4);

    // Formateador para el tooltip
    const tooltipFormatter = (value, name, props) => [`${props.payload.x.toFixed(1)} ${displayUnitSymbol}`, 'Value'];

    return (
        <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
                <LineChart
                    data={chartData}
                    margin={{
                        top: 20,
                        right: 30,
                        left: 0,
                        bottom: 20,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
                    <XAxis 
                        dataKey="x" 
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(tick) => tick.toFixed(0)}
                        tick={{ fontSize: 12, fill: '#757575' }}
                        label={{ value: `Value (${displayUnitSymbol})`, position: 'insideBottom', offset: -10, fill: '#757575' }}
                    />
                    <YAxis hide={true} domain={[0, 'dataMax']} />
                    <Tooltip
                        formatter={tooltipFormatter}
                        labelFormatter={() => ''}
                        cursor={{ stroke: '#3F51B5', strokeWidth: 1, strokeDasharray: '3 3' }}
                        contentStyle={{
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid #ccc',
                            borderRadius: '6px'
                        }}
                    />
                    
                    {/* Línea de la curva de distribución */}
                    <Line type="monotone" dataKey="y" stroke="#3F51B5" strokeWidth={2} dot={false} name="Frecuencia Histórica" />

                    {/* --- MEJORA: Área de Riesgo Sombreada --- */}
                    <ReferenceArea
                        x1={isRiskHigh ? displayThreshold : chartData[0].x}
                        x2={isRiskHigh ? chartData[chartData.length - 1].x : displayThreshold}
                        stroke="none"
                        fill="#F44336"
                        fillOpacity={animatedOpacity * 0.2} // Final opacity is 0.2
                        style={{ transition: 'fill-opacity 1.2s ease-out' }} // CSS transition for smooth effect
                    >
                        <Label value="Risk Zone" position="insideTop" fill="#B71C1C" fontSize={12} />
                    </ReferenceArea>

                    {/* Línea de la Media Histórica */}
                    <ReferenceLine 
                        x={displayMean} 
                        stroke="#2196F3" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        strokeOpacity={animatedOpacity} // Use animated state for fade-in
                        style={{ transition: 'stroke-opacity 0.8s ease-out 0.2s' }} // Staggered animation
                    >
                        <Label 
                            value={`Average: ${displayMean.toFixed(2)}`} 
                            position="top" 
                            fill="#1E88E5"
                            fontSize={12} 
                        />
                    </ReferenceLine>

                    {/* Línea del Umbral de Riesgo */}
                    <ReferenceLine 
                        x={displayThreshold} 
                        stroke="#F44336" 
                        strokeWidth={2}
                        strokeOpacity={animatedOpacity} // Use animated state for fade-in
                        style={{ transition: 'stroke-opacity 0.8s ease-out 0.3s' }} // Staggered animation
                    >
                        {/* --- MEJORA: Posiciona la etiqueta dentro del área de riesgo si está muy cerca de la media --- */}
                        <Label 
                            value={`Limit: ${displayThreshold.toFixed(2)}`} 
                            position={areLabelsClose ? "insideTopRight" : "top"}
                            fill="#F44336" 
                            fontSize={12} 
                        />
                    </ReferenceLine>

                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DistributionChart;