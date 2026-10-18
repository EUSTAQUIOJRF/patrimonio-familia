import { supabase } from './supabase'

export interface CotacaoVivo {
  preco: number
  anterior: number | null
  variacaoPct: number | null
  moeda: string
  hora: string | null
  serie: number[]
  erro?: undefined
}
export interface CotacaoErro {
  erro: string
}
export type RespostaCotacao = CotacaoVivo | CotacaoErro

export interface Noticia {
  titulo: string
  link: string
  fonte: string
  data: string | null
  /** BR = imprensa brasileira; EXT = imprensa estrangeira. */
  origem: 'BR' | 'EXT'
  /** Ticker a que a notícia se refere; null = mercado em geral. */
  ativo: string | null
}

async function chamar<T>(rota: string, params: Record<string, string>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre de novo.')
  const q = new URLSearchParams(params).toString()
  const r = await fetch(`/.netlify/functions/${rota}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  })
  const tipo = r.headers.get('content-type') ?? ''
  if (!tipo.includes('json')) {
    throw new Error('Serviço de cotações indisponível (as funções da Netlify ainda não foram publicadas?).')
  }
  const corpo = (await r.json()) as T & { erro?: string }
  if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`)
  return corpo
}

export async function buscarCotacoes(simbolos: string[]): Promise<Record<string, RespostaCotacao>> {
  const r = await chamar<{ cotacoes: Record<string, RespostaCotacao> }>('cotacao', { s: simbolos.join(',') })
  return r.cotacoes
}

export async function buscarNoticias(simbolos: string[], geral: boolean): Promise<Noticia[]> {
  const r = await chamar<{ noticias: Noticia[] }>('noticias', {
    s: simbolos.join(','),
    geral: geral ? '1' : '0',
  })
  return r.noticias
}
