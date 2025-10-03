// models/Clima.js
export class EstadisticasClima {
  /**
   * Procesa datos climáticos históricos para una ubicación y día del año específicos.
   * @param {string} ubicacion - La ubicación de los datos (ej. "Mazatlán, MX").
   * @param {string} diaDelAnio - El día y mes consultado (ej. "09-29").
   * @param {number[]} temperaturas - Array de temperaturas máximas históricas (°C).
   * @param {number[]} vientos - Array de velocidades de viento promedio históricas (km/h).
   * @param {number[]} precipitaciones - Array de acumulados de lluvia históricos (mm/día).
   * @param {number[]} aerosoles - Array de índices de aerosoles históricos.
   */
  constructor(ubicacion, diaDelAnio, temperaturas, vientos, precipitaciones, aerosoles) {
    this.ubicacion = ubicacion;
    this.diaDelAnio = diaDelAnio;
    this.aniosAnalizados = temperaturas.length;
    this.historico = {
      temperaturas,
      vientos,
      precipitaciones,
      aerosoles
    };
    // Cálculos estadísticos automáticos
    this.estadisticas = {
      temperatura: this.#calcularStats(temperaturas),
      viento: this.#calcularStats(vientos),
      precipitacion: this.#calcularStats(precipitaciones),
      calidadAire: this.#calcularStats(aerosoles)
    };
  }
  /**
   * Helper privado para calcular estadísticas de un array numérico.
   * @param {number[]} data - Array de números.
   */
  #calcularStats(data) {
    if (!data || data.length === 0) {
      return { promedio: 0, min: 0, max: 0, stdDev: 0 };
    }
    const suma = data.reduce((acc, val) => acc + val, 0);
    const promedio = suma / data.length;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const stdDev = Math.sqrt(data.map(x => Math.pow(x - promedio, 2)).reduce((a, b) => a + b, 0) / data.length);
    return {
      promedio: parseFloat(promedio.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      desviacionEstandar: parseFloat(stdDev.toFixed(2))
    };
  }
  /**
   * Calcula la probabilidad de que la temperatura supere un umbral.
   * @param {number} umbral - Temperatura en °C.
   * @returns {number} - Probabilidad en porcentaje (%).
   */
  getProbabilidadCalor(umbral = 35) {
    const diasCalurosos = this.historico.temperaturas.filter(t => t > umbral).length;
    return parseFloat(((diasCalurosos / this.aniosAnalizados) * 100).toFixed(2));
  }
  /**
   * Calcula la probabilidad de que el viento supere un umbral.
   * @param {number} umbral - Viento en km/h.
   * @returns {number} - Probabilidad en porcentaje (%).
   */
  getProbabilidadVientoFuerte(umbral = 25) {
    const diasVentosos = this.historico.vientos.filter(v => v > umbral).length;
    return parseFloat(((diasVentosos / this.aniosAnalizados) * 100).toFixed(2));
  }
  /**
   * Calcula la probabilidad de que haya lluvia (precipitación > 0.1 mm).
   * @returns {number} - Probabilidad en porcentaje (%).
   */
  getProbabilidadLluvia() {
    const diasLluviosos = this.historico.precipitaciones.filter(p => p > 0.1).length;
    return parseFloat(((diasLluviosos / this.aniosAnalizados) * 100).toFixed(2));
  }
  /**
   * Genera un resumen de las condiciones probables para el día consultado.
   */
getResumenProbabilidades() {
  console.log(`\n📊 Resumen de Probabilidades para el ${this.diaDelAnio} en ${this.ubicacion} (Basado en ${this.aniosAnalizados} años)`);
  console.log(`🌡️ Temperatura: Promedio ${this.estadisticas.temperatura.promedio}°C (Min: ${this.estadisticas.temperatura.min}°C, Max: ${this.estadisticas.temperatura.max}°C)`);
  console.log(`💨 Viento: Promedio ${this.estadisticas.viento.promedio} km/h (Ráfagas hasta ${this.estadisticas.viento.max} km/h)`);
  console.log(`-----------------------------`);
  console.log(`🥵 Probabilidad de día "muy caliente" (>32°C): ${this.getProbabilidadCalor(32)}%`);
  console.log(`🌬️ Probabilidad de día "muy ventoso" (>25 km/h): ${this.getProbabilidadVientoFuerte(25)}%`);
  console.log(`💧 Probabilidad de día "muy húmedo" (lluvia): ${this.getProbabilidadLluvia()}%`);
}
}