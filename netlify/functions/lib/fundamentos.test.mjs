import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  extrairDesempenho,
  fonteFundamentos,
  lerFinnhub,
  lerFundamentus,
  numeroBR,
  papelFundamentus,
} from './fundamentos.mjs'

test('números no formato brasileiro', () => {
  assert.equal(numeroBR('5,13'), 5.13)
  assert.equal(numeroBR('12,34%'), 12.34)
  assert.equal(numeroBR('1.234.567'), 1234567)
  assert.equal(numeroBR('-4,5'), -4.5)
  assert.equal(numeroBR('R$ 1.000,50'), 1000.5)
  assert.equal(numeroBR('-'), null)
  assert.equal(numeroBR(''), null)
  assert.equal(numeroBR('abc'), null)
})

// Página SINTÉTICA no formato da tabela do Fundamentus (rótulo em td.label, valor em td.data).
const PAGINA = `<table class="w728">
<tr><td class="label w1"><span class="help tips" title="x"><span class="txt">?Papel</span></span></td><td class="data w2"><span class="txt">TESTE4</span></td></tr>
<tr><td class="label"><span class="txt">Oscilações</span></td></tr>
<tr><td class="label w2"><span class="help tips"><span class="txt">?P/L</span></span></td><td class="data w3"><span class="txt">5,13</span></td>
    <td class="label w2"><span class="txt">?LPA</span></td><td class="data w3"><span class="txt">7,50</span></td></tr>
<tr><td class="label"><span class="txt">?P/VP</span></td><td class="data"><span class="txt">1,20</span></td>
    <td class="label"><span class="txt">?Div. Yield</span></td><td class="data"><span class="txt">14,5%</span></td></tr>
<tr><td class="label"><span class="txt">?ROE</span></td><td class="data"><span class="txt">23,4%</span></td>
    <td class="label"><span class="txt">?Marg. Líquida</span></td><td class="data"><span class="txt">-</span></td></tr>
<tr><td class="label"><span class="txt">?Dív. Líquida</span></td><td class="data"><span class="txt">1.234.567</span></td></tr>
<tr><td class="label"><span class="txt">?Valor de mercado</span></td><td class="data"><span class="txt">500.000.000</span></td></tr>
</table>`

test('Fundamentus: junta rótulo e valor, ignora cabeçalho sem valor, reconhece indicadores', () => {
  const r = lerFundamentus(PAGINA)
  assert.ok(!r.erro)
  assert.equal(r.indicadores.pl, 5.13)
  assert.equal(r.indicadores.lpa, 7.5)
  assert.equal(r.indicadores.pvp, 1.2)
  assert.equal(r.indicadores.dy, 14.5)
  assert.equal(r.indicadores.roe, 23.4)
  assert.equal(r.indicadores.margLiquida, null) // "-" vira vazio
  assert.equal(r.indicadores.valorMercado, 500_000_000)
  assert.equal(r.bruto['Papel'], 'TESTE4')
  assert.equal(r.bruto['Oscilações'], undefined) // cabeçalho sem valor não rouba o valor seguinte
})

test('Fundamentus: página vazia ou fora do formato dá erro claro', () => {
  assert.ok(lerFundamentus('<html>Ativo não encontrado</html>').erro)
  assert.ok(lerFundamentus('<td class="label">Foo</td><td class="data">1</td>').erro) // nada reconhecido
})

test('Finnhub: converte os nomes e a capitalização em milhões', () => {
  const r = lerFinnhub({
    metric: {
      peTTM: 28.5,
      pbAnnual: 40.1,
      dividendYieldIndicatedAnnual: 0.5,
      roeTTM: 150.2,
      netProfitMarginTTM: 25.3,
      'totalDebt/totalEquityAnnual': 1.9,
      marketCapitalization: 3_000_000,
    },
  })
  assert.equal(r.indicadores.pl, 28.5)
  assert.equal(r.indicadores.dy, 0.5)
  assert.equal(r.indicadores.divPatrim, 1.9)
  assert.equal(r.indicadores.valorMercado, 3e12)
  assert.equal(r.indicadores.roic, null)
  assert.ok(lerFinnhub({}).erro)
  assert.ok(lerFinnhub({ metric: {} }).erro)
})

test('papel do Fundamentus e escolha da fonte por tipo', () => {
  assert.equal(papelFundamentus('PETR4.SA'), 'PETR4')
  assert.equal(papelFundamentus('xpml11.sa'), 'XPML11')
  assert.equal(papelFundamentus('../etc'), null)
  assert.equal(fonteFundamentos('acao'), 'fundamentus')
  assert.equal(fonteFundamentos('fii'), 'fundamentus')
  assert.equal(fonteFundamentos('stock'), 'finnhub')
  assert.equal(fonteFundamentos('cripto'), null)
})

// Série diária de ~400 dias terminando em 2026-10-16 (quinta), preço sobe 0,1/dia a partir de 100.
function chart1a() {
  const fim = Date.UTC(2026, 9, 16, 13, 0, 0) / 1000
  const tempos = []
  const fech = []
  for (let i = 400; i >= 0; i--) {
    tempos.push(fim - i * 86400)
    fech.push(100 + (400 - i) * 0.1)
  }
  return {
    chart: {
      result: [{ meta: { regularMarketPrice: 140, regularMarketTime: fim, currency: 'brl' }, timestamp: tempos, indicators: { quote: [{ close: fech }] } }],
      error: null,
    },
  }
}

test('desempenho: retornos, faixa de 52 semanas, volatilidade e série enxuta', () => {
  const d = extrairDesempenho(chart1a())
  assert.equal(d.preco, 140)
  assert.equal(d.moeda, 'BRL')
  // 30 dias atrás o preço era 140 - 3 = 137 → +2,19%
  assert.ok(Math.abs(d.ret1m - ((140 - 137) / 137) * 100) < 1e-6)
  assert.ok(Math.abs(d.ret12m - ((140 - 103.5) / 103.5) * 100) < 0.5) // 365 dias atrás ≈ 103,5
  assert.ok(d.ret6m > 0 && d.ret6m < d.ret12m)
  assert.ok(d.retAno > 0)
  assert.equal(d.max52, 140)
  assert.ok(d.min52 < d.max52)
  assert.ok(d.vol > 0 && d.vol < 20) // tendência suave → volatilidade baixa
  assert.ok(d.serie.length <= 70)
  assert.equal(d.serie[d.serie.length - 1].v, 140)
})

test('desempenho: histórico curto não inventa retorno de 12 meses', () => {
  const fim = Date.UTC(2026, 9, 16, 13, 0, 0) / 1000
  const tempos = [fim - 20 * 86400, fim - 10 * 86400, fim]
  const r = extrairDesempenho({
    chart: { result: [{ meta: { regularMarketPrice: 12, regularMarketTime: fim, currency: 'USD' }, timestamp: tempos, indicators: { quote: [{ close: [10, 11, 12] }] } }] },
  })
  assert.equal(r.ret12m, null)
  assert.equal(r.ret6m, null)
  assert.equal(r.ret1m, null) // 30 dias atrás é antes do primeiro ponto
  assert.ok(extrairDesempenho({}).erro)
  assert.ok(extrairDesempenho({ chart: { result: [{ meta: { regularMarketPrice: 5 }, timestamp: [1], indicators: { quote: [{ close: [5] }] } }] } }).erro)
})
