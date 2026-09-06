import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SiAlgoFalla from './components/SiAlgoFalla.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SiAlgoFalla>
      <App />
    </SiAlgoFalla>
  </StrictMode>,
)
