import React, { useState, useEffect, useRef } from 'react';
import './Home.css'; 
import ProbabilityCard from '../../components/ProbabilityCard';
import Gauge from '../../components/Gauge'; // --- NUEVO: Importar el componente Gauge ---
import { FaSearch } from 'react-icons/fa'; // Importamos el ícono de búsqueda
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import DistributionChart from '../../components/DistributionChart';
import Chatbox from '../../components/Chatbox';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 🔹 URL base para todos los endpoints de API
const API_BASE_URL = 'http://localhost:3001/api'

// --- MEJORA: URL de API dinámica y robusta para despliegue ---
// Usa la variable de entorno VITE_BACKEND_URL si está definida (para producción),
// de lo contrario, usa la URL de desarrollo local.
const API_URL = import.meta.env.VITE_BACKEND_URL 
    ? `${import.meta.env.VITE_BACKEND_URL}/api/climate-probability`
    : 'http://localhost:3001/api/climate-probability';

// Variables climáticas
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
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null);
  const [temperatureUnit, setTemperatureUnit] = useState('C');
  const resultsRef = useRef(null);
  
  // ✅ --- NUEVO: Estado para la actividad ---
  const [activity, setActivity] = useState("");

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
  
  // ✅ --- NUEVO: Manejador para el cambio de actividad ---
  const handleActivityChange = (e) => {
    setActivity(e.target.value);
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
          variable,
          activity // ✅ --- NUEVO: Envía la actividad al backend ---
          
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('1. ANÁLISIS EXITOSO EN HOME.JSX:', data); 
      
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
    // ✅ --- NUEVO: Añade la actividad a la URL de descarga ---
    let downloadUrl = `${API_BASE_URL}/download-data?lat=${lat}&lon=${lon}&day=${day}&month=${month}&variable=${variable}&activity=${encodeURIComponent(activity)}&format=json`;

    if (['warm', 'cold'].includes(variable)) {
      downloadUrl += `&displayUnit=${temperatureUnit}`;
    }
    window.open(downloadUrl, '_blank');
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
          
          {/* ✅ --- NUEVO: Campo de entrada para la actividad --- */}
          <div className="input-group">
            <label>🏃 Activity (Optional):</label>
            <input 
              type="text" 
              name="activity" 
              value={activity} 
              onChange={handleActivityChange}
              placeholder="e.g., hiking, picnic, wedding"
              style={{ width: '100%' }} // Estilo simple para que ocupe todo el ancho
            />
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

    // --- NUEVO: Estado para el buscador de ubicaciones ---
    const [searchQuery, setSearchQuery] = useState("");
    // Estados principales



    // Estados para los resultados de la API
    const [results, setResults] = useState(null); 
    const [loading, setLoading] = useState(false); 
    const [error, setError] = useState(null);

    // --- MEJORA: Ref para la sección de resultados ---
    const resultsRef = useRef(null);

    // --- MEJORA: Efecto para hacer scroll automático ---
    useEffect(() => {
        // Si hay resultados y el ref está adjunto al elemento del DOM...
        if (results && resultsRef.current) {
            // ...hacemos scroll hacia ese elemento con una animación suave.
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [results]); // Este efecto se ejecuta cada vez que el estado 'results' cambia.

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

      {/* ✅ --- NUEVO: Pasa la actividad al Chatbox --- */}
<Chatbox location={location} date={date} variable={variable} activity={activity} />
    </div>
  );
};

export default HomePage;