// Dados para o comparador. GET /.netlify/functions/comparar?i=PETR4.SA|acao,VALE3.SA|acao,AAPL|exterior
// Devolve, para cada item: desempenho do preço em 12 meses e indicadores fundamentalistas (quando existirem).
import { exigirLogin, json } from './lib/auth.mjs'
import {
  extrairDesempenho,
  fonteFundamentos,
  lerFinnhub,
  lerFundamentus,
  papelFundamentus,
} from './lib/fundamentos.mjs'

const CLASSES = new Set(['acao', 'etf', 'bdr', 'fii', 'cripto', 'exterior'])
const SIMBOLO_OK = /^[A-Za-z0-9.\-=^]{1,20}$/
const UA = 'Mozilla/5.0 (compatible; patrimonio-familia)'

async function baixar(url, tipo) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return tipo === 'json' ? r.json() : r.text()
}

const msg = (e) => (e instanceof Error ? e.message : 'falha')

async function desempenho(simbolo) {
  try {
    return extrairDesempenho(
      await baixar(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=1y&interval=1d`,
        'json',
      ),
    )
  } catch (e) {
    return { erro: msg(e) }
  }
}

async function fundamentos(simbolo, classe) {
  const fonte = fonteFundamentos(classe)
  if (!fonte) return { fonte: null, erro: 'Sem indicadores fundamentalistas para este tipo de ativo.' }
  try {
    if (fonte === 'fundamentus') {
      const papel = papelFundamentus(simbolo)
      if (!papel) return { fonte, erro: 'Código inválido para o Fundamentus.' }
      const r = lerFundamentus(await baixar(`https://www.fundamentus.com.br/detalhes.php?papel=${papel}`, 'texto'))
      return { fonte: 'Fundamentus', ...r }
    }
    const chave = process.env.FINNHUB_KEY
    if (!chave) return { fonte: 'Finnhub', erro: 'Indicadores do exterior precisam da chave FINNHUB_KEY na Netlify.' }
    const r = lerFinnhub(
      await baixar(
        `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(simbolo)}&metric=all&token=${encodeURIComponent(chave)}`,
        'json',
      ),
    )
    return { fonte: 'Finnhub', ...r }
  } catch (e) {
    return { fonte: fonte === 'fundamentus' ? 'Fundamentus' : 'Finnhub', erro: msg(e) }
  }
}

export default async (req) => {
  const login = await exigirLogin(req)
  if (!login.ok) return json({ erro: login.erro }, login.status, { 'cache-control': 'no-store' })

  const itens = String(new URL(req.url).searchParams.get('i') ?? '')
    .split(',')
    .map((x) => x.split('|'))
    .filter(([s, c]) => SIMBOLO_OK.test(s ?? '') && CLASSES.has(c))
    .slice(0, 5)
  if (itens.length === 0) return json({ erro: 'Escolha de 1 a 5 ativos.' }, 400)

  const resultados = await Promise.all(
    itens.map(async ([simbolo, classe]) => {
      const [d, f] = await Promise.all([desempenho(simbolo), fundamentos(simbolo, classe)])
      return [simbolo, { desempenho: d, fundamentos: f }]
    }),
  )
  return json({ itens: Object.fromEntries(resultados), atualizadoEm: new Date().toISOString() }, 200, {
    'cache-control': 'private, max-age=300',
  })
}
