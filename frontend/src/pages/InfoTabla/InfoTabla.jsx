import React from 'react'
import { useEffect } from 'react';
import { useState } from 'react';
import { useRef } from 'react';

const InfoTabla = () => {
  const [messages, setMessages] = useState([
    { text: "Hola, soy tu asistente Gemini. ¿En qué puedo ayudarte hoy?", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // URL del endpoint del servidor Node.js
  const BOT_URL = 'http://localhost:3001/api/chat'; 

  // Desplazamiento automático al final de la conversación
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

//hola el clima es de {variable} y hay mucha probabilidad de que {haga viento | llueva | este muy caliente} 




  // Ejecutar el scroll cada vez que se añaden nuevos mensajes
  useEffect(scrollToBottom, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // 1. Añadir mensaje del usuario al estado
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);

    try {
      // 2. Enviar mensaje al backend de Node.js
      const response = await fetch(BOT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`Error en la respuesta del servidor: ${response.statusText}`);
      }

      const data = await response.json();
      
      // 3. Añadir respuesta del bot al estado
      setMessages(prev => [...prev, { text: data.text, sender: 'bot' }]);

    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      setMessages(prev => [...prev, { text: "⚠️ Hubo un error al conectar con el servidor. Asegúrate de que el backend de Node.js esté corriendo.", sender: 'bot' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <h1>Asistente Gemini</h1>
      <div className="message-area">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message ${msg.sender}`}
          >
            <strong>{msg.sender === 'user' ? 'Tú' : 'Asistente'}:</strong> {msg.text}
          </div>
        ))}
        {loading && <div className="loading-text">Escribiendo...</div>}
        <div ref={messagesEndRef} />
      </div>
      <form className="input-area" onSubmit={handleSend}>
        <input
          className="input-field"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={loading}
        />
        <button className="send-button" type="submit" disabled={loading}>
          {loading ? '...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

export default InfoTabla;