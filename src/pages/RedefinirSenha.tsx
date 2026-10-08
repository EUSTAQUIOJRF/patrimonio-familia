import { useState, type FormEvent } from 'react'
import CartaoAuth from '../components/CartaoAuth'
import { useAuth } from '../contexts/AuthContext'

export default function RedefinirSenha() {
  const { definirNovaSenha } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.')
    setEnviando(true)
    const msg = await definirNovaSenha(senha)
    setEnviando(false)
    if (msg) setErro(msg)
  }

  return (
    <CartaoAuth titulo="Nova senha" subtitulo="Escolha uma senha forte, com 8 caracteres ou mais.">
      <form onSubmit={aoEnviar} className="formulario">
        <label>
          Nova senha
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <label>
          Repita a nova senha
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </label>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </CartaoAuth>
  )
}
