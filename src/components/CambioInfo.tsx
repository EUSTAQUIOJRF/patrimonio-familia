import { useState, type FormEvent } from 'react'
import { useCambio } from '../contexts/CambioContext'
import { lerValor } from '../lib/calculos'

function dataBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Mostra a cotação do dólar em uso, com opção de atualizar ou digitar manualmente. */
export default function CambioInfo() {
  const { taxa, data, fonte, carregando, atualizar, definirManual } = useCambio()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const v = lerValor(texto)
    if (v === null || v <= 0) return setErro('Digite um valor maior que zero, por exemplo 5,35.')
    await definirManual(v)
    setEditando(false)
    setErro(null)
  }

  const origem =
    fonte === 'online'
      ? 'cotação de hoje'
      : fonte === 'manual'
        ? 'digitada por você'
        : data
          ? `último valor guardado (${dataBR(data)})`
          : ''

  return (
    <div className="cambio-info">
      {taxa !== null ? (
        <span>
          <strong>US$ 1 = R$ {taxa.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</strong>{' '}
          <span className="muted">· {origem}</span>
        </span>
      ) : (
        <span className="muted">
          {carregando ? 'Buscando a cotação do dólar…' : 'Cotação do dólar indisponível.'}
        </span>
      )}

      {fonte === 'salvo' && (
        <span className="selo selo-alerta">sem conexão com a cotação online</span>
      )}

      {!editando && (
        <span className="cambio-acoes">
          <button type="button" className="link-discreto" onClick={() => void atualizar()}>
            Atualizar
          </button>
          <button
            type="button"
            className="link-discreto"
            onClick={() => {
              setTexto(taxa !== null ? String(taxa).replace('.', ',') : '')
              setEditando(true)
            }}
          >
            Digitar
          </button>
        </span>
      )}

      {editando && (
        <form onSubmit={salvar} className="cambio-form">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Cotação do dólar em reais"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
          />
          <button type="submit" className="botao botao-pequeno">
            Usar
          </button>
          <button
            type="button"
            className="botao botao-pequeno botao-secundario"
            onClick={() => setEditando(false)}
          >
            Cancelar
          </button>
          {erro && (
            <span className="erro" role="alert">
              {erro}
            </span>
          )}
        </form>
      )}
    </div>
  )
}
