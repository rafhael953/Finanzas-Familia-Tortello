import { BrowserRouter, Routes, Route } from "react-router-dom";
import Inicio from "./pages/Inicio";
import PanelRafael from "./pages/PanelRafael";
import PanelJerardith from "./pages/PanelJerardith";
import Deudas from "./pages/Deudas";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/rafael" element={<PanelRafael />} />
        <Route path="/rafael/deudas" element={<Deudas />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/jerardith" element={<PanelJerardith />} />
      </Routes>
    </BrowserRouter>
  );
}
