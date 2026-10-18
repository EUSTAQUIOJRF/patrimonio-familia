import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  carteira,
  diasEntre,
  porClasse,
  simboloPadrao,
} from './ativos.ts'
import {
  mediaAnual,
  porAtivoProvento,
  somaPorMes,
  somarMeses,
  totaisPorAno,
  valoresDe,
} from './proventos.ts'
import type { Ativo, Cotacao, Posicao, Provento } from './tipos.ts'

const ativos: Ativo[] = [
  { id: 'petr', ticker: 'PETR4', nome: null, classe: 'acao', moeda: 'BRL', simbolo_cotacao: 'PETR4.SA', ativo: true },
  { id: 'aapl', ticker: 'AAPL', nome: null, classe: 'exterior', moeda: 'USD', simbolo_cotacao: 'AAPL', ativo: true },
  { id: 'xpml', ticker: 'XPML11', nome: null, classe: 'fii', moeda: 'BRL', simbolo_cotacao: 'XPML11.SA', ativo: true },
]
const posicoes: Posicao[] = [
  { id: '1', pessoa_id: 'eu', ativo_id: 'petr', quantidade: 100, preco_medio: 30 },
  { id: '2', pessoa_id: 'esp', ativo_id: 'petr', quantidade: 300, preco_medio: 40 },
  { id: '3', pessoa_id: 'eu', ativo_id: 'aapl', quantidade: 10, preco_medio: 150 },
  { id: '4', pessoa_id: 'filha', ativo_id: 'xpml', quantidade: 50, preco_medio: 100 },
  { id: '5', pessoa_id: 'eu', ativo_id: 'xpml', quantidade: 0, preco_medio: 100 },
]
const cot = new Map<string, Cotacao>([
  ['petr', { ativo_id: 'petr', data: '2026-10-09', preco: 50, fonte: 'yahoo' }],
  ['aapl', { ativo_id: 'aapl', data: '2026-10-09', preco: 200, fonte: 'yahoo' }],
])

test('símbolo de cotação por classe', () => {
  assert.equal(simboloPadrao('petr4', 'acao'), 'PETR4.SA')
  assert.equal(simboloPadrao('XPML11.SA', 'fii'), 'XPML11.SA')
  assert.equal(simboloPadrao('aapl', 'exterior'), 'AAPL')
  assert.equal(simboloPadrao('btc', 'cripto'), 'BTC-USD')
})

test('carteira junta pessoas, pondera preço médio e converte', () => {
  const c = carteira(posicoes, ativos, cot, new Set(['eu', 'esp']), 5)
  assert.equal(c.linhas.length, 2) // posição zerada e filha ficam de fora
  const petr = c.linhas.find((l) => l.ticker === 'PETR4')!
  assert.equal(petr.quantidade, 400)
  assert.equal(petr.precoMedio, 37.5) // (100*30 + 300*40) / 400
  assert.equal(petr.valor, 20000)
  assert.equal(petr.resultado, 5000)
  assert.equal(petr.resultadoPct, (5000 / 15000) * 100)
  const aapl = c.linhas.find((l) => l.ticker === 'AAPL')!
  assert.equal(aapl.brl, 10_000) // 10 * 200 * 5
  assert.equal(c.total.brl, 30_000)
  assert.equal(c.total.usd, 20_000 / 5 + 2000)
  assert.equal(c.semPreco, 0)
})

test('ativo sem cotação vale pelo custo e é sinalizado', () => {
  const c = carteira(posicoes, ativos, cot, new Set(['filha']), 5)
  assert.equal(c.semPreco, 1)
  assert.equal(c.linhas[0].valor, 5000)
  assert.equal(c.linhas[0].resultado, null)
  assert.equal(c.linhas[0].semPreco, true)
})

test('participação por classe soma 100', () => {
  const c = carteira(posicoes, ativos, cot, new Set(['eu', 'esp']), 5)
  const f = porClasse(c.linhas)
  assert.ok(Math.abs(f.reduce((a, x) => a + x.pct, 0) - 100) < 1e-9)
  assert.equal(f[0].nome, 'Ações')
})

test('dias entre datas', () => {
  assert.equal(diasEntre('2026-10-01', '2026-10-09'), 8)
  assert.equal(diasEntre('2026-12-30', '2027-01-02'), 3)
})

const pr = (id: string, ativo: string, mes: string, valor: number, moeda: 'BRL' | 'USD' = 'BRL', cambio = 5, pessoa = 'eu'): Provento => ({
  id, pessoa_id: pessoa, ativo_id: ativo, mes, tipo: 'dividendo', valor, moeda, cambio_usd_brl: cambio, observacao: null,
})
const provs: Provento[] = [
  pr('a', 'petr', '2025-11-01', 100),
  pr('b', 'petr', '2026-09-01', 200),
  pr('c', 'aapl', '2026-09-01', 10, 'USD', 5),
  pr('d', 'xpml', '2026-10-01', 50),
]

test('provento em dólar usa o câmbio do lançamento', () => {
  assert.deepEqual(valoresDe(provs[2]), { brl: 50, usd: 10 })
  assert.deepEqual(valoresDe(provs[0]), { brl: 100, usd: 20 })
})

test('meses e soma dos últimos 12 meses (com zeros)', () => {
  assert.equal(somarMeses('2026-01-01', -1), '2025-12-01')
  assert.equal(somarMeses('2026-11-01', 2), '2027-01-01')
  const s = somaPorMes(provs, '2026-10-01', 12)
  assert.equal(s.length, 12)
  assert.equal(s[0].mes, '2025-11-01')
  assert.equal(s[0].brl, 100)
  assert.equal(s[10].brl, 250) // set/2026: 200 + 10 US$ * 5
  assert.equal(s[11].brl, 50)
  assert.equal(s[5].brl, 0)
})

test('totais por ano', () => {
  const t = totaisPorAno(provs)
  assert.deepEqual(t.map((x) => x.ano), [2026, 2025])
  assert.equal(t[0].brl, 300)
})

test('média anual: mínimo de 12 meses de histórico', () => {
  assert.equal(mediaAnual([], '2026-10-01').brl, 0)
  // 1º provento em nov/2025 até out/2026 = 12 meses → média = total
  assert.equal(mediaAnual(provs, '2026-10-01').brl, 400)
  // histórico curto não infla: só set/2026, até out/2026, 2 meses → conta 12
  assert.equal(mediaAnual([provs[1]], '2026-10-01').brl, 200)
  // 24 meses de histórico divide por 2 anos
  assert.equal(mediaAnual([pr('x', 'petr', '2024-11-01', 100), pr('y', 'petr', '2026-10-01', 300)], '2026-10-01').brl, 200)
})

test('por ativo: filtra o ano e traz a média de cada um', () => {
  const f = porAtivoProvento(provs, ativos, '2026-10-01', 2026)
  assert.equal(f[0].nome, 'PETR4')
  assert.equal(f[0].brl, 200) // só 2026
  assert.equal(f[0].media.brl, 300) // todo o histórico
  const todos = porAtivoProvento(provs, ativos, '2026-10-01', null)
  assert.equal(todos[0].brl, 300)
})

import { formatarVariacao, tempoRelativo } from './apresentacao.ts'

test('tempo relativo das notícias', () => {
  const agora = Date.parse('2026-10-18T12:00:00Z')
  assert.equal(tempoRelativo('2026-10-18T11:59:40Z', agora), 'agora')
  assert.equal(tempoRelativo('2026-10-18T11:30:00Z', agora), 'há 30 min')
  assert.equal(tempoRelativo('2026-10-18T09:00:00Z', agora), 'há 3 h')
  assert.equal(tempoRelativo('2026-10-16T12:00:00Z', agora), 'há 2 dias')
  assert.equal(tempoRelativo(null, agora), '')
  assert.equal(tempoRelativo('lixo', agora), '')
})

test('variação formatada com seta e sinal', () => {
  assert.equal(formatarVariacao(1.234), '▲ +1,23%')
  assert.equal(formatarVariacao(-0.5), '▼ -0,50%')
  assert.equal(formatarVariacao(0), '0,00%')
})
