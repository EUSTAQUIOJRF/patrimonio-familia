import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dataDoInstante, extrairPreco, moedaConfere, urlYahoo } from './cotacoes-lib.mjs'

const ok = (meta) => ({ chart: { result: [{ meta }], error: null } })

test('lê preço, moeda e data da resposta do Yahoo', () => {
  // 2026-10-09 20:00 UTC = 17:00 em Brasília
  const t = Date.UTC(2026, 9, 9, 20, 0, 0) / 1000
  const r = extrairPreco(ok({ regularMarketPrice: 38.12, currency: 'BRL', regularMarketTime: t }))
  assert.deepEqual(r, { preco: 38.12, moeda: 'BRL', data: '2026-10-09' })
})

test('data usa o fuso de Brasília (madrugada UTC ainda é o dia anterior)', () => {
  assert.equal(dataDoInstante(Date.UTC(2026, 9, 10, 1, 0, 0) / 1000), '2026-10-09')
})

test('respostas ruins viram erro, não preço', () => {
  assert.ok(extrairPreco({}).erro)
  assert.ok(extrairPreco({ chart: { result: null, error: { description: 'Not Found' } } }).erro)
  assert.ok(extrairPreco(ok({ regularMarketPrice: 0, currency: 'BRL' })).erro)
  assert.ok(extrairPreco(ok({ regularMarketPrice: 'abc' })).erro)
})

test('moeda divergente é detectada', () => {
  assert.equal(moedaConfere('USD', 'USD'), true)
  assert.equal(moedaConfere('', 'BRL'), true)
  assert.equal(moedaConfere('USD', 'BRL'), false)
})

test('url do Yahoo codifica o símbolo', () => {
  assert.match(urlYahoo('PETR4.SA'), /chart\/PETR4\.SA\?/)
  assert.match(urlYahoo('BTC-USD'), /chart\/BTC-USD\?/)
})
