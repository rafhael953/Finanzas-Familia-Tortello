import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Inicio from "./pages/Inicio";
import PanelRafael from "./pages/PanelRafael";
import PanelJerardith from "./pages/PanelJerardith";
import Deudas from "./pages/Deudas";
import Dashboard from "./pages/Dashboard";
import Historial from "./pages/Historial";
import Ahorro from "./pages/Ahorro";
import Graficas from "./pages/Graficas";
import Reparto from "./pages/Reparto";
import Login from "./pages/Login";
import Deslizable from "./components/Deslizable";
import { api, aplicarCategoriasPersonalizadas } from "./api";

export default function App() {
  const [usuario, setUsuario] = useState(undefined); // undefined = cargando

  useEffect(() => {
    // Sin el catch, si esta llamada falla el estado se queda en "cargando"
    // para siempre y la pantalla no muestra nada. Ante la duda, se pide
    // iniciar sesion, que si es una pantalla visible.
    api.whoami().then((r) => setUsuario(r.usuario)).catch(() => setUsuario(null));
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
      <Deslizable>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/rafael" element={<PanelRafael />} />
          <Route path="/rafael/deudas" element={<Deudas />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/ahorro" element={<Ahorro />} />
          <Route path="/graficas" element={<Graficas />} />
          <Route path="/reparto" element={<Reparto />} />
          <Route path="/jerardith" element={<PanelJerardith />} />
        </Routes>
      </Deslizable>
    </BrowserRouter>
  );
}
