import { BrowserRouter, Route, Routes } from "react-router-dom";
import React, { useState } from "react";

import Navbar from "./components/Navbar";
import Home from "./pages/Home/Home";
import Faq from "./pages/faq/faq";
import History from "./pages/History/History"; // 1. Importar el componente History
import Chatbox from "./components/Chatbox";


function App() {
  // 🔥 Estados globales (antes estaban en Home.jsx)
  const [location, setLocation] = useState({ lat: 19.43, lon: -99.13 });
  const [date, setDate] = useState({ day: 1, month: 1 });
  const [variable, setVariable] = useState("calido");

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
            />
          }
        />
        <Route path="/faq" element={<Faq />} />
        <Route path="/history" element={<History />} /> {/* 2. Usar el componente History */}
      </Routes>

      {/* 🔥 Chatbox ahora está global, fuera de Routes */}
      <Chatbox location={location} date={date} variable={variable} />
    </BrowserRouter>
  );
}

export default App;
