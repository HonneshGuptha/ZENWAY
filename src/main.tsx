import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthProvider } from '@/context/AuthContext'
import { RouterProvider } from '@/context/RouterContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import './index.css'
import App from './App.tsx'

Object.defineProperty(window, "__zw_origin", {
  value: () => {
    console.log(
      "%c ZENWAY ORIGIN VERIFIED ",
      "background:#EA2E00;color:#FAF6EE;font-weight:800;padding:4px 8px;border-radius:4px;",
      "\nArchitect: Honnesh N Guptha\nID: 25ETAI410055\nSignature: HNG-ZENWAY-2026"
    );
    return "HNG-25ETAI410055-ZENWAY-2026";
  },
  enumerable: false,
  configurable: false,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <RouterProvider>
            <NotificationProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </NotificationProvider>
          </RouterProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
)
