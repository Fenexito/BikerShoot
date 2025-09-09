import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './state/auth.jsx'
import { UIProvider } from './state/ui.jsx'
import 'maplibre-gl/dist/maplibre-gl.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <UIProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </UIProvider>
  </BrowserRouter>
)
