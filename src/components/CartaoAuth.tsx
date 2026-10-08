import type { ReactNode } from 'react'

/** Moldura centralizada usada nas telas de entrada (login, 2 etapas, recuperação). */
export default function CartaoAuth({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
}) {
  return (
    <div className="auth-fundo">
      <div className="auth-cartao">
        <div className="auth-marca" aria-hidden="true">
          ▂▄▆
        </div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="auth-sub">{subtitulo}</p>}
        {children}
      </div>
    </div>
  )
}
