export class User{

    #apellido
    /**
     * 
     * @param {string} nombre 
     * @param {string} apellido 
     * @param {number} edad 
     * @param {number} promedio 
     */
    constructor(nombre, apellido, edad, promedio){
        this.nombre = nombre
        this.#apellido = apellido
        this.edad = edad
        this.promedio = promedio
    }
    getSummary(){
        return `Hola, mi nombre es ${this.nombre} ${this.#apellido}, tengo ${this.edad} y cuento con promedio de ${this.promedio}`
    }
    //Getter
    getApellido(){
        return this.#apellido
    }

    /**
     * 
     * @param {*} apellido 
     * @returns 
     */
    //Setter
    setApellido(apellido){
        return this.#apellido = apellido
    }
}
const pedrito = new User("Pedro", "Lopez", 2.1)
console.log(pedrito)
console.log(pedrito.getApellido())
console.log(pedrito.setApellido("Junito"));

