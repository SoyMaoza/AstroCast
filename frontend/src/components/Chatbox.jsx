// Chatbox.jsx (CÓDIGO COMPLETO Y FINAL)

import React, { useState, useRef, useEffect } from "react";
import "./Chatbox.css";
import { MdOutlineMessage } from "react-icons/md";
import { IoMdSend } from "react-icons/io";

// Apuntamos al backend en el puerto 3001
const API_URL = "http://localhost:3001/api/chat";

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
  const [isSharing, setIsSharing] = useState(false); // Muestra la interfaz de envío
  const [whatsappNumber, setWhatsappNumber] = useState(""); // Guarda el número
  // ----------------------------

  // Efecto para hacer scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    // Si se cierra, salimos del modo compartir
    if (isOpen) setIsSharing(false);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  // --- LÓGICA DEL CHAT (Igual que la tuya) ---
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
      // --- MEJORA: Formatear la fecha y preparar el cuerpo de la petición ---
      // Aseguramos que el mes y día tengan dos dígitos (ej: 1 -> "01")
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
          date: formattedDate, // Formato "MM-DD"
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

  // --- LÓGICA DE WHATSAPP ---

  const formatMessagesForWhatsapp = () => {
    let formattedText = "🤖 Reporte de Asesor Astro (NASA):\n\n";
    messages.forEach(msg => {
      // Incluimos ambos mensajes para tener el contexto
      if (msg.sender === "bot" || msg.sender === "user") {
        // Reemplazamos saltos de línea y codificamos para URL
        const role = msg.sender === "bot" ? "Astro: " : "Yo: ";
        formattedText += role + msg.text.replace(/\n/g, " ") + "\n";
      }
    });

    formattedText += "\n---\nGenerado por tu asistente del NASA Space Apps Challenge.";

    return encodeURIComponent(formattedText);
  };

  const handleWhatsappSend = (e) => {
    e.preventDefault(); // Evita el submit del formulario si es necesario

    if (!whatsappNumber || whatsappNumber.length < 8) {
      alert(
        "Por favor, introduce un número de WhatsApp válido (código de país + número, ej: 525512345678)."
      );
      return;
    }

    const messageText = formatMessagesForWhatsapp();

    // Construye el enlace de WhatsApp (wa.me)
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${messageText}`;

    // Abrir la aplicación de WhatsApp del usuario
    window.open(whatsappLink, "_blank");

    // Resetear el modo de envío
    setIsSharing(false);
    setWhatsappNumber("");
  };

  // --- FIN LÓGICA DE WHATSAPP ---

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
                <p>{msg.text}</p>
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

          {/* --- INTERFAZ DE COMPARTIR WHATSAPP (Aparece si isSharing es true) --- */}
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
              {/* --- Formulario de Entrada NORMAL (Aparece si isSharing es false) --- */}
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
              {/* --- Botón para activar el modo de compartir --- */}
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
}
export default Chatbox;