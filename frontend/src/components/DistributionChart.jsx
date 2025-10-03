import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Label, ReferenceArea } from 'recharts';

/**
 * Calcula los puntos para una curva de distribución normal (Campana de Gauss).
 * @param {number} mean - La media (μ) de la distribución.
 * @param {number} stdDev - La desviación estándar (σ).
 * @returns {Array<{x: number, y: number}>} - Un array de puntos para el gráfico.
 */
const generateBellCurveData = (mean, stdDev) => {
    const data = [];
    // Generamos puntos desde -3.5 a +3.5 desviaciones estándar de la media
    for (let i = -3.5; i <= 3.5; i += 0.1) {
        const x = mean + i * stdDev;
        // Fórmula de la densidad de probabilidad de la distribución normal
        const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
        data.push({ x: parseFloat(x.toFixed(2)), y: y });
    }
    return data;
};

const DistributionChart = ({ mean, threshold, unit }) => {
    // Asumimos una desviación estándar para la visualización. 
    // Un valor entre 5 y 10 suele funcionar bien para temperaturas en K.
    const stdDev = 8; 
    const chartData = generateBellCurveData(mean, stdDev);

    // Determina si el umbral representa un riesgo por ser alto o bajo
    const isRiskHigh = threshold > mean;

    // Encuentra el valor máximo y mínimo en el eje X para delimitar el área de riesgo
    const xDomain = [chartData[0].x, chartData[chartData.length - 1].x];

    // --- MEJORA: Evitar solapamiento de etiquetas ---
    const areLabelsClose = Math.abs(mean - threshold) < 12;

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
                        tick={{ fontSize: 12, fill: '#757575' }}
                        label={{ value: `Valor (${unit})`, position: 'insideBottom', offset: -10, fill: '#757575' }}
                    />
                    <YAxis hide={true} domain={[0, 'dataMax']} />
                    <Tooltip
                        formatter={(value, name, props) => [`${props.payload.x} ${unit}`, 'Valor']}
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
                        x1={isRiskHigh ? threshold : xDomain[0]}
                        x2={isRiskHigh ? xDomain[1] : threshold}
                        stroke="none"
                        fill="#F44336" // Rojo de riesgo
                        fillOpacity={0.2} // Hacemos el color semitransparente
                    >
                        <Label value="Zona de Riesgo" position="insideTop" fill="#B71C1C" fontSize={12} />
                    </ReferenceArea>

                    {/* Línea de la Media Histórica */}
                    <ReferenceLine x={mean} stroke="#2196F3" strokeWidth={2} strokeDasharray="4 4">
                        <Label 
                            value={`Media: ${mean.toFixed(1)}`} 
                            position="top" 
                            fill="#1E88E5"
                            fontSize={12} 
                        />
                    </ReferenceLine>

                    {/* Línea del Umbral de Riesgo */}
                    <ReferenceLine x={threshold} stroke="#F44336" strokeWidth={2}>
                        {/* --- MEJORA: Posiciona la etiqueta dentro del área de riesgo si está muy cerca de la media --- */}
                        <Label 
                            value={`Límite: ${threshold.toFixed(1)}`} 
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