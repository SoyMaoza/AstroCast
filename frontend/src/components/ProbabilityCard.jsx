import React from 'react';
import './ProbabilityCard.css'; // Importa los estilos específicos

// --- MEJORA: Funciones de conversión de temperatura ---
const kelvinToCelsius = (k) => k - 273.15;
const kelvinToFahrenheit = (k) => (k - 273.15) * 9/5 + 32;

// Añadimos todas las variables del backend
const conditionConfig = {
    hot: { 
        icon: '☀️', 
        label: 'Muy Cálido', 
    },
    cold: { 
        icon: '🥶', 
        label: 'Muy Frío', 
    },
    wet: { 
        icon: '🌧️', 
        label: 'Muy Húmedo', 
    },
    windy: { 
        icon: '💨', 
        label: 'Muy Ventoso', 
    },
    uncomfortable: { 
        icon: '🥵', 
        label: 'Muy Incómodo', 
    },
    dust: { 
        icon: '🌪️', 
        label: 'Mucho Polvo', 
    },
    // Añade más variables aquí si las incluyes en tu backend/mock
};

const ProbabilityCard = ({ variable, probability, historicalMean, threshold, unit, downloadLink, detailDescription, displayUnit = 'C' }) => {
    // Determinar la clase de riesgo basada en la probabilidad para cambiar el color
    let riskClass;
    if (probability === -1) {
        riskClass = 'risk-low'; // Color neutral para respuestas cacheadas
    } else if (probability >= 70) {
        riskClass = 'risk-extreme'; // Rojo
    } else if (probability >= 40) {
        riskClass = 'risk-high';    // Naranja
    } else {
        riskClass = 'risk-low';     // Verde
    }

    const config = conditionConfig[variable] || { icon: '❓', label: 'Condición Desconocida' };

    // --- MEJORA: Conversión de unidades para visualización ---
    let displayMean = historicalMean;
    let displayThreshold = threshold;
    let displayUnitSymbol = unit;

    if (unit === 'K' && (variable === 'hot' || variable === 'cold')) {
        if (displayUnit === 'C') {
            displayMean = kelvinToCelsius(historicalMean);
            displayThreshold = kelvinToCelsius(threshold);
            displayUnitSymbol = '°C';
        } else if (displayUnit === 'F') {
            displayMean = kelvinToFahrenheit(historicalMean);
            displayThreshold = kelvinToFahrenheit(threshold);
            displayUnitSymbol = '°F';
        }
    }

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
                    {/* --- MEJORA: Manejar el caso de probabilidad -1 (desde caché) --- */}
                    {probability === -1 ? (
                        <span style={{ fontSize: '1.8rem', fontWeight: '500', color: '#757575' }}>Desde Caché</span>
                    ) : (
                        <>{probability}<span className="percent-sign">%</span></>
                    )}
                </div>
                
                <div className="card-details">
                    <p>Media Histórica (MERRA-2): <strong>{displayMean.toFixed(1)} {displayUnitSymbol}</strong></p>
                    <p>Umbral de Condición: <strong>{displayThreshold.toFixed(1)} {displayUnitSymbol}</strong></p>
                </div>
                
                {/* La descripción detallada del backend */}
                <p className="card-description-small">
                    * {detailDescription}
                </p>

                {/* El enlace de descarga apunta a la URL OPeNDAP real */}
                {downloadLink && (
                    <a href={downloadLink} target="_blank" rel="noopener noreferrer" className="download-btn">
                        <i className="fas fa-external-link-alt"></i> Ver Fuente de Datos NASA
                    </a>
                )}
            </div>
        </div>
    );
}; // <-- ESTA ES LA LLAVE QUE FALTABA

export default ProbabilityCard;