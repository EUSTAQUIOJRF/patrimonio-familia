import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CartaoAuth from './components/CartaoAuth'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PreferenciasProvider } from './contexts/PreferenciasContext'
import { supabaseConfigurado } from './lib/supabase'
import EmBreve from './pages/EmBreve'
import EsqueciSenha from './pages/EsqueciSenha'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Seguranca from './pages/Seguranca'
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
        <Route index element={<Inicio />} />
        <Route path="ativos" element={<EmBreve titulo="Ativos" fase="Fase 2" />} />
        <Route path="rendimentos" element={<EmBreve titulo="Rendimentos" fase="Fase 2" />} />
        <Route path="favoritos" element={<EmBreve titulo="Favoritos e notícias" fase="Fase 3" />} />
        <Route path="metas" element={<EmBreve titulo="Metas" fase="Fase 4" />} />
        <Route path="comparar" element={<EmBreve titulo="Comparar ativos" fase="Fase 5" />} />
        <Route path="seguranca" element={<Seguranca />} />
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
