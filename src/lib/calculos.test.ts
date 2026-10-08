import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  emBRL,
  emUSD,
  lerValor,
  listaMeses,
  marcasDoEixo,
  porInstituicao,
  porPessoa,
  retratoAte,
  serieMensal,
  totais,
} from './calculos.ts'
import type { Instituicao, Pessoa, Saldo } from './tipos.ts'

const pessoas: Pessoa[] = [
  { id: 'eu', nome: 'Eu', entra_na_familia: true, ordem: 1 },
  { id: 'esp', nome: 'Esposa', entra_na_familia: true, ordem: 2 },
  { id: 'filha', nome: 'Filha', entra_na_familia: false, ordem: 3 },
]
const instituicoes: Instituicao[] = [
  { id: 'bb', nome: 'Banco A', tipo: 'banco', pais: 'BR', ativa: true },
  { id: 'ib', nome: 'Corretora US', tipo: 'corretora', pais: 'US', ativa: true },
]
let n = 0
const s = (
  pessoa_id: string,
  instituicao_id: string,
  mes: string,
  valor: number,
  moeda: 'BRL' | 'USD',
  cambio_usd_brl: number,
): Saldo => ({
  id: `s${n++}`,
  pessoa_id,
  instituicao_id,
  mes,
  valor,
  moeda,
  cambio_usd_brl,
  observacao: null,
})

const saldos: Saldo[] = [
  s('eu', 'bb', '2026-08-01', 1000, 'BRL', 5),
  s('eu', 'ib', '2026-08-01', 100, 'USD', 5),
  s('eu', 'bb', '2026-09-01', 1100, 'BRL', 5.2),
  s('eu', 'ib', '2026-09-01', 110, 'USD', 5.2),
  s('esp', 'bb', '2026-09-01', 500, 'BRL', 5.2),
  s('filha', 'bb', '2026-09-01', 99999, 'BRL', 5.2),
  // outubro: só a conta do banco foi atualizada; a corretora mantém o valor de setembro
  s('eu', 'bb', '2026-10-01', 1200, 'BRL', 5.5),
]
const familia = new Set(pessoas.filter((p) => p.entra_na_familia).map((p) => p.id))

test('conversão de um saldo em dólar', () => {
  const x = s('eu', 'ib', '2026-09-01', 100, 'USD', 5)
  assert.equal(emBRL(x, 'hoje', 6), 600)
  assert.equal(emBRL(x, 'epoca', 6), 500)
  assert.equal(emUSD(x, 'hoje', 6), 100)
})

test('conversão de um saldo em real para dólar', () => {
  const x = s('eu', 'bb', '2026-09-01', 600, 'BRL', 5)
  assert.equal(emUSD(x, 'hoje', 6), 100)
  assert.equal(emUSD(x, 'epoca', 6), 120)
  assert.equal(emBRL(x, 'hoje', 6), 600)
})

test('retrato mantém o último saldo e avisa quantos foram repetidos', () => {
  const r = retratoAte(saldos, '2026-10-01', familia)
  assert.equal(r.itens.length, 3) // eu/bb (out), eu/ib (set), esp/bb (set)
  assert.equal(r.repetidos, 2)
  const t = totais(r.itens, 'hoje', 5.5)
  assert.equal(t.brl, 1200 + 110 * 5.5 + 500)
})

test('a filha (fora da família) não entra na soma da família', () => {
  const r = retratoAte(saldos, '2026-09-01', familia)
  assert.ok(!r.itens.some((i) => i.pessoa_id === 'filha'))
  assert.equal(totais(r.itens, 'epoca', 5.5).brl, 1100 + 110 * 5.2 + 500)
})

test('retrato de um mês antigo ignora lançamentos futuros', () => {
  const r = retratoAte(saldos, '2026-08-01', familia)
  assert.equal(r.itens.length, 2)
  assert.equal(r.repetidos, 0)
})

test('porcentagens por instituição somam 100', () => {
  const r = retratoAte(saldos, '2026-09-01', familia)
  const fatias = porInstituicao(r.itens, instituicoes, 'hoje', 5)
  const soma = fatias.reduce((a, f) => a + f.pct, 0)
  assert.ok(Math.abs(soma - 100) < 1e-9)
  assert.equal(fatias[0].id, 'bb') // 1600 > 550
})

test('porcentagens por pessoa', () => {
  const r = retratoAte(saldos, '2026-09-01', familia)
  const fatias = porPessoa(r.itens, pessoas, 'hoje', 5)
  assert.equal(fatias.length, 2)
  assert.equal(fatias[0].id, 'eu')
})

test('série mensal não deixa o total despencar quando falta lançamento', () => {
  const serie = serieMensal(saldos, familia, 'hoje', 5)
  assert.deepEqual(
    serie.map((p) => p.mes),
    ['2026-08-01', '2026-09-01', '2026-10-01'],
  )
  assert.ok(serie[2].brl > serie[1].brl) // 1200+550+500 > 1100+550+500
})

test('lista de meses em ordem decrescente', () => {
  assert.deepEqual(listaMeses(saldos), ['2026-10-01', '2026-09-01', '2026-08-01'])
})

test('leitura de valores digitados', () => {
  assert.equal(lerValor('1.234,56'), 1234.56)
  assert.equal(lerValor('1234,5'), 1234.5)
  assert.equal(lerValor('1234.56'), 1234.56)
  assert.equal(lerValor('1.234'), 1234)
  assert.equal(lerValor('R$ 10.000,00'), 10000)
  assert.equal(lerValor('-500'), -500)
  assert.equal(lerValor('1.234.567,89'), 1234567.89)
  assert.equal(lerValor(''), null)
  assert.equal(lerValor('abc'), null)
  assert.equal(lerValor('12,3,4'), null)
})

test('marcas do eixo', () => {
  const m = marcasDoEixo(1_000_000, 1_300_000)
  assert.ok(m.length >= 3 && m.length <= 8)
  assert.ok(m[0] <= 1_000_000 && m[m.length - 1] >= 1_300_000)
  const z = marcasDoEixo(0, 100)
  assert.ok(z[0] >= 0)
  const igual = marcasDoEixo(500, 500)
  assert.ok(igual.length >= 2)
})

import { montarLinhas, prepararEnvio } from './lancamento.ts'

test('formulário: linhas do mês + instituições de meses anteriores em branco', () => {
  const linhas = montarLinhas(saldos, 'eu', '2026-10-01')
  const bb = linhas.find((l) => l.chave === 'bb|BRL')!
  const ib = linhas.find((l) => l.chave === 'ib|USD')!
  assert.equal(bb.saldoId !== null, true) // já lançado em outubro
  assert.equal(bb.texto, '1.200,00')
  assert.equal(bb.anterior, 1100)
  assert.equal(ib.saldoId, null) // só existia em setembro
  assert.equal(ib.texto, '')
  assert.equal(ib.anterior, 110)
})

test('formulário: nada digitado não grava nada; só grava o que mudou', () => {
  const linhas = montarLinhas(saldos, 'eu', '2026-10-01')
  const nomeDe = (id: string) => id
  const base = { pessoaId: 'eu', mes: '2026-10-01', cambio: 5.6, reaplicar: false, nomeDe }

  let r = prepararEnvio(linhas, base)
  assert.deepEqual(r, { envio: [] })

  const ib = linhas.find((l) => l.chave === 'ib|USD')!
  ib.texto = '120,5'
  r = prepararEnvio(linhas, base)
  assert.ok('envio' in r)
  assert.equal(r.envio.length, 1)
  assert.deepEqual(r.envio[0], {
    pessoa_id: 'eu',
    instituicao_id: 'ib',
    mes: '2026-10-01',
    valor: 120.5,
    moeda: 'USD',
    cambio_usd_brl: 5.6,
  })
})

test('formulário: linha já salva mantém o câmbio original, salvo reaplicar', () => {
  const linhas = montarLinhas(saldos, 'eu', '2026-10-01')
  const bb = linhas.find((l) => l.chave === 'bb|BRL')!
  bb.texto = '1300'
  const base = { pessoaId: 'eu', mes: '2026-10-01', cambio: 5.6, reaplicar: false, nomeDe: (i: string) => i }
  let r = prepararEnvio(linhas, base)
  assert.ok('envio' in r)
  assert.equal(r.envio[0].cambio_usd_brl, 5.5) // câmbio gravado quando foi lançado
  r = prepararEnvio(linhas, { ...base, reaplicar: true })
  assert.ok('envio' in r)
  assert.equal(r.envio[0].cambio_usd_brl, 5.6)
})

test('formulário: valor inválido bloqueia o envio e zero é permitido', () => {
  const linhas = montarLinhas(saldos, 'eu', '2026-10-01')
  const base = { pessoaId: 'eu', mes: '2026-10-01', cambio: 5.6, reaplicar: false, nomeDe: (i: string) => `Inst ${i}` }
  const ib = linhas.find((l) => l.chave === 'ib|USD')!
  ib.texto = 'abc'
  let r = prepararEnvio(linhas, base)
  assert.ok('erro' in r)
  assert.match(r.erro, /Inst ib/)
  ib.texto = '0'
  r = prepararEnvio(linhas, base)
  assert.ok('envio' in r)
  assert.equal(r.envio[0].valor, 0)
})
