import React, { useState, useRef, useEffect } from "react";
import "./Chatbox.css";
import { MdOutlineMessage } from "react-icons/md";
import { IoMdSend } from "react-icons/io";

// --- MEJORA: URL de API dinámica para funcionar tanto en local como en red ---
const isDevelopment = import.meta.env.DEV;
const backendHostname = isDevelopment ? 'localhost' : window.location.hostname;
const API_URL = `http://${backendHostname}:3001/api/chat`;


const Chatbox = ({ location, date, variable, chatTrigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "initial-message",
      sender: "bot",
      text: "Hello! I'm Astro, your assistant. How can I help you with NASA data today?",
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

  // --- NUEVO: useEffect para manejar el disparador de recomendación ---
  useEffect(() => {
    if (chatTrigger) {
      const { activity, condition, probability } = chatTrigger;
      
      // Construimos el prompt para la IA
      const recommendationPrompt = `Based on a ${probability}% probability of a "${condition}" day, give me a brief and friendly recommendation for my activity: "${activity}".`;
      
      // Abrimos el chat
      setIsOpen(true);
      
      // Añadimos un mensaje temporal de "pensando"
      setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: `Give me a recommendation for my activity.` }]);
      
      // Enviamos el prompt al backend
      // Usamos un pequeño timeout para que el usuario vea el mensaje "user" antes de que llegue la respuesta
      setTimeout(() => {
        sendMessageToServer(recommendationPrompt);
      }, 500);
    }
  }, [chatTrigger]); // Este efecto se ejecuta cada vez que chatTrigger cambia

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

  // --- NUEVO: Función refactorizada para enviar mensajes al servidor ---
  const sendMessageToServer = async (messageText) => {
    setIsLoading(true);

    // Añade un ID único al mensaje del bot que vamos a ir actualizando
    const botMessageId = Date.now() + 1;
    setMessages((prev) => [
      ...prev,
      { id: botMessageId, sender: "bot", text: "" }, // Mensaje vacío inicial
    ]);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          lat: location?.lat,
          lon: location?.lon,
          day: date?.day ? parseInt(date.day) : null,
          month: date?.month ? parseInt(date.month) : null,
          variable: variable,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server Error: ${response.statusText}`);
      }

      // --- LÓGICA DE STREAMING ---
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

        for (const line of lines) {
          const jsonString = line.replace('data: ', '');
          try {
            const parsed = JSON.parse(jsonString);
            if (parsed.text) {
              setMessages(prev => prev.map(msg => 
                msg.id === botMessageId ? { ...msg, text: msg.text + parsed.text } : msg
              ));
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", jsonString);
          }
        }
      }
    } catch (error) {
      console.error("Error en el chat:", error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId ? { ...msg, text: `I'm sorry, an error occurred: ${error.message}` } : msg
      ));
    } finally {
      setIsLoading(false);
    }
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
    sendMessageToServer(userMessage);
  };

  const formatMessagesForWhatsapp = () => {
    let formattedText = "🤖 Astro Advisor Report (NASA):\n\n";
    messages.forEach(msg => {
      if (msg.sender === "bot" || msg.sender === "user") {
        const role = msg.sender === "bot" ? "Astro: " : "Me: ";
        const cleanText = msg.text.replace(/\*\*/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
        formattedText += role + cleanText.replace(/\n/g, " ") + "\n";
      }
    });
    formattedText += "\n---\nGenerated by your NASA Space Apps Challenge assistant.";
    return encodeURIComponent(formattedText);
  };

  const handleWhatsappSend = (e) => {
    e.preventDefault();
    if (!whatsappNumber || whatsappNumber.length < 8) {
      alert(
        "Please enter a valid WhatsApp number (country code + number, e.g., 15551234567)."
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
            <h3>Astro Assistant</h3>
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
                <p>Enter your number (e.g., 15551234567):</p>
                <input
                  type="tel"
                  placeholder="WhatsApp Number"
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
                  Cancel
                </button>
                <button type="submit" className="send-btn">
                  Send via WhatsApp
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
                  placeholder="Type your question..."
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
                  Share History 📲
                </button>
              </footer>
            </>
          )}
        </div>
      )}
      {/* --- CORRECCIÓN: Se restaura la estructura original del contenedor --- */}
      {/* El botón de apertura ahora está dentro del mismo contenedor que el chat, */}
      {/* pero solo se renderiza si el chat está cerrado. */}
      <div className="chat-toggle-container">
        {!isOpen && (
          <button onClick={toggleChat} className="chat-toggle-btn">
            <MdOutlineMessage />
          </button>
        )}
      </div>
    </div>
  );
};

export default Chatbox;