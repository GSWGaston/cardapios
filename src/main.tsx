import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { EditorApp } from './editor/EditorApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/editor' ? <EditorApp /> : <App />}
  </StrictMode>,
)
