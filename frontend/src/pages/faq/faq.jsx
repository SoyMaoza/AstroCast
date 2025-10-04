import React, { useState } from 'react';
import './Faq.css'; // Importaremos los estilos que crearemos a continuación

// Datos de las preguntas y respuestas
const faqData = [
  {
    question: '¿Qué es Astro, el asistente climático de Astro Cast?',
    answer:
      'Astro es un asistente desarrollado por Astro Cast, diseñado para simplificar el análisis de datos climáticos e históricos. Permite al usuario consultar información como temperatura, viento y otros fenómenos según ubicación y fecha en cualquier parte del mundo, de manera clara y accesible.'
  },
  {
    question: '¿Qué tipo de datos puedo consultar?',
    answer:
      'Con Astro Puedes explorar y consultar una amplia variedad de datos atmosféricos provenientes del reanálisis MERRA-2(Modern-Era Retrospective analysis for Research and Applications, Version 2). Esto incluye valores de temperatura, velocidad del viento, humedad, precipitaciones, concentración de polvo, entre otros. Los datos cubren registros históricos desde 1980 hasta la actualidad, con resolución temporal horaria y espacial global.'
  },
  {
    question: '¿Cómo debo formular mis preguntas para obtener el mejor resultado?',
    answer: 'Puedes ser específico. Menciona la fecha (día y mes), la ubicación (Selecciona en el mapa en el lugar donde te encuentras ubicado o el lugar que te gustaria conocer) y el fenómeno que te interesa (ej: "Dime la temperatura en Mazatlan el 15 de enero"). Si no especificas la fecha, Astro te dará un promedio.'
  },
  {
    question: "¿Puedo consultar datos de clima futuro (pronóstico)?",
    answer: "No, Astro se especializa en el pasado y el presente. La naturaleza del clima es dinámica e impredecible: un pequeño cambio en el ambiente puede alterar completamente el futuro (el famoso 'efecto mariposa'). Por esta razón, Astro Cast no genera pronósticos ni predice el futuro. Su fuerza está basado en las probabilidad de datos históricos precisos, ayudándote a entender el clima que ya ha ocurrido en cualquier parte del mundo."
  },
  {
    question: '¿Cómo puedo compartir mi historial de chat?',
    answer: 'Dentro de la ventana del chat, encontrarás un botón que dice "Compartir Historial 📲". Al hacer clic, se te pedirá un número de WhatsApp para enviar una transcripción de tu conversación con Astro.'
  },
  {
    question: '¿La información proporcionada es precisa?',
    answer:
      'Sí. Los datos que usamos provienen de MERRA-2, un reanálisis atmosférico global muy usado por científicos. En general, los valores de temperatura, viento y otras variables coinciden bastante bien con las observaciones reales. Aunque como cualquier modelo, en zonas muy específicas (montañas, costas, clima extremo) puede haber pequeñas desviaciones. Aun así, los resultados son buenos para tener una idea confiable del clima histórico.'
  },
  {
    question: '¿Necesito crear una cuenta para usar Astro Cast?',
    answer:
      'No, para nada. Astro está diseñado para ser usado de inmediato, sin registros ni contraseñas. Tan Solo con poner un mensaje podras hablar con él y listo; no es necesario crear una cuenta.'
  },
  {
    question: "¿Mis conversaciones se guardan o se usan para algo más?",
    answer: "Respetamos tu privacidad. El historial de chat solo se almacena temporalmente para mantener el contexto de la conversación. No usamos tus datos de chat con fines publicitarios ni los compartimos con terceros. La opción de 'Compartir Historial' es voluntaria y solo se envía a quien tú autorices."
  },
  {
    question: '¿Usar Astro Cast tiene algún costo?',
    answer: 'No, Astro Cast es totalmente gratuito. Está diseñado para ser una herramienta accesible para todos. No hay planes de suscripción ni costos ocultos.'
  },
  {
    question: '¿Existe alguna limitación en las fechas que puedo consultar?',
    answer: 'Sí. Puedes consultar datos históricos desde enero de 1980 hasta la fecha actual. No tenemos información disponible anterior a esa fecha.'
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