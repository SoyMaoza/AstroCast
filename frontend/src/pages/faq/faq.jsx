import React, { useState } from 'react';
import './Faq.css'; // Importaremos los estilos que crearemos a continuación

// Datos de las preguntas y respuestas
const faqData = [
  {
    question: 'What is Astro, the climate assistant from Astro Cast?',
    answer:
      'Astro is an assistant developed by Astro Cast, designed to simplify the analysis of historical climate data. It allows users to query information such as temperature, wind, and other phenomena by location and date anywhere in the world, in a clear and accessible way.'
  },
  {
    question: 'What kind of data can I query?',
    answer:
      'With Astro, you can explore and query a wide variety of atmospheric data from the MERRA-2 (Modern-Era Retrospective analysis for Research and Applications, Version 2) reanalysis. This includes temperature, wind speed, humidity, precipitation, dust concentration, among others. The data covers historical records from 1980 to the present, with hourly temporal and global spatial resolution.'
  },
  {
    question: 'How should I formulate my questions to get the best results?',
    answer: 'You can be specific. Mention the date (day and month), the location (select on the map where you are or the place you want to know about), and the phenomenon you are interested in (e.g., "Tell me the temperature in Mazatlan on January 15"). If you do not specify the date, Astro will give you an average.'
  },
  {
    question: "Can I query future weather data (forecasts)?",
    answer: "No, Astro specializes in the past and present. The nature of climate is dynamic and unpredictable: a small change in the environment can completely alter the future (the famous 'butterfly effect'). For this reason, Astro Cast does not generate forecasts or predict the future. Its strength is based on the probability of accurate historical data, helping you understand the weather that has already occurred anywhere in the world."
  },
  {
    question: 'How can I share my chat history?',
    answer: 'Inside the chat window, you will find a button that says "Share History 📲". When you click it, you will be asked for a WhatsApp number to send a transcript of your conversation with Astro.'
  },
  {
    question: 'Is the information provided accurate?',
    answer:
      'Yes. The data we use comes from MERRA-2, a global atmospheric reanalysis widely used by scientists. In general, the values for temperature, wind, and other variables match real observations quite well. Although, like any model, there may be small deviations in very specific areas (mountains, coasts, extreme weather). Even so, the results are good for getting a reliable idea of historical weather.'
  },
  {
    question: 'Do I need to create an account to use Astro Cast?',
    answer:
      'Not at all. Astro is designed to be used immediately, without registrations or passwords. Just by sending a message, you can talk to it; creating an account is not necessary.'
  },
  {
    question: "Are my conversations saved or used for anything else?",
    answer: "We respect your privacy. The chat history is only stored temporarily to maintain the context of the conversation. We do not use your chat data for advertising purposes or share it with third parties. The 'Share History' option is voluntary and is only sent to whom you authorize."
  },
  {
    question: 'Is there any cost to use Astro Cast?',
    answer: 'No, Astro Cast is completely free. It is designed to be an accessible tool for everyone. There are no subscription plans or hidden costs.'
  },
  {
    question: 'Are there any limitations on the dates I can query?',
    answer: 'Yes. You can query historical data from January 1980 to the present date. We do not have information available prior to that date.'
  },
  {
    question: 'Who can I contact if I encounter a technical problem?',
    answer: 'If you have any problems or suggestions, do not hesitate to contact our technical support team by sending an email to: marioosuna0203@gmail.com'
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
      <h1 className="faq-title">Frequently Asked Questions (FAQ)</h1>
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