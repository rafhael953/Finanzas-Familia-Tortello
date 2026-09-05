import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Inicio from "./pages/Inicio";
import PanelRafael from "./pages/PanelRafael";
import PanelJerardith from "./pages/PanelJerardith";
import Deudas from "./pages/Deudas";
import Dashboard from "./pages/Dashboard";
import Historial from "./pages/Historial";
import Login from "./pages/Login";
import { api, aplicarCategoriasPersonalizadas } from "./api";

export default function App() {
  const [usuario, setUsuario] = useState(undefined); // undefined = cargando

  useEffect(() => {
    api.whoami().then((r) => setUsuario(r.usuario));
    api.getCategoriasPersonalizadas().then(aplicarCategoriasPersonalizadas).catch(() => {});
  }, []);

  if (usuario === undefined) {
    return <div className="min-h-screen" />;
  }

  if (!usuario) {
    return <Login onIngreso={setUsuario} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/rafael" element={<PanelRafael />} />
        <Route path="/rafael/deudas" element={<Deudas />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/jerardith" element={<PanelJerardith />} />
      </Routes>
    </BrowserRouter>
  );
}
