import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ToastProvider from './components/ui/ToastProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Avisos flotantes de toda la app: toast.show() (utils/toast.js) */}
    <ToastProvider />
  </StrictMode>,
)
