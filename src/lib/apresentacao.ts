/** "agora", "há 5 min", "há 3 h", "há 2 dias", ou a data se for mais antigo. */
export function tempoRelativo(iso: string | null, agora: number): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const min = Math.round((agora - t) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d < 8) return d === 1 ? 'há 1 dia' : `há ${d} dias`
  return new Date(t).toLocaleDateString('pt-BR')
}

export function formatarVariacao(pct: number): string {
  const sinal = pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : ''
  return `${sinal}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`
}
