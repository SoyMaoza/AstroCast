import React, { useState, useEffect } from 'react';
import './Home.css'; 
import ProbabilityCard from '../../components/ProbabilityCard';
import { FaSearch } from 'react-icons/fa'; // Importamos el ícono de búsqueda
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
    { value: 'warm', label: '☀️ Very Warm' },
    { value: 'cold', label: '🥶 Very Cold' },
    { value: 'windy', label: '💨 Very Windy' },
    { value: 'humid', label: '💧 Very Humid' },
    { value: 'rainy', label: '🌧️ Very Rainy' },
    { value: 'snowy', label: '❄️ Very Snowy' },
    { value: 'cloudy', label: '☁️ Very Cloudy' },
    { value: 'uncomfortable', label: '🥵 Very Uncomfortable' },
    { value: 'dusty', label: '🌪️ Very Dusty' },
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

const HomePage = ({ location, setLocation, date, setDate, variable, setVariable }) => {

    // --- NUEVO: Estado para el buscador de ubicaciones ---
    const [searchQuery, setSearchQuery] = useState("");
    // Estados principales



    // Estados para los resultados de la API
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
            return 'Day and month must be valid numbers.';
        }
        if (monthNum > 12) {
            return 'Month cannot be greater than 12.';
        }
        const daysInMonth = new Date(2024, monthNum, 0).getDate();
        if (dayNum > daysInMonth) {
            return `Month ${monthNum} only has ${daysInMonth} days.`;
        }
        return null;
    };

    // --- NUEVO: Función para buscar coordenadas por nombre de lugar ---
    const handleGeocodeSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;

        setLoading(true);
        setError(null);

        try {
            // Usamos la API de Nominatim (OpenStreetMap) que es gratuita y no requiere clave.
            const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`;
            const response = await fetch(geocodeUrl);
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0]; // Tomamos el primer resultado
                setLocation({ lat: parseFloat(lat), lon: parseFloat(lon) });
            } else {
                setError(`No results found for "${searchQuery}".`);
            }
        } catch (err) {
            console.error("Geocoding error:", err);
            setError("Could not connect to the location search service.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        setLoading(true); 
        setError(null);    
        setResults(null);  

        const dateError = validateDate(date.day, date.month);
        if (dateError) {
            setError(`Date Error: ${dateError}`);
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
            console.error("API query error:", err);
            setError(err.message || 'Unknown error connecting to the data service.');
        } finally {
            setLoading(false); 
        }
    };

    const getVariableButtonClass = (val) => 
        `variable-btn ${variable === val ? 'active' : ''}`;

    return (
        <div className="container homepage-container">
            <header className="page-header">
                <h1>Your Historical Weather Guide</h1>
                <p>Plan your outdoor event with NASA's earth observation data.</p>
            </header>

            {/* --- NUEVO: Buscador de Ubicaciones --- */}
            <div className="location-search-container">
                <form onSubmit={handleGeocodeSearch} className="location-search-form">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Enter a location:"
                        className="location-search-input"
                    />
                    <button type="submit" className="location-search-btn" aria-label="Search location">
                        <FaSearch />
                    </button>
                </form>
            </div>

            <div className="control-panel">
                {/* Inputs de consulta */}
                <div className="query-card">
                    <h2>Define Your Query</h2>    
                    <div className="input-group">
                        <label>📍 Latitude:</label>
                        <input 
                            type="number" 
                            name="lat"
                            step="0.01" 
                            value={location.lat} 
                            onChange={handleLocationChange} 
                        />
                        <label>📍 Longitude:</label>
                        <input 
                            type="number" 
                            name="lon"
                            step="0.01" 
                            value={location.lon} 
                            onChange={handleLocationChange} 
                        />
                    </div>

                    <div className="input-group">
                        <label>📅 Day:</label>
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
                        <label>📅 Month:</label>
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
                        <label>Condition to Analyze:</label>
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
                        {loading ? 'Analyzing Data...' : 'Analyze Probabilities'}
                    </button>
                    
                    {error && <p className="error-message">🚨 {error}</p>}
                </div>

                {/* Mapa */}
                <div className="map-card">
                    <h3 className="map-title">Selected Location</h3>
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
                        <h3>⚙️ Processing Historical Data</h3>
                        <p>{results.message}</p>
                    </div>
                </div>
            )}

            {results && (
                <div className="results-section">
                    <h2 className="results-header">
                        Historical Results for {results.location || 'Location'} on {results.date || 'Date'}
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
                            <h3>Analysis Details</h3>
                            <p className="detail-description">{results.detailDescription}</p>
                            
                            <h3 style={{marginTop: '15px'}}>Visualization</h3>
                            <DistributionChart 
                                mean={results.historicalMean}
                                threshold={results.threshold}
                                unit={results.unit}
                            />
                            
                            {results.downloadLink && (
                                <a href={results.downloadLink} target="_blank" rel="noopener noreferrer" className="download-link">
                                    Download Historical Data from NASA (OPeNDAP) ↓
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
