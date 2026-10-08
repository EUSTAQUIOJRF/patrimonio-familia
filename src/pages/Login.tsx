import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import CartaoAuth from '../components/CartaoAuth'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const msg = await entrar(email, senha)
    setEnviando(false)
    if (msg) setErro(msg)
  }

  return (
    <CartaoAuth titulo="Patrimônio Família" subtitulo="Entre para ver o patrimônio.">
      <form onSubmit={aoEnviar} className="formulario">
        <label>
          E-mail
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <Link to="/esqueci-senha" className="link-discreto">
          Esqueci minha senha
        </Link>
      </form>
    </CartaoAuth>
  )
}
