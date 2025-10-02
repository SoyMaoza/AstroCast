
import React, { useState } from 'react';
import './Home.css'; 
import ProbabilityCard from '../../components/ProbabilityCard';
const API_URL = 'http://localhost:3000/api/probability'; 

// DESPUÉS (ESPAÑOL - Correcto)
const VARIABLES = [
    { value: 'calido', label: '☀️ Muy Cálido' },
    { value: 'frio', label: '🥶 Muy Frío' },
    { value: 'humedo', label: '🌧️ Muy Húmedo' }, // 👈 Cambié 'wet' por 'humedo'
    { value: 'ventoso', label: '💨 Muy Ventoso' }, // 👈 Cambié 'windy' por 'ventoso'
    { value: 'incomodo', label: '🥵 Muy Incómodo' }, // 👈 Cambié 'uncomfortable' por 'incomodo'
    { value: 'polvo', label: '🌪️ Mucho Polvo' }, // 👈 Cambié 'dust' por 'polvo'
];

const HomePage = () => {
    // 1. Estados de la aplicación
    const [location, setLocation] = useState({ lat: 0, lon: -0 }); 
    const [date, setDate] = useState({ day: 0, month: 0 }); 
    const [variable, setVariable] = useState('hot'); 
    const [results, setResults] = useState(null); 
    const [loading, setLoading] = useState(false); 
    const [error, setError] = useState(null);


    const handleSearch = async () => {
        setLoading(true); 
        setError(null);    
        setResults(null);  

        // Validación de inputs
        const validLat = !isNaN(parseFloat(location.lat));
        const validLon = !isNaN(parseFloat(location.lon));
        const validDay = date.day >= 1 && date.day <= 31;
        const validMonth = date.month >= 1 && date.month <= 12;

        if (!validLat || !validLon || !validDay || !validMonth || !variable) {
            setError('🚨 Por favor, introduce Latitud/Longitud válidas y una fecha correcta (Día 1-31, Mes 1-12).');
            setLoading(false);
            return;
        }

        try {
            // Realiza la petición POST a tu API
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ // Envía los datos al backend
                    // Aseguramos que se envíen como números (aunque el backend los parsea)
                    lat: parseFloat(location.lat), 
                    lon: parseFloat(location.lon),
                    day: parseInt(date.day),
                    month: parseInt(date.month),
                    variable: variable
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                // El backend devuelve el error de simulación de 0,0 aquí
                throw new Error(errorData.message || `Error del servidor: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            setResults(data); // Almacena los datos REALES del backend

        } catch (err) {
            console.error("Error en la consulta a la API:", err);
            setError(err.message || 'Error desconocido al conectar con el servicio de datos.');
        } finally {
            setLoading(false); 
        }
    };

    const getVariableButtonClass = (val) => 
        `variable-btn ${variable === val ? 'active' : ''}`;

    return (
        <div className="container homepage-container">
            {/* Encabezado Amigable */}
            <header className="page-header">
                <h1>Tu Guía de Clima Histórico</h1>
                <p>Planifica tu evento al aire libre con datos de observación terrestre de la **NASA**.</p>
            </header>

            {/* --- PANEL DE CONTROL --- */}
            <div className="control-panel">
                
                {/* Columna 1: Inputs de Consulta */}
                <div className="query-card">
                    <h2>Define tu Consulta</h2>
                    
                    {/* Sección 1: Ubicación */}
                    <div className="input-group">
                        <label htmlFor="lat-input">📍 Latitud:</label>
                        <input 
                            id="lat-input"
                            type="number" 
                            step="0.01" 
                            value={location.lat} 
                            onChange={(e) => setLocation({ ...location, lat: e.target.value })} 
                        />
                        <label htmlFor="lon-input">📍 Longitud:</label>
                        <input 
                            id="lon-input"
                            type="number" 
                            step="0.01" 
                            value={location.lon} 
                            onChange={(e) => setLocation({ ...location, lon: e.target.value })} 
                        />
                    </div>

                    {/* Sección 2: Fecha */}
                    <div className="input-group">
                        <label htmlFor="day-input">📅 Día del Mes:</label>
                        <input 
                            id="day-input"
                            type="number" 
                            min="1" 
                            max="31" 
                            value={date.day} 
                            onChange={(e) => setDate({ ...date, day: e.target.value })} 
                        />
                        <label htmlFor="month-input">📅 Mes (1-12):</label>
                        <input 
                            id="month-input"
                            type="number" 
                            min="1" 
                            max="12" 
                            value={date.month} 
                            onChange={(e) => setDate({ ...date, month: e.target.value })} 
                        />
                    </div>
                    
                    {/* Sección 3: Variable Climática */}
                    <div className="variable-selector">
                        <label>Condición a Analizar:</label>
                        <div className="variable-buttons">
                            {VARIABLES.map(v => (
                                <button
                                    key={v.value}
                                    className={getVariableButtonClass(v.value)}
                                    onClick={() => setVariable(v.value)}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Botón para iniciar la búsqueda */}
                    <button 
                        className="btn-primary" 
                        onClick={handleSearch} 
                        disabled={loading}
                    >
                        {loading ? 'Analizando Datos...' : 'Analizar Probabilidades'}
                    </button>
                    
                    {/* Muestra mensajes de error si existen */}
                    {error && <p className="error-message">🚨 {error}</p>}
                </div>

                {/* Columna 2: Mapa y Visualización de Ubicación */}
                <div className="map-card">
                    <h3 className="map-title">Ubicación Seleccionada</h3>
                    <div className="map-placeholder">
                        <p>📍 Latitud: {location.lat || 'N/A'}, Longitud: {location.lon || 'N/A'}</p>
                        <p className="map-note">[Aquí iría un Mapa Interactivo con el PIN]</p>
                    </div>
                </div>
            </div>

            {/* --- DASHBOARD DE RESULTADOS --- */}
            {results && (
                <div className="results-section">
                    <h2 className="results-header">
                        Resultados Históricos para {results.location || 'Ubicación Desconocida'} en {results.date || 'Fecha Desconocida'}
                    </h2>
                    
                    <div className="results-grid">
                        {/* 1. Tarjeta de Probabilidad */}
                        <ProbabilityCard
                            variable={results.variable} 
                            probability={results.probability}
                            historicalMean={results.historicalMean}
                            threshold={results.threshold}
                            unit={results.unit}
                            downloadLink={results.downloadLink}
                            detailDescription={results.detailDescription} // Pasamos la descripción detallada
                        />

                        {/* 2. Placeholder para la Descripción y Descarga */}
                        <div className="data-visualization-card">
                            <h3>Detalles del Análisis</h3>
                            <p className="detail-description">{results.detailDescription}</p>
                            
                            <h3 style={{marginTop: '15px'}}>Visualización</h3>
                            <div className="chart-placeholder">
                                <p>Gráfico de Distribución simulada (Campana) mostrando el umbral y el riesgo.</p>
                            </div>
                            
                            {/* El enlace de descarga apunta a la URL OPeNDAP real */}
                            {results.downloadLink && (
                                <a href={results.downloadLink} target="_blank" rel="noopener noreferrer" className="download-link">
                                    Descargar Enlace a Datos Históricos de NASA (OPeNDAP) ↓
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;