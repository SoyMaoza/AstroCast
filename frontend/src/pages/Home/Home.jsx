import React, { useState, useEffect, useRef } from 'react';
import './Home.css'; 
import ProbabilityCard from '../../components/ProbabilityCard';
import Gauge from '../../components/Gauge';
import { FaSearch } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import DistributionChart from '../../components/DistributionChart';
import Chatbox from '../../components/Chatbox';
import 'leaflet/dist/leaflet.css';
import html2canvas from 'html2canvas';
import L from 'leaflet';

// 🌐 --- CONFIGURACIÓN ROBUSTA DE URL BASE ---
// 1️⃣ Usa la URL del backend desde .env si existe
// 2️⃣ Elimina cualquier slash extra al final para evitar "//"
// 3️⃣ Si no hay variable definida, usa el hostname local dinámico
// const backendHostname = import.meta.env.VITE_BACKEND_URL
//   ? import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, '')
//   : (typeof window !== 'undefined'
//       ? `http://${window.location.hostname}:3001`
//       : 'http://localhost:3001');

// 🔹 URL base para todos los endpoints de API
const API_BASE_URL = ('http://localhost:3001/api'  || `import.meta.env.VITE_BACKEND_URL`).replace(/\/+$/, '')

// 🔹 URL específica para chat (opcional)
const CHAT_API_URL = `${API_BASE_URL}/chat`;

// 🌡️ Conversión de unidades
const kelvinToCelsius = (k) => k - 273.15;
const kelvinToFahrenheit = (k) => (k - 273.15) * 9/5 + 32;

// 🌦️ Variables climáticas
const VARIABLES = [
  { value: 'warm', label: '☀️ Very Warm' },
  { value: 'cold', label: '🥶 Very Cold' },
  { value: 'windy', label: '💨 Very Windy' },
  { value: 'humid', label: '💧 Very Humid' },
  { value: 'rainy', label: '🌧️ Very Rainy' },
  { value: 'snowy', label: '❄️ Very Snowy' },
  { value: 'cloudy', label: '☁️ Very Cloudy' },
  { value: 'dusty', label: '🌪️ Very Dusty' },
];

// 📍 Fix icono default Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// 📍 Componente de marcador en el mapa
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
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null);
  const [temperatureUnit, setTemperatureUnit] = useState('C');
  const resultsRef = useRef(null);
  const chartRef = useRef(null); // <-- NEW: Ref to capture the chart element

  useEffect(() => {
    if (results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  // --- Funciones de input ---
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
    if (['.', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const validateDate = (day, month) => {
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    if (isNaN(dayNum) || isNaN(monthNum) || dayNum < 1 || monthNum < 1) return 'Day and month must be valid numbers.';
    if (monthNum > 12) return 'Month cannot be greater than 12.';
    const daysInMonth = new Date(2024, monthNum, 0).getDate();
    if (dayNum > daysInMonth) return `Month ${monthNum} only has ${daysInMonth} days.`;
    return null;
  };

  // --- Geocoding ---
  const handleGeocodeSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data?.length > 0) {
        const { lat, lon } = data[0];
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

  // --- Consulta principal a la API ---
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
      const response = await fetch(`${API_BASE_URL}/climate-probability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(location.lat), 
          lon: parseFloat(location.lon),
          day: parseInt(date.day),
          month: parseInt(date.month),
          variable
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server error: ${response.status} ${response.statusText}`);
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

  // --- Descarga de datos ---
  const handleDownload = () => {
    const { lat, lon } = location;
    const { day, month } = date;
    let downloadUrl = `${API_BASE_URL}/download-data?lat=${lat}&lon=${lon}&day=${day}&month=${month}&variable=${variable}&format=json`;

    if (['warm', 'cold'].includes(variable)) {
      downloadUrl += `&displayUnit=${temperatureUnit}`;
    }
    window.open(downloadUrl, '_blank');
  };

  // --- NEW: Chart Download Functionality ---
  const handleChartDownload = async () => {
    if (!chartRef.current) {
      console.error("Chart element not found for download.");
      return;
    }

    try {
      const canvas = await html2canvas(chartRef.current, {
        useCORS: true, // Important for external images/fonts if any
        backgroundColor: '#FFFFFF', // --- FIX: Use a solid white background for the download ---
      });
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `AstroCast_Chart_${variable}_${date.day}-${date.month}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error generating chart image:", err);
    }
  };
  // --- Conversión de unidades en UI ---
  const isTemperatureVariable = results && ['warm', 'cold'].includes(results.variable);
  let displayMean = results ? results.historicalMean : 0;
  let displayUnitSymbol = results ? results.unit : '';

  if (results && isTemperatureVariable && results.unit === 'K') {
    if (temperatureUnit === 'C') displayMean = kelvinToCelsius(results.historicalMean), displayUnitSymbol = '°C';
    else if (temperatureUnit === 'F') displayMean = kelvinToFahrenheit(results.historicalMean), displayUnitSymbol = '°F';
    else displayMean = results.historicalMean, displayUnitSymbol = 'K';
  }

  const startYear = (results && results.variable === 'rainy') ? 1998 : 1980;
  const historicalRange = `${startYear}-${new Date().getFullYear()}`;
  const detailDescription = results
    ? `The probability of the '${results.variable}' condition occurring is ${results.probability}%, based on a historical average of ${displayMean.toFixed(2)} ${displayUnitSymbol} from ${historicalRange}.`
    : "";

  // --- Render principal ---
  return (
    <div className="container homepage-container">
      {/* Header */}
      <header className="page-header">
        <h1>Your Historical Weather Guide</h1>
        <p>Plan your outdoor event with NASA's earth observation data.</p>
      </header>

      {/* Buscador */}
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

      {/* Panel principal */}
      <div className="control-panel">
        <div className="query-card">
          <h2>Define Your Query</h2>    
          <div className="input-group">
            <label>📍 Latitude:</label>
            <input type="number" name="lat" step="0.01" value={location.lat} onChange={handleLocationChange} />
            <label>📍 Longitude:</label>
            <input type="number" name="lon" step="0.01" value={location.lon} onChange={handleLocationChange} />
          </div>

          <div className="input-group">
            <label>📅 Day:</label>
            <input id="day-input" type="number" name="day" min="1" max="31" value={date.day} onChange={handleDateChange} onKeyDown={handleDateKeyDown} />
            <label>📅 Month:</label>
            <input id="month-input" type="number" name="month" min="1" max="12" value={date.month} onChange={handleDateChange} onKeyDown={handleDateKeyDown} />
          </div>

          <div className="variable-selector">
            <label>Condition to Analyze:</label>
            <div className="variable-buttons">
              {VARIABLES.map(v => (
                <button
                  key={v.value}
                  className={`variable-btn ${variable === v.value ? 'active' : ''}`}
                  onClick={() => setVariable(v.value)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? 'Analyzing Data...' : 'Analyze Probabilities'}
          </button>

          {error && <p className="error-message">🚨 {error}</p>}
        </div>

        <div className="map-card">
          <h3 className="map-title">Selected Location</h3>
          <MapContainer 
            center={[location.lat, location.lon]} 
            zoom={5} 
            scrollWheelZoom 
            style={{ height: '100%', width: '100%', borderRadius: '8px' }}
            maxBounds={[[-85.0511, -Infinity], [85.0511, Infinity]]} /* Limits vertical panning but allows infinite horizontal scroll */
            maxBoundsViscosity={1.0}                                 /* Makes the vertical boundaries solid */
            minZoom={1}                                  /* Prevents zooming out too far */
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker location={location} setLocation={setLocation} />
          </MapContainer>
        </div>
      </div>

      {/* Resultados */}
      {results && (
        <div className="results-section" ref={resultsRef}>
          <h2 className="results-header">
            Historical Results for {results.location || 'Location'} on {results.date || 'Date'}
          </h2>
          <div className="results-grid">
            <div className="probability-card">
              <h3>Probability of '{results.variable}' Condition</h3>
              <Gauge probability={results.probability} />
              <div className="probability-details">
                <p>Based on historical data, there is a <strong>{results.probability}%</strong> chance of this condition occurring.</p>
                <p>The historical average is <strong>{displayMean.toFixed(2)} {displayUnitSymbol}</strong>.</p>
                <button className="download-json-btn" onClick={handleDownload}>
                  Download Raw Data (JSON)
                </button>
              </div>
            </div>

            <div className="data-visualization-card">
              {isTemperatureVariable && (
                <div className="unit-selector">
                  {['C', 'F', 'K'].map(u => (
                    <button
                      key={u}
                      className={`unit-selector-btn ${temperatureUnit === u ? 'active' : ''}`}
                      onClick={() => setTemperatureUnit(u)}
                    >
                      °{u}
                    </button>
                  ))}
                </div>
              )}
              <h3>Analysis Details</h3>
              <p className="detail-description">{detailDescription}</p>
              <h3 style={{ marginTop: '15px' }}>Visualization</h3>
              <div ref={chartRef}> {/* <-- NEW: Wrapper with ref for capturing */}
                <DistributionChart 
                  mean={results.historicalMean}
                  threshold={results.threshold}
                  unit={results.unit}
                  displayUnit={temperatureUnit}
                />
              </div>
              {/* --- NEW DOWNLOAD BUTTON AS REQUESTED --- */}
              <div className="chart-actions">
                <button className="chart-download-btn" title="Download Chart" onClick={handleChartDownload}>
                  <img src="/assets/icons/graph-download-icon.svg" alt="Download icon" />
                </button>
              </div>

              {results.downloadLink && (
                <a href={results.downloadLink} target="_blank" rel="noopener noreferrer" className="download-link">
                  Download Historical Data from NASA (OPeNDAP) ↓
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <Chatbox location={location} date={date} variable={variable} />
    </div>
  );
};

export default HomePage;
