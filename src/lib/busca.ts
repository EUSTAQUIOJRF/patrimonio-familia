import { moedaPadrao } from './ativos.ts'
import type { ClasseAtivo } from './tipos.ts'
import type { Moeda } from './formato.ts'

export interface Candidato {
  ticker: string
  classe: ClasseAtivo
  moeda: Moeda
  simbolo_cotacao: string
}

/** Classe e moeda prováveis de um resultado de busca (o usuário não precisa acertar nada). */
export function candidatoDeResultado(simbolo: string, tipo: string): Candidato {
  const s = simbolo.toUpperCase()
  const br = s.endsWith('.SA')
  const ticker = br ? s.slice(0, -3) : s.replace(/-USD$/, '')
  let classe: ClasseAtivo
  if (tipo === 'CRYPTOCURRENCY') classe = 'cripto'
  else if (br) classe = tipo === 'ETF' ? 'etf' : /11$/.test(ticker) ? 'fii' : 'acao'
  else classe = tipo === 'ETF' ? 'etf_ext' : 'stock'
  const moeda: Moeda = moedaPadrao(classe)
  return { ticker, classe, moeda, simbolo_cotacao: s }
}

/** Adivinha um candidato a partir do que a pessoa digitou (ex.: "wege3", "AAPL", "btc"). null se não parece um código. */
export function candidatoDeTexto(texto: string): Candidato | null {
  const t = texto.trim().toUpperCase()
  if (!/^[A-Z0-9.\-^=]{1,20}$/.test(t)) return null
  if (t.endsWith('-USD')) return candidatoDeResultado(t, 'CRYPTOCURRENCY')
  if (t.endsWith('.SA') || /^[A-Z]{4}\d{1,2}$/.test(t)) return candidatoDeResultado(t.endsWith('.SA') ? t : `${t}.SA`, 'EQUITY')
  if (['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'BNB'].includes(t)) return candidatoDeResultado(`${t}-USD`, 'CRYPTOCURRENCY')
  return candidatoDeResultado(t, 'EQUITY')
}
