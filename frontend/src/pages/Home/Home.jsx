import React, { useState, useEffect } from 'react';
import './Home.css'; 
import ProbabilityCard from '../../components/ProbabilityCard';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import DistributionChart from '../../components/DistributionChart';
import Chatbox from '../../components/Chatbox'; // <-- 1. Importar el nuevo componente de chat
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_URL = 'http://localhost:3000/api/probability'; 

// Variables climáticas
const VARIABLES = [
    { value: 'calido', label: '☀️ Muy Cálido' },
    { value: 'frio', label: '🥶 Muy Frío' }, // 👈 Cambié 'cold' por 'frio'
    { value: 'humedo', label: '🌧️ Muy Húmedo' }, // 👈 Cambié 'wet' por 'humedo'
    { value: 'ventoso', label: '💨 Muy Ventoso' }, // 👈 Cambié 'windy' por 'ventoso'
    { value: 'incomodo', label: '🥵 Muy Incómodo' }, // 👈 Cambié 'uncomfortable' por 'incomodo'
    { value: 'polvo', label: '🌪️ Mucho Polvo' }, // 👈 Cambié 'dust' por 'polvo'
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

    const handleSearch = async () => {
        setLoading(true); 
        setError(null);    
        setResults(null);  

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
                            type="number" 
                            min="1" max="31"
                            value={date.day}
                            onChange={(e) => setDate({ ...date, day: e.target.value })}
                        />
                        <label>📅 Mes:</label>
                        <input 
                            type="number" 
                            min="1" max="12"
                            value={date.month}
                            onChange={(e) => setDate({ ...date, month: e.target.value })}
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

            {/* --- MEJORA: Manejo del estado de reprocesamiento --- */}
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
                            {/* 2. Reemplazar el placeholder con el componente del gráfico */}
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

            {/* --- MEJORA: Añadir el Chatbox flotante --- */}
            <Chatbox location={location} date={date} variable={variable} />
        </div>
    );
};

export default HomePage;
