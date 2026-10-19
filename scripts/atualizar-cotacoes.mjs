// Atualiza os preços dos ativos no Supabase. Roda toda noite pelo GitHub Actions.
// Variáveis de ambiente: SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, ROBO_EMAIL, ROBO_SENHA
// O "robô" é um usuário comum do Supabase (sem poder de administrador).
import { extrairPreco, moedaConfere, urlYahoo } from './cotacoes-lib.mjs'

const { SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, ROBO_EMAIL, ROBO_SENHA } = process.env
for (const [nome, v] of Object.entries({ SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, ROBO_EMAIL, ROBO_SENHA })) {
  if (!v) {
    console.error(`Falta a variável ${nome}.`)
    process.exit(1)
  }
}
const base = SUPABASE_URL.replace(/\/+$/, '')

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function buscarComTentativas(url, opcoes = {}, tentativas = 3) {
  let ultimo
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(15000) })
      if (r.ok) return r
      ultimo = new Error(`HTTP ${r.status}`)
      if (r.status < 500 && r.status !== 429) break
    } catch (e) {
      ultimo = e
    }
    if (i < tentativas) await dormir(1500 * i)
  }
  throw ultimo
}

async function entrar() {
  const r = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CHAVE_PUBLICA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ROBO_EMAIL, password: ROBO_SENHA }),
  })
  if (!r.ok) throw new Error(`Login do robô falhou (HTTP ${r.status}). Confira ROBO_EMAIL e ROBO_SENHA.`)
  return (await r.json()).access_token
}

const token = await entrar()
const cab = {
  apikey: SUPABASE_CHAVE_PUBLICA,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
}

const lista = await (
  await buscarComTentativas(`${base}/rest/v1/ativos?select=id,ticker,moeda,simbolo_cotacao&ativo=eq.true&classe=not.in.(renda_fixa,tesouro)`, {
    headers: cab,
  })
).json()
console.log(`${lista.length} ativos para atualizar.`)

const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const linhas = []
const falhas = []
for (const a of lista) {
  try {
    const r = await buscarComTentativas(urlYahoo(a.simbolo_cotacao), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; patrimonio-familia)' },
    })
    const x = extrairPreco(await r.json())
    if (x.erro) throw new Error(x.erro)
    if (!moedaConfere(x.moeda, a.moeda)) {
      throw new Error(`a fonte informa ${x.moeda}, mas o ativo está cadastrado em ${a.moeda}`)
    }
    linhas.push({ ativo_id: a.id, data: x.data ?? hoje, preco: x.preco, fonte: 'yahoo' })
    console.log(`OK   ${a.ticker} (${a.simbolo_cotacao}) = ${x.preco} ${x.moeda} em ${x.data ?? hoje}`)
  } catch (e) {
    falhas.push(a.ticker)
    console.error(`FALHA ${a.ticker} (${a.simbolo_cotacao}): ${e.message}`)
  }
  await dormir(250) // sem pressa: evita bloqueio por excesso de pedidos
}

if (linhas.length > 0) {
  const r = await fetch(`${base}/rest/v1/cotacoes?on_conflict=ativo_id,data`, {
    method: 'POST',
    headers: { ...cab, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(linhas),
  })
  if (!r.ok) {
    console.error(`Não consegui gravar as cotações: HTTP ${r.status} ${await r.text()}`)
    process.exit(1)
  }
  console.log(`${linhas.length} cotações gravadas.`)
}
if (falhas.length > 0) {
  console.error(`Sem preço para: ${falhas.join(', ')}`)
  // Falha parcial (um código errado, um ativo deslistado) vira só um aviso amarelo no GitHub.
  // A execução só fica vermelha (e manda e-mail) se nada foi gravado ou se mais da metade falhou.
  if (linhas.length === 0 || falhas.length > lista.length / 2) process.exit(1)
  console.log(`::warning::Sem preço para: ${falhas.join(', ')}. Confira o código de cotação na tela Ativos.`)
}
