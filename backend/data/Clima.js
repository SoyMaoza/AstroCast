// data/ClimaService.js
const fetch = require("node-fetch");
const netcdfjs = require("netcdfjs");
const { Reader } = netcdfjs;
const { EstadisticasClima } = require("../models/Clima.js");
// --- CONFIGURACIÓN ---
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6ImFicmFoYW03NCIsImV4cCI6MTc2NDM3NDM5OSwiaWF0IjoxNzU5MTgwNzM0LCJpc3MiOiJodHRwczovL3Vycy5lYXJ0aGRhdGEubmFzYS5nb3YiLCJpZGVudGl0eV9wcm92aWRlciI6ImVkbF9vcHMiLCJhY3IiOiJlZGwiLCJhc3N1cmFuY2VfbGV2ZWwiOjN9.JtX-hH_NucBgkPjjyViTxxMLlORbVIEjGLlAeGGPGBKoNG6rqzvg4n5vH3yCDH5RzPhVmrlGRPImOPXFq5l8Gz1ITrfijple8ZA5AAasKqLBb_ekdyWSXCB9O4pIQRmetJimSi4n9rwUyNF9tOrJ8-TvcjCA23kWUNTGRnqneBmoVfbpup7rxifLoUScBb2wXLtmjJFTP8rSY0iVY64n6HLRBJUgESefj64hSvt50xODAg3ayX_g1BwioG2otGmuqcFt7qV0k5EfEJJd2bGtbQD-LocTAwUaG_Wq0XFYN2QQw1LBOMm4q94DdI2Va1XzMO6RfBBEIFZvuoclNTvjZw'; // :exclamation: IMPORTANTE: Reemplaza con tu token real
// Colecciones seleccionadas (las mejores de tu lista)
const COLECCIONES = {
  temperatura: 'M2SDNXSLV',      // Daily max/min/mean temperature
  precipitacion: 'GPM_3IMERGDF', // Daily precipitation
  viento_humedad: 'M2T1NXSLV',    // Hourly wind and humidity (se promediará a diario)
  calidad_aire: 'M2T1NXAER'       // Hourly aerosols (se promediará a diario)
};
// --- SERVICIO PRINCIPAL ---
/**
 * Obtiene y procesa las estadísticas climáticas históricas para un día del año y una ubicación.
 * @param {{lat: number, lon: number}} ubicacion - Objeto con la latitud y longitud a consultar.
 * @param {string} diaDelAnio - El día a consultar en formato "MM-DD".
 * @param {number} anioInicio - El primer año del rango histórico a analizar.
 * @param {number} anioFin - El último año del rango histórico.
 * @returns {Promise<EstadisticasClima>} Objeto con todas las estadísticas calculadas.
 */
async function obtenerEstadisticasHistoricas(ubicacion, diaDelAnio, anioInicio, anioFin) {
  console.log(" Iniciando análisis histórico para el día " + diaDelAnio + " desde " + anioInicio + " hasta " + anioFin + "...");
const promesas = [];
  for (let anio = anioInicio; anio <= anioFin; anio++) {
    const fecha = `${anio}-${diaDelAnio}`;
    promesas.push(obtenerDatosParaUnDia(ubicacion, fecha));
  }
  const resultadosAnuales = await Promise.all(promesas);
  const datosValidos = resultadosAnuales.filter(d => d !== null);
  const temperaturas = datosValidos.map(d => d.temperatura);
  const vientos = datosValidos.map(d => d.viento);
  const precipitaciones = datosValidos.map(d => d.precipitacion);
  const aerosoles = datosValidos.map(d => d.calidadAire);
  return new EstadisticasClima("Ubicación seleccionada", diaDelAnio, temperaturas, vientos, precipitaciones, aerosoles);
}
/**
 * Orquesta la obtención de todas las variables climáticas para una fecha específica.
 * @param {{lat: number, lon: number}} ubicacion - Objeto con la latitud y longitud a consultar.
 * @param {string} fecha - Fecha completa "YYYY-MM-DD".
 */
async function obtenerDatosParaUnDia(ubicacion, fecha) {
  try {
    const [tempData, precipData, vientoHumData, aireData] = await Promise.all([
      getDatosTemperatura(ubicacion, fecha),
      getDatosPrecipitacion(ubicacion, fecha),
      getDatosVientoHumedad(ubicacion, fecha),
      getDatosCalidadAire(ubicacion, fecha)
    ]);
    return {
      fecha,
      temperatura: tempData.temperaturaMax,
      viento: vientoHumData.viento,
      precipitacion: precipData.precipitacion,
      calidadAire: aireData.aerosoles
    };
  } catch (error) {
   console.warn(`⚠️ No se pudieron obtener los datos para ${fecha}: ${error.message}`);
    return null;
  }
}
// --- FUNCIONES DE EXTRACCIÓN DE DATOS POR VARIABLE ---
async function getDatosTemperatura(ubicacion, fecha) {
  const granule = await buscarYDescargarGranulo(COLECCIONES.temperatura, fecha);
  const lector = new Reader(granule.buffer);
  const lats = lector.getDataVariable('lat');
  const lons = lector.getDataVariable('lon');
  const { latIndex, lonIndex } = encontrarIndiceGridMasCercano(ubicacion, lats, lons);
  const T2MMAX = lector.getDataVariable('T2MMAX');
  const temperaturaMaxKelvin = T2MMAX[latIndex * lons.length + lonIndex];
  return {
    temperaturaMax: temperaturaMaxKelvin - 273.15 // Convertir a Celsius
  };
}
async function getDatosPrecipitacion(ubicacion, fecha) {
  const granule = await buscarYDescargarGranulo(COLECCIONES.precipitacion, fecha);
  const lector = new Reader(granule.buffer);
  const lats = lector.getDataVariable('lat');
  const lons = lector.getDataVariable('lon');
  const { latIndex, lonIndex } = encontrarIndiceGridMasCercano(ubicacion, lats, lons);
  const precip = lector.getDataVariable('precipitationCal');
  const precipitacionMmPorDia = precip[0][lonIndex * lats.length + latIndex] * 24;
  return {
    precipitacion: precipitacionMmPorDia
  };
}
async function getDatosVientoHumedad(ubicacion, fecha) {
  const granule = await buscarYDescargarGranulo(COLECCIONES.viento_humedad, fecha);
  const lector = new Reader(granule.buffer);
  const lats = lector.getDataVariable('lat');
  const lons = lector.getDataVariable('lon');
  const { latIndex, lonIndex } = encontrarIndiceGridMasCercano(ubicacion, lats, lons);
  const U2M = lector.getDataVariable('U2M');
  const V2M = lector.getDataVariable('V2M');
  let vientoTotal = 0;
  for (let hora = 0; hora < 24; hora++) {
    const u = U2M[hora * lats.length * lons.length + latIndex * lons.length + lonIndex];
    const v = V2M[hora * lats.length * lons.length + latIndex * lons.length + lonIndex];
    vientoTotal += Math.sqrt(u**2 + v**2); // CORRECCIÓN: Usar el operador de potencia (**)
  }
  const vientoPromedio_ms = vientoTotal / 24;
  return {
    viento: vientoPromedio_ms * 3.6, // Convertir de m/s a km/h
  };
}
async function getDatosCalidadAire(ubicacion, fecha) {
  const granule = await buscarYDescargarGranulo(COLECCIONES.calidad_aire, fecha);
  const lector = new Reader(granule.buffer);
  const lats = lector.getDataVariable('lat');
  const lons = lector.getDataVariable('lon');
  const { latIndex, lonIndex } = encontrarIndiceGridMasCercano(ubicacion, lats, lons);
  const AOD = lector.getDataVariable('AODANA');
  let aodTotal = 0;
  for (let hora = 0; hora < 24; hora++) {
      aodTotal += AOD[hora * lats.length * lons.length + latIndex * lons.length + lonIndex];
  }
  return {
    aerosoles: aodTotal / 24
  };
}
// --- FUNCIONES HELPERS ---
async function buscarYDescargarGranulo(short_name, fecha) {
  // Nota: Se usan backticks (`) para crear strings que incluyen variables. La sintaxis es correcta.
  const urlBusqueda = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=${short_name}&temporal=${fecha}T00:00:00Z,${fecha}T23:59:59Z&page_size=1`;
  const respBusqueda = await fetch(urlBusqueda, { headers: { "Authorization": `Bearer ${TOKEN}` } }); // CORRECCIÓN: Usar backticks para interpolar
  if (!respBusqueda.ok) throw new Error(`API Error en búsqueda (${short_name}): ${respBusqueda.status}`); // CORRECCIÓN: Usar backticks
  const datos = await respBusqueda.json();
  if (datos.feed.entry.length === 0) throw new Error(`No se encontró gránulo para ${short_name} en ${fecha}`); // CORRECCIÓN: Usar backticks
  const enlace = datos.feed.entry[0].links.find(link => link.rel.includes('data#')).href;
  const respArchivo = await fetch(enlace, { headers: { Authorization: `Bearer ${TOKEN}` } }); // CORRECCIÓN: Usar backticks
  if (!respArchivo.ok) throw new Error(`Error descargando archivo desde ${enlace}`); // CORRECCIÓN: Usar backticks
  const buffer = await respArchivo.arrayBuffer();
  return { buffer, url: enlace };
}
function encontrarIndiceGridMasCercano(ubicacion, lats, lons) {
  let latIndex = 0, lonIndex = 0;
  let minDistLat = Infinity, minDistLon = Infinity;
  lats.forEach((lat, i) => {
    const dist = Math.abs(lat - ubicacion.lat);
    if (dist < minDistLat) {
      minDistLat = dist;
      latIndex = i;
    }
  });
  lons.forEach((lon, i) => {
    const dist = Math.abs(lon - ubicacion.lon);
    if (dist < minDistLon) {
      minDistLon = dist;
      lonIndex = i;
    }
  });
  return { latIndex, lonIndex };
}
// --- EJEMPLO DE USO ---
// async function main() {
//     // Analizaremos los últimos 5 años para el día de hoy (29 de Septiembre)
//     const hoy = new Date();
//     const diaDeHoy = "09-29"; // Fijamos el día para consistencia
//     const anioActual = hoy.getFullYear();
//     try {
//         const estadisticas = await obtenerEstadisticasHistoricas(diaDeHoy, anioActual - 5, anioActual - 1);
//         estadisticas.getResumenProbabilidades();
//     } catch (e) {
//         console.error("Falló el análisis principal:", e);
//     }
// }
// Ejecuta la función principal para probar el módulo
// main();

module.exports = { obtenerEstadisticasHistoricas };
// ELIMINADO: Esta línea causaba el error 'main is not defined' al iniciar el servidor.