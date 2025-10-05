import React, { useState, useEffect, useRef } from 'react';
import './Home.css';
import ProbabilityCard from '../../components/ProbabilityCard';
import Gauge from '../../components/Gauge'; // --- NUEVO: Importar el componente Gauge ---
import { FaSearch } from 'react-icons/fa'; // Importamos el ícono de búsqueda
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import DistributionChart from '../../components/DistributionChart';
// El Chatbox ya no se importa ni se renderiza aquí, vive en App.jsx
import 'leaflet/dist/leaflet.css';
import html2canvas from 'html2canvas';
import L from 'leaflet';
import graph_download_icon from "../../components/assets/icons/graph-download-icon.svg";

// Use the environment variable for the backend URL in production,
// otherwise fall back to the local URL for development.
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';

const kelvinToCelsius = (k) => k - 273.15;
const kelvinToFahrenheit = (k) => (k - 273.15) * 9/5 + 32;

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
  return location.lat === null ? null : <Marker position={[location.lat, location.lon]} />;
}

// ✅ Recibe todos los estados y funciones necesarios desde App.jsx
const HomePage = ({ location, setLocation, date, setDate, variable, setVariable, activity, setActivity, setResults }) => {
  // Estado local solo para la UI de esta página
  const [localResults, setLocalResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [temperatureUnit, setTemperatureUnit] = useState('C');
  const resultsRef = useRef(null);
  const chartRef = useRef(null); // <-- NEW: Ref to capture the chart element

  useEffect(() => {
    if (localResults && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [localResults]);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setLocalResults(null);
    setResults(null); // Limpia los resultados globales en App.jsx para evitar re-triggers

    const dayNum = parseInt(date.day, 10);
    const monthNum = parseInt(date.month, 10);
    // ... (aquí iría la función de validación de fecha si la tienes)

    try {
      const response = await fetch(`${API_BASE_URL}/climate-probability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(location.lat), lon: parseFloat(location.lon),
          day: dayNum, month: monthNum,
          variable, activity 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setLocalResults(data); // Actualiza la UI de esta página
      setResults(data);     // ✅ Manda los resultados a App.jsx para que el Chatbox reaccione
    } catch (err) {
      console.error("API query error:", err);
      setError(err.message || 'Unknown error connecting to the data service.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const { lat, lon } = location;
    const { day, month } = date;
    let downloadUrl = `${API_BASE_URL}/download-data?lat=${lat}&lon=${lon}&day=${day}&month=${month}&variable=${variable}&activity=${encodeURIComponent(activity)}&format=json`;
    if (['warm', 'cold'].includes(variable)) {
      downloadUrl += `&displayUnit=${temperatureUnit}`;
    }
    window.open(downloadUrl, '_blank');
  };

  const handleLocationChange = (e) => {
    const { name, value } = e.target;
    setLocation(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDate(prev => ({ ...prev, [name]: value }));
  };

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

  const isTemperatureVariable = localResults && ['warm', 'cold'].includes(localResults.variable);
  let displayMean = localResults ? localResults.historicalMean : 0;
  let displayUnitSymbol = localResults ? localResults.unit : '';

  if (localResults && isTemperatureVariable && localResults.unit === 'K') {
    if (temperatureUnit === 'C') {
      displayMean = kelvinToCelsius(localResults.historicalMean);
      displayUnitSymbol = '°C';
    } else if (temperatureUnit === 'F') {
      displayMean = kelvinToFahrenheit(localResults.historicalMean);
      displayUnitSymbol = '°F';
    }
  }

  // --- NEW: Dynamic detail description based on the variable's historical range ---
  const startYear = (localResults && (localResults.variable === 'rainy')) ? 1998 : 1980;
  const historicalRange = `${startYear}-${new Date().getFullYear()}`;
  const detailDescription = localResults ? `The probability of the '${localResults.variable}' condition occurring is ${localResults.probability}%, based on the historical average of ${displayMean.toFixed(2)} ${displayUnitSymbol} for the range ${historicalRange}.` : "";


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

  return (
    <div className="container homepage-container">
      <header className="page-header">
        <h1>Your Historical Weather Guide</h1>
        <p>Plan your outdoor event with NASA's earth observation data.</p>
      </header>

      <div className="location-search-container">
        <form onSubmit={handleGeocodeSearch} className="location-search-form">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Enter a location:" className="location-search-input" />
          <button type="submit" className="location-search-btn" aria-label="Search location"><FaSearch /></button>
        </form>
      </div>

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
            <input id="day-input" type="number" name="day" min="1" max="31" value={date.day} onChange={handleDateChange} />
            <label>📅 Month:</label>
            <input id="month-input" type="number" name="month" min="1" max="12" value={date.month} onChange={handleDateChange} />
          </div>
          <div className="input-group">
            <label>🏃 Activity (Optional):</label>
            <input type="text" name="activity" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="e.g., hiking, picnic, wedding" style={{ width: '100%' }} />
          </div>
          <div className="variable-selector">
            <label>Condition to Analyze:</label>
            <div className="variable-buttons">
              {VARIABLES.map(v => (
                <button key={v.value} className={`variable-btn ${variable === v.value ? 'active' : ''}`} onClick={() => setVariable(v.value)}>
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

      {localResults && (
        <div className="results-section" ref={resultsRef}>
          <h2 className="results-header">
            Historical Results for {localResults.location || 'Location'} on {localResults.date || 'Date'}
          </h2>
          <div className="results-grid">
            <div className="probability-card">
              <h3>Probability of '{localResults.variable}' Condition</h3>
              <Gauge probability={localResults.probability} />
              <div className="probability-details">
                <p>Based on historical data, there is a <strong>{localResults.probability}%</strong> chance of this condition occurring.</p>
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
                    <button key={u} className={`unit-selector-btn ${temperatureUnit === u ? 'active' : ''}`} onClick={() => setTemperatureUnit(u)}>
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
                  mean={localResults.historicalMean}
                  threshold={localResults.threshold}
                  unit={localResults.unit}
                  displayUnit={temperatureUnit}
                />
              </div>
              {/* --- NEW DOWNLOAD BUTTON AS REQUESTED --- */}
              <div className="chart-actions">
                <button className="chart-download-btn" title="Download Chart" onClick={handleChartDownload}>
                  <img src={graph_download_icon} alt="Download icon" />
                </button>
              </div>

              {localResults.downloadLink && (
                <a href={localResults.downloadLink} target="_blank" rel="noopener noreferrer" className="download-link">
                  Download Historical Data from NASA (OPeNDAP) ↓
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