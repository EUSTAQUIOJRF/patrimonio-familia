import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { traduzirErroAuth } from '../lib/formato'

interface Inscricao {
  fatorId: string
  qr: string
  segredo: string
}

export default function Seguranca() {
  const { possuiMfa, reavaliar, email } = useAuth()
  const [fatorAtivoId, setFatorAtivoId] = useState<string | null>(null)
  const [inscricao, setInscricao] = useState<Inscricao | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setFatorAtivoId(data?.totp[0]?.id ?? null)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar()
  }, [carregar, possuiMfa])

  async function iniciar() {
    setErro(null)
    setOcupado(true)
    // Remove tentativas anteriores não concluídas, para não dar conflito de nome.
    const { data: todos } = await supabase.auth.mfa.listFactors()
    for (const f of todos?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Aplicativo autenticador',
    })
    setOcupado(false)
    if (error) return setErro(traduzirErroAuth(error.message))
    setInscricao({ fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret })
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!inscricao) return
    setErro(null)
    setOcupado(true)
    const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({
      factorId: inscricao.fatorId,
    })
    if (erroDesafio) {
      setOcupado(false)
      return setErro(traduzirErroAuth(erroDesafio.message))
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: inscricao.fatorId,
      challengeId: desafio.id,
      code: codigo.replace(/\s/g, ''),
    })
    setOcupado(false)
    if (error) return setErro(traduzirErroAuth(error.message))
    setInscricao(null)
    setCodigo('')
    await reavaliar()
    await carregar()
  }

  async function cancelar() {
    if (inscricao) await supabase.auth.mfa.unenroll({ factorId: inscricao.fatorId })
    setInscricao(null)
    setCodigo('')
    setErro(null)
  }

  async function desativar() {
    if (!fatorAtivoId) return
    if (!window.confirm('Desativar a verificação em duas etapas? A conta ficará menos protegida.'))
      return
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: fatorAtivoId })
    setOcupado(false)
    if (error) return setErro(traduzirErroAuth(error.message))
    await reavaliar()
    await carregar()
  }

  return (
    <section>
      <h1 className="titulo-pagina">Segurança</h1>
      <p className="muted">Conta: {email}</p>

      <div className="cartao">
        <h2>Verificação em duas etapas</h2>

        {fatorAtivoId && !inscricao && (
          <>
            <p>
              <span className="selo selo-ok">Ativada</span> A cada login, além da senha, será pedido
              o código do aplicativo autenticador.
            </p>
            <button type="button" className="botao botao-perigo" onClick={desativar} disabled={ocupado}>
              Desativar
            </button>
          </>
        )}

        {!fatorAtivoId && !inscricao && (
          <>
            <p>
              <span className="selo selo-alerta">Desativada</span> Recomendado: são dados financeiros
              da família. Use um aplicativo como Google Authenticator, Microsoft Authenticator ou
              Authy.
            </p>
            <button type="button" className="botao" onClick={iniciar} disabled={ocupado}>
              {ocupado ? 'Preparando…' : 'Ativar'}
            </button>
          </>
        )}

        {inscricao && (
          <form onSubmit={confirmar} className="formulario">
            <ol className="passos">
              <li>Abra o aplicativo autenticador e adicione uma conta lendo este QR code:</li>
            </ol>
            <img className="qr" src={inscricao.qr} alt="QR code para o aplicativo autenticador" />
            <p className="muted">
              Sem câmera? Digite esta chave no aplicativo: <code>{inscricao.segredo}</code>
            </p>
            <label>
              Código de 6 dígitos mostrado no aplicativo
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </label>
            <div className="linha-botoes">
              <button type="submit" className="botao" disabled={ocupado}>
                {ocupado ? 'Confirmando…' : 'Confirmar e ativar'}
              </button>
              <button type="button" className="botao botao-secundario" onClick={cancelar}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
      </div>
    </section>
  )
}
