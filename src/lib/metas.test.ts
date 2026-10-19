import assert from 'node:assert/strict'
import { test } from 'node:test'
import { avaliar, mesesAte, ritmoMensal } from './metas.ts'

const HOJE = '2026-10-01'

test('meses até o prazo', () => {
  assert.equal(mesesAte('2027-10-15', HOJE), 12)
  assert.equal(mesesAte('2026-10-31', HOJE), 0)
  assert.equal(mesesAte('2025-01-01', HOJE), 0) // vencido
})

test('ritmo mensal: média dos últimos meses e casos curtos', () => {
  assert.equal(ritmoMensal([100]), null)
  assert.equal(ritmoMensal([100, 130]), 30)
  // 8 pontos, janela de 6: ignora o ponto 0 e usa (170 - 100) / 6
  assert.ok(Math.abs((ritmoMensal([0, 100, 110, 120, 130, 140, 150, 170]) ?? 0) - 70 / 6) < 1e-9)
  assert.equal(ritmoMensal([200, 150]), -50)
})

test('meta atingida', () => {
  const a = avaliar(1_200, 1_000, 50, '2027-01-01', HOJE)
  assert.equal(a.situacao, 'atingida')
  assert.equal(a.pct, 100)
  assert.equal(a.falta, 0)
  assert.equal(a.aporteMensal, null)
})

test('no ritmo: previsão cabe antes do prazo', () => {
  // faltam 600, ritmo 100/mês → 6 meses; prazo em 12 meses
  const a = avaliar(400, 1_000, 100, '2027-10-01', HOJE)
  assert.equal(a.situacao, 'no_ritmo')
  assert.equal(a.previsaoMeses, 6)
  assert.equal(a.previsaoMes, '2027-04-01')
  assert.equal(a.aporteMensal, 50) // 600 / 12
  assert.equal(a.pct, 40)
})

test('atrasada: ritmo insuficiente, negativo ou prazo vencido', () => {
  assert.equal(avaliar(400, 1_000, 20, '2027-10-01', HOJE).situacao, 'atrasada') // 30 meses > 12
  const parado = avaliar(400, 1_000, -10, '2027-10-01', HOJE)
  assert.equal(parado.situacao, 'atrasada')
  assert.equal(parado.previsaoMeses, null)
  assert.equal(avaliar(400, 1_000, 500, '2026-09-01', HOJE).situacao, 'atrasada')
})

test('sem prazo, sem ritmo e previsão absurda', () => {
  assert.equal(avaliar(400, 1_000, 100, null, HOJE).situacao, 'sem_prazo')
  const s = avaliar(400, 1_000, null, '2027-10-01', HOJE)
  assert.equal(s.situacao, 'acompanhando')
  assert.equal(s.aporteMensal, 50)
  assert.equal(avaliar(1, 1_000_000, 0.5, null, HOJE).previsaoMeses, null) // > 50 anos
})
