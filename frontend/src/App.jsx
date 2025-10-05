import { BrowserRouter, Route, Routes } from "react-router-dom";
import React, { useState } from "react";

import Navbar from "./components/Navbar";
import Home from "./pages/Home/Home";
import Faq from "./pages/faq/faq";
import Chatbox from "./components/Chatbox";


function App() {
  // 🔥 Estados globales (antes estaban en Home.jsx)
  const [location, setLocation] = useState({ lat: 19.43, lon: -99.13 });
  const [date, setDate] = useState({ day: 1, month: 1 });
  const [variable, setVariable] = useState("calido");
  // --- NUEVO: Estado para disparar la recomendación del chat ---
  const [chatTrigger, setChatTrigger] = useState(null);

  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        {/* 👇 Pasamos los estados y setters a Home como props */}
        <Route
          path="/"
          element={
            <Home
              location={location}
              setLocation={setLocation}
              date={date}
              setDate={setDate}
              variable={variable}
              setVariable={setVariable}
              triggerChat={setChatTrigger} // Pasamos la función para disparar
            />
          }
        />
        <Route path="/faq" element={<Faq />} />
      </Routes>

      {/* 🔥 Chatbox ahora está global, fuera de Routes */}
      <Chatbox location={location} date={date} variable={variable} chatTrigger={chatTrigger} />
    </BrowserRouter>
  );
}

export default App;
