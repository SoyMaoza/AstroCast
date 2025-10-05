import { BrowserRouter, Route, Routes } from "react-router-dom";
import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Home from "./pages/Home/Home";
import Faq from "./pages/faq/faq";
import History from "./pages/History/History"; // 1. Importar el componente History
import Chatbox from "./components/Chatbox";

function App() {
  const [location, setLocation] = useState({ lat: 19.43, lon: -99.13 });
  const [date, setDate] = useState({ day: '1', month: '1' });
  const [variable, setVariable] = useState("warm");
  const [activity, setActivity] = useState("");
  const [results, setResults] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: "initial-message",
      sender: "bot",
      text: "Hello! I'm Astro, your assistant. How can I help you with NASA data today?",
    },
  ]);
  
  // ✅ PASO 1: Creamos el estado para controlar si el chat está abierto aquí.
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (!results) return;

    const conditionMap = {
      warm: 'cálido', cold: 'frío', windy: 'ventoso', humid: 'húmedo',
      rainy: 'lluvioso', snowy: 'nevado', cloudy: 'nublado', dusty: 'polvoriento',
    };

    const probability = results.probability;
    const conditionText = conditionMap[results.variable] || results.variable;

    let proactiveText = `¡Análisis completado! 📈 Veo que hay un **${probability}%** de probabilidad de un día **${conditionText}**.`;
    if (activity) {
      proactiveText += ` Para tu actividad (**${activity}**), esto podría ser importante.`;
    }
    proactiveText += " ¿Quieres que te dé algunas recomendaciones específicas? 🤔";

    const proactiveMessage = {
      id: `proactive-${Date.now()}`,
      sender: 'bot',
      text: proactiveText,
    };

    setMessages(prev => [...prev, proactiveMessage]);
    
    // ✅ PASO 2: Al enviar el mensaje, también forzamos la apertura del chat.
    setIsChatOpen(true);

  }, [results]);

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route
          path="/"
          element={
            <Home
              location={location} setLocation={setLocation}
              date={date} setDate={setDate}
              variable={variable} setVariable={setVariable}
              activity={activity} setActivity={setActivity}
              setResults={setResults}
            />
          }
        />
        <Route path="/faq" element={<Faq />} />
      </Routes>
      
      <Chatbox
        location={location}
        date={date}
        variable={variable}
        activity={activity}
        messages={messages}
        setMessages={setMessages}
        // ✅ PASO 3: Le pasamos el estado y la función al Chatbox.
        isOpen={isChatOpen}
        setIsOpen={setIsChatOpen}
      />
    </BrowserRouter>
  );
}

export default App;