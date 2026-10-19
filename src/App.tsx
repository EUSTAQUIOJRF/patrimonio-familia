import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CartaoAuth from './components/CartaoAuth'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PreferenciasProvider } from './contexts/PreferenciasContext'
import { supabaseConfigurado } from './lib/supabase'
import EsqueciSenha from './pages/EsqueciSenha'
import Ajustes from './pages/Ajustes'
import Ativos from './pages/Ativos'
import Rendimentos from './pages/Rendimentos'
import Favoritos from './pages/Favoritos'
import Metas from './pages/Metas'
import Comparar from './pages/Comparar'
import Lancar from './pages/Lancar'
import Patrimonio from './pages/Patrimonio'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import VerificarMfa from './pages/VerificarMfa'

function Porteiro() {
  const { estado, emRecuperacao } = useAuth()

  if (estado === 'carregando') {
    return (
      <div className="auth-fundo">
        <p className="muted">Carregando…</p>
      </div>
    )
  }

  if (estado !== 'deslogado' && emRecuperacao) return <RedefinirSenha />

  if (estado === 'deslogado') {
    return (
      <Routes>
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  if (estado === 'precisa_mfa') return <VerificarMfa />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Patrimonio />} />
        <Route path="lancar" element={<Lancar />} />
        <Route path="ativos" element={<Ativos />} />
        <Route path="rendimentos" element={<Rendimentos />} />
        <Route path="favoritos" element={<Favoritos />} />
        <Route path="metas" element={<Metas />} />
        <Route path="comparar" element={<Comparar />} />
        <Route path="ajustes" element={<Ajustes />} />
        <Route path="seguranca" element={<Navigate to="/ajustes" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!supabaseConfigurado) {
    return (
      <CartaoAuth titulo="Configuração pendente">
        <p className="auth-sub">
          Faltam as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
          Veja o passo a passo no arquivo LEIA-ME.md.
        </p>
      </CartaoAuth>
    )
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <PreferenciasProvider>
          <Porteiro />
        </PreferenciasProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
