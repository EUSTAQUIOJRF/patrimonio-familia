export default function EmBreve({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <section>
      <h1 className="titulo-pagina">{titulo}</h1>
      <div className="cartao">
        <p>
          <span className="selo">Em breve</span> Esta tela será construída na {fase}.
        </p>
      </div>
    </section>
  )
}
