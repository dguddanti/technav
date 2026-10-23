import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { lazy, Suspense } from 'react'
import { watchPublishedEntrances } from './services/mapUpdates'
import { startAnalytics } from './services/firebase'

// This entry point owns route selection; Fast Refresh applies in the screen modules.
// eslint-disable-next-line react-refresh/only-export-components
const AdminApp = lazy(() => import('./admin/AdminApp').then((module) => ({ default: module.AdminApp })))
const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
watchPublishedEntrances()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Suspense fallback={<p role="status">Loading administration…</p>}><AdminApp /></Suspense> : <App />}
  </StrictMode>,
)

void startAnalytics()
