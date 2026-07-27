import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/baloo-2/700.css'
import '@fontsource/caprasimo/400.css'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
