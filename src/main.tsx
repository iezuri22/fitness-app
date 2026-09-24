import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { preloadFor } from './screens'

// Every screen but Today is its own chunk (see screens.ts). Render once the one
// being opened has loaded, so it draws directly instead of suspending — React
// holds a suspended screen back for 300 ms. Sign-in restores in the meantime.
// Capped, so a chunk that can't load never keeps the app from starting.
const opened = preloadFor(window.location.pathname)
const cap = new Promise((resolve) => setTimeout(resolve, 1500))

void Promise.race([opened, cap]).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
