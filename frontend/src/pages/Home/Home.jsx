
import React, { useState, useEffect } from 'react';
import './Home.css'; 
import ProbabilityCard from '../../components/ProbabilityCard';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import DistributionChart from '../../components/DistributionChart'; // <-- 1. Importar el nuevo componente
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
const API_URL = 'http://localhost:3000/api/probability'; 

// DESPUÉS (ESPAÑOL - Correcto)
const VARIABLES = [
    { value: 'calido', label: '☀️ Muy Cálido' },
    { value: 'frio', label: '🥶 Muy Frío' }, // 👈 Cambié 'cold' por 'frio'
    { value: 'humedo', label: '🌧️ Muy Húmedo' }, // 👈 Cambié 'wet' por 'humedo'
    { value: 'ventoso', label: '💨 Muy Ventoso' }, // 👈 Cambié 'windy' por 'ventoso'
    { value: 'incomodo', label: '🥵 Muy Incómodo' }, // 👈 Cambié 'uncomfortable' por 'incomodo'
    { value: 'polvo', label: '🌪️ Mucho Polvo' }, // 👈 Cambié 'dust' por 'polvo'
];

// Corrige el problema del icono por defecto en Leaflet con Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function LocationMarker({ location, setLocation }) {
    const map = useMap();

    useEffect(() => {
        if (location.lat !== null && location.lon !== null) {
            map.flyTo([location.lat, location.lon], map.getZoom());
        }
    }, [location, map]);

    useMapEvents({
        click(e) {
            setLocation({ lat: e.latlng.lat, lon: e.latlng.lng });
        },
    });

    return location.lat === null ? null : (
        <Marker position={[location.lat, location.lon]}></Marker>
    );
}

const HomePage = () => {
    // 1. Estados de la aplicación
    const [location, setLocation] = useState({ lat: 19.43, lon: -99.13 }); 
    const [date, setDate] = useState({ day: 1, month: 1 }); 
    const [variable, setVariable] = useState('calido'); 
    const [results, setResults] = useState(null); 
    const [loading, setLoading] = useState(false); 
    const [error, setError] = useState(null);

    const handleLocationChange = (e) => {
        const { name, value } = e.target;
        setLocation(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        // Limita la entrada a un máximo de 2 dígitos.
        setDate(prev => ({ ...prev, [name]: value.slice(0, 2) }));
    };

    const validateDate = (day, month) => {
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);

        if (isNaN(dayNum) || isNaN(monthNum) || dayNum < 1 || monthNum < 1) {
            return 'El día y el mes deben ser números válidos.';
        }
        if (monthNum > 12) {
            return 'El mes no puede ser mayor que 12.';
        }
        // Obtenemos los días del mes. Usamos un año bisiesto (2024) para permitir el 29 de febrero.
        const daysInMonth = new Date(2024, monthNum, 0).getDate();
        if (dayNum > daysInMonth) {
            return `El mes ${monthNum} solo tiene ${daysInMonth} días.`;
        }
        return null; // La fecha es válida
    };

    const handleSearch = async () => {
        setLoading(true); 
        setError(null);    
        setResults(null);  

        // Validación de inputs
        const dateError = validateDate(date.day, date.month);
        if (dateError) {
            setError(`Error en la fecha: ${dateError}`);
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
                            name="lat"
                            step="0.01" 
                            value={location.lat} 
                            onChange={handleLocationChange} 
                        />
                        <label htmlFor="lon-input">📍 Longitud:</label>
                        <input 
                            id="lon-input"
                            type="number" 
                            name="lon"
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
                            name="day"
                            min="1" 
                            max="31" 
                            value={date.day} 
                            onChange={handleDateChange} 
                        />
                        <label htmlFor="month-input">📅 Mes (1-12):</label>
                        <input 
                            id="month-input"
                            type="number"
                            name="month"
                            min="1" 
                            max="12" 
                            value={date.month} 
                            onChange={handleDateChange} 
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
                    <MapContainer 
                        center={[location.lat, location.lon]} 
                        zoom={5} 
                        scrollWheelZoom={true} 
                        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker location={location} setLocation={setLocation} />
                    </MapContainer>
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
                            {/* 2. Reemplazar el placeholder con el componente del gráfico */}
                            <DistributionChart 
                                mean={results.historicalMean}
                                threshold={results.threshold}
                                unit={results.unit}
                            />
                            
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