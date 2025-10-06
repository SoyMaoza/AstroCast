import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Label, ReferenceArea } from 'recharts';

const kelvinToCelsius = (k) => k - 273.15;
const kelvinToFahrenheit = (k) => (k - 273.15) * 9/5 + 32;

const generateBellCurveData = (mean, stdDev) => {
    const data = [];
    for (let i = -3.5; i <= 3.5; i += 0.1) {
        const x = mean + i * stdDev;
        const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
        data.push({ x: x, y: y });
    }
    return data;
};

const DistributionChart = ({ mean, threshold, unit, displayUnit = 'C' }) => {
    let stdDev;
    if (unit && unit.includes('fraction')) {
        stdDev = 0.15;
    } else if (unit === 'mm/day') {
        stdDev = Math.max(mean * 1.5, 0.5); 
    } else if (unit === 'kg/kg') {
        stdDev = 0.002;
    } else {
        stdDev = 8;
    }


    const [animatedOpacity, setAnimatedOpacity] = useState(0);

    useEffect(() => {
        setAnimatedOpacity(0);
        const timer = setTimeout(() => {
            setAnimatedOpacity(1);
        }, 100);
        return () => clearTimeout(timer);
    }, [mean, threshold]); // Rerun animation if data changes

    if (typeof mean !== 'number' || typeof threshold !== 'number') {
        return (
            <div style={{ width: '100%', height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                Datos insuficientes para mostrar la visualización.
            </div>
        );
    }

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

    const isRiskHigh = threshold > mean;

    const originalChartData = generateBellCurveData(mean, stdDev);
    const xDomain = [originalChartData[0].x, originalChartData[originalChartData.length - 1].x];

    const areLabelsClose = Math.abs(displayMean - displayThreshold) < (displayMean / 4);

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
                    
                    <Line type="monotone" dataKey="y" stroke="#3F51B5" strokeWidth={2} dot={false} name="Frecuencia Histórica" />

                    <ReferenceArea
                        x1={isRiskHigh ? displayThreshold : chartData[0].x}
                        x2={isRiskHigh ? chartData[chartData.length - 1].x : displayThreshold}
                        stroke="none"
                        fill="#F44336"
                        fillOpacity={animatedOpacity * 0.2}
                        style={{ transition: 'fill-opacity 1.2s ease-out' }}
                    >
                        <Label value="Risk Zone" position="insideTop" fill="#B71C1C" fontSize={12} />
                    </ReferenceArea>

                    <ReferenceLine 
                        x={displayMean} 
                        stroke="#2196F3" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        strokeOpacity={animatedOpacity}
                        style={{ transition: 'stroke-opacity 0.8s ease-out 0.2s' }}
                    >
                        <Label 
                            value={`Average: ${displayMean.toFixed(2)}`} 
                            position="top" 
                            fill="#1E88E5"
                            fontSize={12} 
                        />
                    </ReferenceLine>

                    <ReferenceLine 
                        x={displayThreshold} 
                        stroke="#F44336" 
                        strokeWidth={2}
                        strokeOpacity={animatedOpacity}
                        style={{ transition: 'stroke-opacity 0.8s ease-out 0.3s' }}
                    >
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