import React, { useState, useRef, useEffect } from 'react';
import './Chatbox.css'; // Crearemos este archivo a continuación

// Apuntamos al nuevo backend en el puerto 3001
const API_URL = 'http://localhost:3001/api/chat';
const Chatbox = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        // --- MEJORA: Usar IDs únicos para todos los mensajes ---
        { id: 'initial-message', sender: 'bot', text: '¡Hola! Soy Astro, tu asistente. ¿En qué puedo ayudarte con los datos de la NASA hoy?' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Efecto para hacer scroll automático al final cuando llegan nuevos mensajes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const userMessage = inputValue.trim();
        if (!userMessage) return;

        setInputValue('');
        // Añadimos el mensaje del usuario inmediatamente
        setMessages(prev => [
            ...prev, { id: Date.now(), sender: 'user', text: userMessage }
        ]);
        setIsLoading(true);

        try {
            // Llamada al backend de index.js
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage }) // No se necesita sessionId aquí
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error del servidor: ${response.statusText}`);
            }

            // Leemos la respuesta JSON completa
            const data = await response.json();
            
            // Añadimos el mensaje del bot al estado
            setMessages(prev => [
                ...prev, { id: Date.now() + 1, sender: 'bot', text: data.text }
            ]);

        } catch (error) {
            console.error("Error en el chat:", error);
            // Añadimos un mensaje de error
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: `Lo siento, ocurrió un error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chatbox-container">
            {isOpen && (
                <div className="chat-window">
                    <header className="chat-header">
                        <h3>Asistente Astro</h3>
                        <button onClick={toggleChat} className="close-btn">&times;</button>
                    </header>
                    <div className="chat-messages">
                        {messages.map((msg, index) => (
                            <div key={msg.id || index} className={`message ${msg.sender}`}>
                                <p>{msg.text}</p>
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
                            onChange={handleInputChange}
                            placeholder="Escribe tu pregunta..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading}>
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </form>
                </div>
            )}
            <button onClick={toggleChat} className="chat-toggle-btn">
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-comment-dots'}`}></i>
            </button>
        </div>
    );
};

export default Chatbox;