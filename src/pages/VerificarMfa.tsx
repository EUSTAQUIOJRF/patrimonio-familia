import { useState, type FormEvent } from 'react'
import CartaoAuth from '../components/CartaoAuth'
import { useAuth } from '../contexts/AuthContext'

export default function VerificarMfa() {
  const { verificarMfa, sair } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const msg = await verificarMfa(codigo)
    setEnviando(false)
    if (msg) setErro(msg)
  }

  return (
    <CartaoAuth
      titulo="Verificação em duas etapas"
      subtitulo="Digite o código de 6 dígitos do aplicativo autenticador."
    >
      <form onSubmit={aoEnviar} className="formulario">
        <label>
          Código
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Verificando…' : 'Verificar'}
        </button>
        <button type="button" className="link-discreto" onClick={() => void sair()}>
          Cancelar e sair
        </button>
      </form>
    </CartaoAuth>
  )
}
