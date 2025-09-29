import React from 'react';
import './ProbabilityCard.css'; // Importa los estilos específicos

const conditionConfig = {
    hot: { 
        icon: '☀️', 
        label: 'Muy Cálido', 
    },
    wet: { 
        icon: '🌧️', 
        label: 'Muy Húmedo', 
    },
    windy: { 
        icon: '🌬️', 
        label: 'Muy Ventoso', 
    },
    // Añade más variables aquí si las incluyes en tu backend/mock
};

const ProbabilityCard = ({ variable, probability, historicalMean, threshold, unit, downloadLink }) => {
    // Determinar la clase de riesgo basada en la probabilidad para cambiar el color
    let riskClass;
    if (probability >= 70) {
        riskClass = 'risk-extreme'; // Rojo
    } else if (probability >= 40) {
        riskClass = 'risk-high';    // Naranja
    } else {
        riskClass = 'risk-low';     // Verde
    }

    const config = conditionConfig[variable] || { icon: '❓', label: 'Condición Desconocida' };

    return (
        <div className={`probability-card ${riskClass}`}>
            {/* Barra de color superior para indicar riesgo */}
            <div className="risk-indicator"></div> 

            <div className="card-content">
                <div className="card-icon-wrapper">
                    <span className="card-icon">{config.icon}</span>
                </div>
                
                <h3 className="card-title">Probabilidad de {config.label}</h3>
                
                <div className="probability-value">
                    {probability}<span className="percent-sign">%</span>
                </div>
                
                <div className="card-details">
                    <p>Media Histórica del Día: <strong>{historicalMean} {unit}</strong></p>
                    <p>Umbral de Condición: <strong>{threshold} {unit}</strong></p>
                </div>
                
                {downloadLink && (
                    <a href={downloadLink} className="download-btn" download>
                        <i className="fas fa-download"></i> Descargar Datos Históricos
                    </a>
                )}
            </div>
        </div>
    );
};

export default ProbabilityCard;