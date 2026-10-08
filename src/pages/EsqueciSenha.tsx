import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import CartaoAuth from '../components/CartaoAuth'
import { useAuth } from '../contexts/AuthContext'

export default function EsqueciSenha() {
  const { enviarRecuperacao } = useAuth()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const msg = await enviarRecuperacao(email)
    setEnviando(false)
    if (msg) setErro(msg)
    else setEnviado(true)
  }

  if (enviado) {
    return (
      <CartaoAuth titulo="Confira seu e-mail">
        <p className="auth-sub">
          Se <strong>{email}</strong> for uma conta cadastrada, enviamos um link para criar uma nova
          senha. Pode levar alguns minutos; veja também a caixa de spam.
        </p>
        <Link to="/" className="botao botao-link">
          Voltar ao login
        </Link>
      </CartaoAuth>
    )
  }

  return (
    <CartaoAuth
      titulo="Recuperar senha"
      subtitulo="Digite o e-mail da conta (o seu ou o da sua esposa) para receber o link."
    >
      <form onSubmit={aoEnviar} className="formulario">
        <label>
          E-mail de recuperação
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar link'}
        </button>
        <Link to="/" className="link-discreto">
          Voltar ao login
        </Link>
      </form>
    </CartaoAuth>
  )
}
