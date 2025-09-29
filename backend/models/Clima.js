// models/Clima.js
export class Clima {
  #ubicacion;
  /**
   *
   * @param {string} fecha 
   * @param {string} ubicacion
   * @param {number} temperatura 
   * @param {number} humedad
   * @param {number} viento 
   * @param {number} probabilidadLluvia 
   */
  constructor(fecha, ubicacion, temperatura, humedad, viento, probabilidadLluvia) {
    this.fecha = fecha;
    this.#ubicacion = ubicacion;
    this.temperatura = temperatura;
    this.humedad = humedad;
    this.viento = viento;
    this.probabilidadLluvia = probabilidadLluvia;
  }
  // Resumen amigable para mostrar en frontend o consola
  getSummary() {
    return `:pin_redondo: ${this.#ubicacion} | :fecha: ${this.fecha} | :termómetro: ${this.temperatura}°C | :gota: Humedad: ${this.humedad}% | :nube_de_polvo: Viento: ${this.viento} km/h | :paraguas_con_gotas_de_lluvia: Lluvia: ${this.probabilidadLluvia}%`;
  }
  // Getter para ubicación
  getUbicacion() {
    return this.#ubicacion;
  }
  // Setter para ubicación
  setUbicacion(nuevaUbicacion) {
    this.#ubicacion = nuevaUbicacion;
  }
}