import React, { useState, useRef, useEffect } from "react";
import "./Chatbox.css";
import { MdOutlineMessage } from "react-icons/md";
import { IoMdSend } from "react-icons/io";

const API_URL = import.meta.env.VITE_BACKEND_URL
    ? `${import.meta.env.VITE_BACKEND_URL}/api/chat`
    : 'http://localhost:3001/api/chat';

// ✅ Recibe `isOpen` y `setIsOpen` como props
const Chatbox = ({ location, date, variable, activity, messages, setMessages, isOpen, setIsOpen }) => {
  // Ya no tiene su propio estado `isOpen`
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // ✅ Eliminamos el useEffect problemático por completo.

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Ahora el toggle simplemente llama a la función que le pasó App.jsx
  const toggleChat = () => setIsOpen(!isOpen);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const userMessageText = inputValue.trim();
    if (!userMessageText) return;

    const userMessage = { id: Date.now(), sender: "user", text: userMessageText };
    setInputValue("");
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessageText,
          lat: location.lat, lon: location.lon,
          day: parseInt(date.day), month: parseInt(date.month),
          variable, activity
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      const data = await response.json();
      const botMessage = { id: Date.now() + 1, sender: "bot", text: data.text };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error en el chat:", error);
      const errorMessage = { id: Date.now() + 1, sender: "bot", text: `I'm sorry, an error occurred: ${error.message}` };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatMessageToHTML = (text) => {
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\[(.*?)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    const urlRegex = /(?<!href=")(?<!\]\()((https?:\/\/[^\s]+))/g;
    formattedText = formattedText.replace(urlRegex, '<a href="$1">$1</a>');
    return formattedText;
  };

  return (
    <div className="chatbox-container">
      {isOpen && (
        <div className="chat-window">
          <header className="chat-header">
            <h3>Astro Assistant</h3>
            <button onClick={toggleChat} className="close-btn">&times;</button>
          </header>
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={msg.id || index} className={`message ${msg.sender}`}>
                <p dangerouslySetInnerHTML={{ __html: formatMessageToHTML(msg.text) }} />
              </div>
            ))}
            {isLoading && (
              <div className="message bot typing-indicator">
                <span></span><span></span><span></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your question..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}><IoMdSend /></button>
          </form>
        </div>
      )}
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