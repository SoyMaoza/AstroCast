import React, { useState, useRef, useEffect } from "react";
import "./Chatbox.css";
import { MdOutlineMessage } from "react-icons/md";
import { IoMdSend } from "react-icons/io";

// --- MEJORA: URL de API dinámica para funcionar tanto en local como en red ---
const isDevelopment = import.meta.env.DEV;
const backendHostname = isDevelopment ? 'localhost' : window.location.hostname;
const API_URL = `http://${backendHostname}:3001/api/chat`;


const Chatbox = ({ location, date, variable }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "initial-message",
      sender: "bot",
      text: "¡Hola! Soy Astro, tu asistente. ¿En qué puedo ayudarte con los datos de la NASA hoy?",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // --- ESTADOS DE WHATSAPP ---
  const [isSharing, setIsSharing] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  // ----------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * --- FUNCIÓN MODIFICADA ---
   * Convierte texto a HTML. Los links ahora se abren en la misma pestaña.
   * @param {string} text - El texto a formatear.
   * @returns {string} - Un string con etiquetas HTML.
   */
  const formatMessageToHTML = (text) => {
    let formattedText = text;

    // 1. Convierte **negritas** a <strong>negritas</strong>
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 2. Convierte links de Markdown [texto](url) a <a href="url">texto</a>
    formattedText = formattedText.replace(
      /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2">$1</a>' // Se quitó target="_blank"
    );

    // 3. Convierte links de texto plano (http://...) a hipervínculos clickeables.
    const urlRegex = /(?<!href=")(?<!\]\()((https?:\/\/[^\s]+))/g;
    formattedText = formattedText.replace(
        urlRegex, 
        '<a href="$1">$1</a>' // Se quitó target="_blank"
    );
    
    return formattedText;
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (isOpen) setIsSharing(false);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const userMessage = inputValue.trim();
    if (!userMessage) return;

    setInputValue("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: "user", text: userMessage },
    ]);
    setIsLoading(true);

    try {
      const formattedDate = `${String(date.month).padStart(2, '0')}-${String(
        date.day
      ).padStart(2, '0')}`;

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          lat: location.lat,
          lon: location.lon,
          date: formattedDate,
          variable: variable,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Error del servidor: ${response.statusText}`
        );
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: "bot", text: data.text },
      ]);
    } catch (error) {
      console.error("Error en el chat:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          text: `Lo siento, ocurrió un error: ${error.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessagesForWhatsapp = () => {
    let formattedText = "🤖 Reporte de Asesor Astro (NASA):\n\n";
    messages.forEach(msg => {
      if (msg.sender === "bot" || msg.sender === "user") {
        const role = msg.sender === "bot" ? "Astro: " : "Yo: ";
        const cleanText = msg.text.replace(/\*\*/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
        formattedText += role + cleanText.replace(/\n/g, " ") + "\n";
      }
    });
    formattedText += "\n---\nGenerado por tu asistente del NASA Space Apps Challenge.";
    return encodeURIComponent(formattedText);
  };

  const handleWhatsappSend = (e) => {
    e.preventDefault();
    if (!whatsappNumber || whatsappNumber.length < 8) {
      alert(
        "Por favor, introduce un número de WhatsApp válido (código de país + número, ej: 525512345678)."
      );
      return;
    }
    const messageText = formatMessagesForWhatsapp();
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${messageText}`;
    window.open(whatsappLink, "_blank");
    setIsSharing(false);
    setWhatsappNumber("");
  };

  return (
    <div className="chatbox-container">
      {isOpen && (
        <div className="chat-window">
          <header className="chat-header">
            <h3>Asistente Astro</h3>
            <button onClick={toggleChat} className="close-btn">
              &times;
            </button>
          </header>
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={msg.id || index} className={`message ${msg.sender}`}>
                <p dangerouslySetInnerHTML={{ __html: formatMessageToHTML(msg.text) }} />
              </div>
            ))}
            {isLoading && (
              <div className="message bot typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {isSharing ? (
            <form className="whatsapp-share-form" onSubmit={handleWhatsappSend}>
              <div className="whatsapp-share-content">
                <p>Introduce tu número (ej: 525512345678):</p>
                <input
                  type="tel"
                  placeholder="Número de WhatsApp"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  required
                />
              </div>
              <div className="share-actions">
                <button
                  type="button"
                  onClick={() => setIsSharing(false)}
                  className="cancel-btn"
                >
                  Cancelar
                </button>
                <button type="submit" className="send-btn">
                  Enviar por WhatsApp
                </button>
              </div>
            </form>
          ) : (
            <>
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Escribe tu pregunta..."
                  disabled={isLoading}
                />
                <button type="submit" disabled={isLoading}>
                  <IoMdSend />
                </button>
              </form>
              <footer className="chat-footer">
                <button
                  onClick={() => setIsSharing(true)}
                  className="whatsapp-toggle-btn"
                >
                  Compartir Historial 📲
                </button>
              </footer>
            </>
          )}
        </div>
      )}
      <button onClick={toggleChat} className="chat-toggle-btn">
        <MdOutlineMessage />
      </button>
    </div>
  );
};

export default Chatbox;