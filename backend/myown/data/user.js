import { User } from '../models/user.js'
import { data } from './data.js'

export const userData = data.map((data)=>new User(data.nombre, data.apellido, data.edad, data.promedio).getSummary())
console.log(userData)