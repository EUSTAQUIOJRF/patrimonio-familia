import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  extrairCotacao,
  lerRss,
  lerSimbolos,
  limparTexto,
  mesclarNoticias,
  urlsNoticias,
} from './mercado.mjs'

const t = (s) => Date.UTC(2026, 9, s, 13, 0, 0) / 1000 // 13:00 UTC de cada dia de outubro
const chart = (meta, tempos, fechos) => ({
  chart: { result: [{ meta, timestamp: tempos, indicators: { quote: [{ close: fechos }] } }], error: null },
})

test('cotação: preço, variação contra o fechamento anterior e série', () => {
  // barras de 14, 15 e 16/10; a de hoje (16) ainda está em andamento
  const r = extrairCotacao(
    chart(
      { regularMarketPrice: 105, regularMarketTime: t(16), currency: 'brl', gmtoffset: -10800 },
      [t(14), t(15), t(16)],
      [98, 100, 104],
    ),
  )
  assert.equal(r.preco, 105)
  assert.equal(r.anterior, 100) // penúltima barra
  assert.equal(r.variacaoPct, 5)
  assert.equal(r.moeda, 'BRL')
  assert.deepEqual(r.serie, [98, 100, 105]) // a série termina no preço atual
})

test('cotação: mercado fechado (última barra é de dia anterior) usa a última barra como anterior', () => {
  const r = extrairCotacao(
    chart(
      { regularMarketPrice: 50, regularMarketTime: t(17), currency: 'USD', gmtoffset: 0 },
      [t(14), t(15)],
      [48, 49],
    ),
  )
  assert.equal(r.anterior, 49)
  assert.deepEqual(r.serie, [48, 49, 50])
})

test('cotação: ignora barras vazias e rejeita respostas ruins', () => {
  const r = extrairCotacao(
    chart({ regularMarketPrice: 10, regularMarketTime: t(16), currency: 'USD' }, [t(14), t(15), t(16)], [9, null, 10]),
  )
  assert.deepEqual(r.serie, [9, 10])
  assert.ok(extrairCotacao({}).erro)
  assert.ok(extrairCotacao({ chart: { result: null, error: { description: 'Not Found' } } }).erro)
  assert.ok(extrairCotacao(chart({ regularMarketPrice: 0 }, [], [])).erro)
})

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Petrobras anuncia dividendos &amp; JCP - InfoMoney]]></title>
<link>https://news.google.com/rss/articles/abc</link><pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate>
<source url="https://www.infomoney.com.br">InfoMoney</source></item>
<item><title>Sem link válido</title><link>nao-e-url</link></item>
<item><title>Apple sobe</title><link>https://finance.yahoo.com/news/apple</link><pubDate>Fri, 16 Oct 2026 15:00:00 GMT</pubDate></item>
</channel></rss>`

test('RSS: lê título, veículo, link e data; separa o veículo do título', () => {
  const n = lerRss(RSS)
  assert.equal(n.length, 2)
  assert.equal(n[0].titulo, 'Petrobras anuncia dividendos & JCP')
  assert.equal(n[0].fonte, 'InfoMoney')
  assert.equal(n[0].data, '2026-10-16T12:00:00.000Z')
  assert.equal(n[1].fonte, 'finance.yahoo.com') // sem <source>, usa o domínio
})

test('limpeza de texto: entidades, CDATA e tags', () => {
  assert.equal(limparTexto('<![CDATA[A &amp; B]]>'), 'A & B')
  assert.equal(limparTexto('<b>Olá</b>  mundo &#233;'), 'Olá mundo é')
})

test('mescla: remove título repetido da mesma região e ordena por data', () => {
  const m = mesclarNoticias([
    { titulo: 'Vale sobe!', origem: 'BR', data: '2026-10-15T10:00:00Z' },
    { titulo: 'vale sobe', origem: 'BR', data: '2026-10-15T11:00:00Z' },
    { titulo: 'Vale sobe', origem: 'EXT', data: '2026-10-16T09:00:00Z' },
    { titulo: 'Outra', origem: 'BR', data: null },
  ])
  assert.equal(m.length, 3)
  assert.equal(m[0].origem, 'EXT') // a mais nova primeiro
  assert.equal(m[2].titulo, 'Outra') // sem data vai para o fim
})

test('símbolos: valida, tira repetidos e limita', () => {
  assert.deepEqual(lerSimbolos('PETR4.SA, AAPL,AAPL,BTC-USD,<script>,'), ['PETR4.SA', 'AAPL', 'BTC-USD'])
  assert.equal(lerSimbolos(Array.from({ length: 50 }, (_, i) => `A${i}`).join(',')).length, 30)
})

test('endereços de notícias por região', () => {
  assert.match(urlsNoticias('PETR4.SA', 'BR')[0], /hl=pt-BR.*|q=PETR4/)
  assert.ok(urlsNoticias('PETR4.SA', 'BR')[0].includes('q=PETR4%20when'))
  assert.equal(urlsNoticias('AAPL', 'EXT').length, 2)
})

import { lerBusca, urlBusca } from './mercado.mjs'

test('busca: filtra tipos, símbolos inválidos e limita', () => {
  const r = lerBusca({
    quotes: [
      { symbol: 'PETR4.SA', shortname: 'PETROBRAS PN', quoteType: 'EQUITY', exchDisp: 'São Paulo' },
      { symbol: '^BVSP', shortname: 'IBOVESPA', quoteType: 'INDEX' },
      { symbol: 'BOVA11.SA', longname: 'iShares Ibovespa &amp; Co', quoteType: 'ETF', exchange: 'SAO' },
      { symbol: 'BTC-USD', shortname: 'Bitcoin USD', quoteType: 'CRYPTOCURRENCY' },
      { symbol: '<x>', shortname: 'ruim', quoteType: 'EQUITY' },
      { symbol: 'XYZ', shortname: 'opção', quoteType: 'OPTION' },
    ],
  })
  assert.deepEqual(r.map((x) => x.simbolo), ['PETR4.SA', 'BOVA11.SA', 'BTC-USD'])
  assert.equal(r[1].nome, 'iShares Ibovespa & Co')
  assert.equal(lerBusca({}).length, 0)
  assert.equal(lerBusca({ quotes: Array.from({ length: 20 }, (_, i) => ({ symbol: `A${i}`, quoteType: 'EQUITY' })) }, 5).length, 5)
  assert.match(urlBusca('banco do brasil'), /q=banco%20do%20brasil/)
})
