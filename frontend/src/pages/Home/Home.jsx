// src/pages/HomePage.jsx
import React, { useState } from 'react';
// ¡Ajusta esta ruta según tu estructura de carpetas!
import ProbabilityCard from '../components/UI/ProbabilityCard.jsx'; 
import '../styles/HomePage.css'; // ¡Asegúrate de tener este archivo!

// URL de tu API de backend
const API_URL = 'http://localhost:3000/api/probability'; 

const VARIABLES = [
    { value: 'hot', label: '🌡️ Muy Cálido' },
    { value: 'wet', label: '🌧️ Muy Húmedo' },
    { value: 'windy', label: '💨 Muy Ventoso' },
];

const HomePage = () => {
    // 1. Estados de la aplicación
    const [location, setLocation] = useState({ lat: 19.43, lon: -99.13 }); // CDMX por defecto
    const [date, setDate] = useState({ day: 15, month: 7 }); // 15 de Julio por defecto
    const [variable, setVariable] = useState('hot'); // Variable por defecto
    const [results, setResults] = useState(null); // Almacena los resultados de la API
    const [loading, setLoading] = useState(false); // Indica si una solicitud está en curso
    const [error, setError] = useState(null); // Almacena mensajes de error

    // 2. Manejador de la Consulta a la API Real
    const handleSearch = async () => {
        setLoading(true); // Activa el estado de carga
        setError(null);    // Limpia errores anteriores
        setResults(null);  // Limpia resultados anteriores

        // Validación simple de los inputs
        if (!location.lat || !location.lon || !date.day || !date.month || !variable) {
            setError('Por favor, completa todos los campos de ubicación, fecha y selecciona una condición.');
            setLoading(false);
            return;
        }

        try {
            // Realiza la petición POST a tu API
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ // Envía los datos como JSON
                    lat: location.lat,
                    lon: location.lon,
                    day: date.day,
                    month: date.month,
                    variable: variable
                })
            });

            // Verifica si la respuesta de la red fue exitosa (código 2xx)
            if (!response.ok) {
                // Si hay un error, intenta leer el mensaje de error del servidor
                const errorData = await response.json();
                throw new Error(errorData.message || `Error del servidor: ${response.status} ${response.statusText}`);
            }

            // Si la respuesta fue exitosa, parsea los datos JSON
            const data = await response.json();
            setResults(data); // Almacena los datos en el estado

        } catch (err) {
            console.error("Error en la consulta a la API:", err);
            setError(err.message || 'Error desconocido al conectar con el servicio de datos.');
        } finally {
            setLoading(false); // Desactiva el estado de carga al finalizar
        }
    };

    // Función auxiliar para aplicar la clase 'active' a los botones de variable
    const getVariableButtonClass = (val) => 
        `variable-btn ${variable === val ? 'active' : ''}`;

    return (
        <div className="container homepage-container">
            {/* Encabezado Amigable */}
            <header className="page-header">
                <h1>Tu Guía de Clima Histórico</h1>
                <p>Planifica tu evento al aire libre con datos de observación terrestre de la **NASA**.</p>
            </header>

            {/* --- PANEL DE CONTROL (Dos Columnas) --- */}
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
                            onChange={(e) => setLocation({ ...location, lat: parseFloat(e.target.value) })} 
                        />
                        <label htmlFor="lon-input">📍 Longitud:</label>
                        <input 
                            id="lon-input"
                            type="number" 
                            step="0.01" 
                            value={location.lon} 
                            onChange={(e) => setLocation({ ...location, lon: parseFloat(e.target.value) })} 
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
                            onChange={(e) => setDate({ ...date, day: parseInt(e.target.value) || 1 })} 
                        />
                        <label htmlFor="month-input">📅 Mes (1-12):</label>
                        <input 
                            id="month-input"
                            type="number" 
                            min="1" 
                            max="12" 
                            value={date.month} 
                            onChange={(e) => setDate({ ...date, month: parseInt(e.target.value) || 1 })} 
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
                        disabled={loading} // Deshabilita el botón durante la carga
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
                        <p>📍 Latitud: {location.lat.toFixed(4)}, Longitud: {location.lon.toFixed(4)}</p>
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
                        />

                        {/* 2. Placeholder para el Gráfico de Campana/Distribución */}
                        <div className="data-visualization-card">
                            <h3>Distribución Histórica</h3>
                            <div className="chart-placeholder">
                                <p>Gráfico de Campana (Bell Curve) mostrando la probabilidad de exceder el umbral ({results.threshold}{results.unit}).</p>
                            </div>
                            {results.downloadLink && (
                                <a href={results.downloadLink} className="download-link" download>
                                    Descargar Datos Históricos (JSON) ↓
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