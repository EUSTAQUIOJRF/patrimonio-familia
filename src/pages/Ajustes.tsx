import { useState } from 'react'
import { useDados } from '../contexts/DadosContext'
import { dataHoje } from '../lib/formato'
import { supabase } from '../lib/supabase'
import Seguranca from './Seguranca'

type Tabela = 'pessoas' | 'instituicoes'

function EditorDeNome({
  tabela,
  id,
  nomeAtual,
  aoSalvar,
}: {
  tabela: Tabela
  id: string
  nomeAtual: string
  aoSalvar: () => Promise<void>
}) {
  const [nome, setNome] = useState(nomeAtual)
  const [estado, setEstado] = useState<'parado' | 'salvando' | 'salvo' | 'erro'>('parado')

  async function salvar() {
    const limpo = nome.trim()
    if (!limpo || limpo === nomeAtual) return
    setEstado('salvando')
    const { error } = await supabase.from(tabela).update({ nome: limpo }).eq('id', id)
    if (error) return setEstado('erro')
    await aoSalvar()
    setEstado('salvo')
  }

  return (
    <div className="editor-nome">
      <input
        type="text"
        aria-label="Nome"
        value={nome}
        onChange={(e) => {
          setNome(e.target.value)
          setEstado('parado')
        }}
      />
      <button
        type="button"
        className="botao botao-pequeno"
        onClick={() => void salvar()}
        disabled={estado === 'salvando' || !nome.trim() || nome.trim() === nomeAtual}
      >
        Salvar
      </button>
      {estado === 'salvo' && <span className="ok">salvo</span>}
      {estado === 'erro' && <span className="erro">não foi possível salvar</span>}
    </div>
  )
}

export default function Ajustes() {
  const { pessoas, instituicoes, recarregar, recarregarCadastro } = useDados()
  const [exportando, setExportando] = useState(false)
  const [erroBackup, setErroBackup] = useState<string | null>(null)

  async function baixarBackup() {
    setErroBackup(null)
    setExportando(true)
    try {
      const pegar = async (tabela: string) => {
        const todas: unknown[] = []
        for (let ini = 0; ; ini += 1000) {
          const { data, error } = await supabase
            .from(tabela)
            .select('*')
            .range(ini, ini + 999)
          if (error) throw new Error(error.message)
          todas.push(...data)
          if (data.length < 1000) break
        }
        return todas
      }
      const conteudo = {
        gerado_em: new Date().toISOString(),
        pessoas: await pegar('pessoas'),
        instituicoes: await pegar('instituicoes'),
        saldos: await pegar('saldos'),
        cambio: await pegar('cambio'),
      }
      const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-patrimonio-${dataHoje()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErroBackup(e instanceof Error ? e.message : 'Falha ao gerar o backup.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <section>
      <h1 className="titulo-pagina">Ajustes</h1>

      <div className="cartao">
        <h2>Nomes das pessoas</h2>
        <p className="muted">Como cada pessoa aparece nas abas e nos gráficos.</p>
        {pessoas.map((p) => (
          <div key={p.id} className="linha-ajuste">
            <span className="linha-ajuste-rotulo">
              {p.entra_na_familia ? 'Entra na soma da Família' : 'Só monitoramento'}
            </span>
            <EditorDeNome
              tabela="pessoas"
              id={p.id}
              nomeAtual={p.nome}
              aoSalvar={recarregarCadastro}
            />
          </div>
        ))}
      </div>

      {instituicoes.length > 0 && (
        <div className="cartao">
          <h2>Bancos e corretoras</h2>
          <p className="muted">Corrija o nome de uma instituição; os saldos acompanham.</p>
          {instituicoes.map((i) => (
            <div key={i.id} className="linha-ajuste">
              <span className="linha-ajuste-rotulo">{i.tipo}</span>
              <EditorDeNome
                tabela="instituicoes"
                id={i.id}
                nomeAtual={i.nome}
                aoSalvar={recarregar}
              />
            </div>
          ))}
        </div>
      )}

      <div className="cartao">
        <h2>Cópia de segurança</h2>
        <p className="muted">
          Baixa um arquivo com todos os saldos, bancos, pessoas e cotações. Faça isso de vez em
          quando (por exemplo, depois de lançar o mês) e guarde em um lugar seguro: o arquivo
          contém dados financeiros e não tem senha.
        </p>
        <button
          type="button"
          className="botao botao-secundario"
          onClick={() => void baixarBackup()}
          disabled={exportando}
        >
          {exportando ? 'Gerando…' : 'Baixar backup (JSON)'}
        </button>
        {erroBackup && (
          <p className="erro" role="alert">
            {erroBackup}
          </p>
        )}
      </div>

      <h2 className="subtitulo-ajustes">Segurança</h2>
      <Seguranca />
    </section>
  )
}
