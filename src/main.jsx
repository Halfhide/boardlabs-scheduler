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

// Fade out the static splash from index.html once the app has had a
// first paint. A floor of ~700ms since navigation start keeps a fast
// load from flashing the splash like a glitch.
const splash = document.getElementById('splash')
if (splash) {
  const delay = Math.max(0, 700 - performance.now())
  requestAnimationFrame(() => {
    setTimeout(() => {
      splash.classList.add('splash-hide')
      setTimeout(() => splash.remove(), 500)
    }, delay)
  })
}
