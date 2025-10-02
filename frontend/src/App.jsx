import { BrowserRouter, Route, Routes } from "react-router-dom"

import Navbar from "./components/Navbar"
import Home from "./pages/Home/Home"
import InfoTabla from "./pages/InfoTabla/InfoTabla"

function App() {

  return (
    <>
      <BrowserRouter>
      <Navbar/>
        <Routes>
          <Route path="/" element={<Home/>}/>
          <Route path="/info" element={<InfoTabla/>}/>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
