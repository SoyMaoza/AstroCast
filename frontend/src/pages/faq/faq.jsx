import React, { useState } from 'react';
import './Faq.css'; // Importaremos los estilos que crearemos a continuación





// Datos de las preguntas y respuestas
const faqData = [
  {
    question: '¿Qué es Astro, el Asistente de la NASA?',
    answer: 'Astro es tu asistente personal diseñado para ayudarte a explorar y entender los datos climáticos históricos de la NASA. Puedes hacerle preguntas sobre temperatura, viento y otras variables para cualquier lugar del mundo.'
  },
  {
    question: '¿Qué tipo de datos puedo consultar?',
    answer: 'Puedes consultar una amplia gama de datos atmosféricos del proyecto MERRA-2 de la NASA. Esto incluye temperatura, velocidad del viento, humedad, concentración de polvo, entre otros, basados en registros históricos desde 1980 hasta la actualidad.'
  },
  {
    question: '¿Cómo puedo compartir mi historial de chat?',
    answer: 'Dentro de la ventana del chat, encontrarás un botón que dice "Compartir Historial 📲". Al hacer clic, se te pedirá un número de WhatsApp para enviar una transcripción de tu conversación con Astro.'
  },
  {
    question: '¿La información proporcionada es precisa?',
    answer: 'Sí. Todos los datos provienen directamente del proyecto MERRA-2 de la NASA, que es una de las fuentes de reanálisis atmosférico global más confiables y utilizadas por científicos de todo el mundo.'
  },
  {
    question: '¿Necesito crear una cuenta para usar el asistente?',
    answer: 'No, no es necesario registrarse. El asistente Astro está diseñado para ser de acceso inmediato y fácil de usar sin necesidad de crear una cuenta.'
  },
  {
    question: '¿A quién puedo contactar si encuentro un problema técnico?',
    answer: 'Si tienes algún problema o sugerencia, no dudes en contactar a nuestro equipo de soporte técnico enviando un correo a: marioosuna0203@gmail.com'
  }
];

const Faq = () => {
  // Estado para controlar qué pregunta está abierta. 'null' significa que ninguna está abierta.
  const [openIndex, setOpenIndex] = useState(null);

  // Función para manejar el clic en una pregunta
  const handleToggle = (index) => {
    // Si la pregunta clickeada ya está abierta, la cerramos. Si no, la abrimos.
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-container">
      <h1 className="faq-title">Preguntas Frecuentes (FAQ)</h1>
      <div className="faq-list">
        {faqData.map((item, index) => (
          <div key={index} className="faq-item">
            <button className="faq-question" onClick={() => handleToggle(index)}>
              <span>{item.question}</span>
              {/* El ícono cambia dependiendo de si la pregunta está abierta o cerrada */}
              <span className="faq-icon">{openIndex === index ? '−' : '+'}</span>
            </button>
            {/* El contenido de la respuesta solo se muestra si el índice coincide con el estado abierto */}
            <div className={`faq-answer ${openIndex === index ? 'open' : ''}`}>
              <p>{item.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


export default Faq;