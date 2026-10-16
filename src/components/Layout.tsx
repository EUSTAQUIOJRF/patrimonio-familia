import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AtivosProvider } from '../contexts/AtivosContext'
import { CambioProvider } from '../contexts/CambioContext'
import { DadosProvider } from '../contexts/DadosContext'
import { usePreferencias } from '../contexts/PreferenciasContext'

const itens = [
  { para: '/', rotulo: 'Patrimônio', icone: '◔' },
  { para: '/lancar', rotulo: 'Lançar', icone: '✎' },
  { para: '/ativos', rotulo: 'Ativos', icone: '▤' },
  { para: '/rendimentos', rotulo: 'Rendimentos', icone: '＄' },
  { para: '/favoritos', rotulo: 'Favoritos', icone: '★' },
  { para: '/metas', rotulo: 'Metas', icone: '◎' },
  { para: '/comparar', rotulo: 'Comparar', icone: '⇄' },
  { para: '/ajustes', rotulo: 'Ajustes', icone: '⚙' },
]

export default function Layout() {
  const { email, sair, possuiMfa } = useAuth()
  const { privado, alternarPrivado, moedaPrincipal, alternarMoeda } = usePreferencias()

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <span className="marca-logo" aria-hidden="true">
            ▂▄▆
          </span>
          <span className="marca-nome">Patrimônio Família</span>
        </div>
        <div className="topo-acoes">
          <button
            type="button"
            className="botao-chip"
            onClick={alternarMoeda}
            aria-label="Inverter moeda principal entre real e dólar"
            title="Inverter moeda principal"
          >
            {moedaPrincipal === 'BRL' ? 'R$ → US$' : 'US$ → R$'}
          </button>
          <button
            type="button"
            className={`botao-chip ${privado ? 'ativo' : ''}`}
            onClick={alternarPrivado}
            aria-pressed={privado}
            title="Esconder ou mostrar valores"
          >
            {privado ? '🙈 Oculto' : '👁 Visível'}
          </button>
        </div>
      </header>

      <nav className="menu" aria-label="Principal">
        {itens.map((i) => (
          <NavLink
            key={i.para}
            to={i.para}
            end={i.para === '/'}
            className={({ isActive }) => `menu-item ${isActive ? 'ativo' : ''}`}
          >
            <span className="menu-icone" aria-hidden="true">
              {i.icone}
            </span>
            <span>{i.rotulo}</span>
          </NavLink>
        ))}
        <button type="button" className="menu-item menu-sair" onClick={() => void sair()}>
          <span className="menu-icone" aria-hidden="true">
            ⏻
          </span>
          <span>Sair</span>
        </button>
      </nav>

      <main className="conteudo">
        {possuiMfa === false && (
          <div className="aviso">
            Proteja a conta com verificação em duas etapas.{' '}
            <NavLink to="/ajustes">Ativar agora</NavLink>
          </div>
        )}
        <DadosProvider>
          <CambioProvider>
            <AtivosProvider>
              <Outlet />
            </AtivosProvider>
          </CambioProvider>
        </DadosProvider>
        <footer className="rodape">Conectado como {email}</footer>
      </main>
    </div>
  )
}
