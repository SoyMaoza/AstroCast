import React, { useState, useEffect } from 'react';
import './Home.css'; 
import ProbabilityCard from '../../components/ProbabilityCard';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import DistributionChart from '../../components/DistributionChart';
import Chatbox from '../../components/Chatbox';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- MEJORA: URL de API dinámica y robusta ---
// Determina si estamos en un entorno de desarrollo local o en la red.
// `import.meta.env.DEV` es una variable especial de Vite.
const isDevelopment = import.meta.env.DEV;
const backendHostname = isDevelopment ? 'localhost' : window.location.hostname;
const API_URL = `http://${backendHostname}:3001/api/climate-probability`;

// Variables climáticas
const VARIABLES = [
    { value: 'calido', label: '☀️ Muy Cálido' },
    { value: 'frio', label: '🥶 Muy Frío' },
    { value: 'humedo', label: '🌧️ Muy Húmedo' },
    { value: 'ventoso', label: '💨 Muy Ventoso' },
    { value: 'incomodo', label: '🥵 Muy Incómodo' },
    { value: 'polvo', label: '🌪️ Mucho Polvo' },
];

// Fix icono default Leaflet
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
        <Marker position={[location.lat, location.lon]} />
    );
}

const HomePage = () => {
    // Estados principales
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
        const sanitizedValue = value.replace(/\./g, '');
        setDate(prev => ({ ...prev, [name]: sanitizedValue.slice(0, 2) }));
    };

    const handleDateKeyDown = (e) => {
        if (e.key === '.' || e.key === 'e' || e.key === 'E') {
            e.preventDefault();
        }
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
        const daysInMonth = new Date(2024, monthNum, 0).getDate();
        if (dayNum > daysInMonth) {
            return `El mes ${monthNum} solo tiene ${daysInMonth} días.`;
        }
        return null;
    };

    const handleSearch = async () => {
        setLoading(true); 
        setError(null);    
        setResults(null);  

        const dateError = validateDate(date.day, date.month);
        if (dateError) {
            setError(`Error en la fecha: ${dateError}`);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: parseFloat(location.lat), 
                    lon: parseFloat(location.lon),
                    day: parseInt(date.day),
                    month: parseInt(date.month),
                    variable: variable
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error del servidor: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            setResults(data);

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
            <header className="page-header">
                <h1>Tu Guía de Clima Histórico</h1>
                <p>Planifica tu evento al aire libre con datos de observación terrestre de la NASA.</p>
            </header>

            <div className="control-panel">
                {/* Inputs de consulta */}
                <div className="query-card">
                    <h2>Define tu Consulta</h2>
                    
                    <div className="input-group">
                        <label>📍 Latitud:</label>
                        <input 
                            type="number" 
                            name="lat"
                            step="0.01" 
                            value={location.lat} 
                            onChange={handleLocationChange} 
                        />
                        <label>📍 Longitud:</label>
                        <input 
                            type="number" 
                            name="lon"
                            step="0.01" 
                            value={location.lon} 
                            onChange={handleLocationChange} 
                        />
                    </div>

                    <div className="input-group">
                        <label>📅 Día:</label>
                        <input 
                            id="day-input"
                            type="number"
                            name="day"
                            min="1" 
                            max="31" 
                            value={date.day} 
                            onChange={handleDateChange}
                            onKeyDown={handleDateKeyDown} 
                        />
                        <label>📅 Mes:</label>
                        <input 
                            id="month-input"
                            type="number"
                            name="month"
                            min="1" 
                            max="12" 
                            value={date.month} 
                            onChange={handleDateChange}
                            onKeyDown={handleDateKeyDown} 
                        />
                    </div>
                    
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

                    <button 
                        className="btn-primary" 
                        onClick={handleSearch} 
                        disabled={loading}
                    >
                        {loading ? 'Analizando Datos...' : 'Analizar Probabilidades'}
                    </button>
                    
                    {error && <p className="error-message">🚨 {error}</p>}
                </div>

                {/* Mapa */}
                <div className="map-card">
                    <h3 className="map-title">Ubicación Seleccionada</h3>
                    <MapContainer 
                        center={[location.lat, location.lon]} 
                        zoom={5} 
                        scrollWheelZoom={true} 
                        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
                    >
                        <TileLayer
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker location={location} setLocation={setLocation} />
                    </MapContainer>
                </div>
            </div>

            {results && results.reprocessing && (
                <div className="results-section">
                     <div className="reprocessing-card">
                        <h3>⚙️ Procesando Datos Históricos</h3>
                        <p>{results.message}</p>
                    </div>
                </div>
            )}

            {results && (
                <div className="results-section">
                    <h2 className="results-header">
                        Resultados Históricos para {results.location || 'Ubicación'} en {results.date || 'Fecha'}
                    </h2>
                    
                    <div className="results-grid">
                        <ProbabilityCard
                            variable={results.variable} 
                            probability={results.probability}
                            historicalMean={results.historicalMean}
                            threshold={results.threshold}
                            unit={results.unit}
                            downloadLink={results.downloadLink}
                            detailDescription={results.detailDescription}
                        />

                        <div className="data-visualization-card">
                            <h3>Detalles del Análisis</h3>
                            <p className="detail-description">{results.detailDescription}</p>
                            
                            <h3 style={{marginTop: '15px'}}>Visualización</h3>
                            <DistributionChart 
                                mean={results.historicalMean}
                                threshold={results.threshold}
                                unit={results.unit}
                            />
                            
                            {results.downloadLink && (
                                <a href={results.downloadLink} target="_blank" rel="noopener noreferrer" className="download-link">
                                    Descargar Datos Históricos de NASA (OPeNDAP) ↓
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Chatbox location={location} date={date} variable={variable} />
        </div>
    );
};

export default HomePage;
