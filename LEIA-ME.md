# Patrimônio Família — Fases 0 a 4

Web-app (PWA) para acompanhar o patrimônio da família.

- **Fase 0 (fundação):** login, 2 etapas, recuperação de senha, modo privacidade, botão R$ ↔ US$.
- **Fase 1 (coração do app):** tela **Patrimônio** (Família, Eu, Esposa, Filho), tela **Lançar saldos**, câmbio do dia, gráficos e **Ajustes**. Os passos da Fase 1 estão no fim deste arquivo.


---

## Passo 1 — Preparar o banco (Supabase)

1. Abra o projeto novo em **supabase.com/dashboard**.
2. Menu **SQL Editor → New query**.
3. Abra o arquivo `supabase/01_schema_fase1.sql`, copie todo o conteúdo, cole e clique em **Run**.
4. Em **Table Editor** devem aparecer as tabelas `pessoas`, `instituicoes`, `saldos` e `cambio`. A tabela `pessoas` já vem com Eu, Esposa, Filho e Filha (você pode renomear lá).

## Passo 2 — Travar o acesso e criar as duas contas

1. **Authentication → Sign In / Providers** (ou *Providers → Email*): **desligue** "Allow new users to sign up". Assim ninguém além de vocês consegue criar conta.
2. **Authentication → Users → Add user → Create new user**: crie a sua conta e a da sua esposa, com e-mail e senha forte. Marque a opção de confirmar o e-mail automaticamente.
3. Guarde as senhas em um gerenciador de senhas.

## Passo 3 — Copiar as duas chaves públicas

Em **Project Settings → API** copie:
- **Project URL**
- a chave pública (**anon** ou **publishable**)

> ⚠️ Nunca use a chave `service_role` / `secret` neste app, nem a coloque no GitHub ou no chat.

## Passo 4 — Testar no seu computador (opcional, mas recomendado)

Precisa do **Node.js 22** instalado (nodejs.org).

```bash
npm install
cp .env.example .env.local      # no Windows: copy .env.example .env.local
# abra o .env.local e cole a URL e a chave pública
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173) e entre com uma das contas.

## Passo 5 — Subir no GitHub

1. Crie um repositório **privado** no GitHub (ex.: `patrimonio-familia`).
2. Na pasta do projeto:

```bash
git init
git add .
git commit -m "Fase 0"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/patrimonio-familia.git
git push -u origin main
```

O arquivo `.gitignore` já impede que `.env.local` (suas chaves) vá para o GitHub. Confira se ele **não** aparece no repositório.

## Passo 6 — Publicar na Netlify

1. **Netlify → Add new site → Import an existing project → GitHub** e escolha o repositório.
2. As configurações de build já estão no arquivo `netlify.toml` (comando `npm run build`, pasta `dist`).
3. Antes de publicar, em **Site configuration → Environment variables**, crie:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chave pública
4. Clique em **Deploy**. Anote o endereço do site (ex.: `https://nome.netlify.app`). Se quiser, mude o nome em **Site configuration → Change site name**.

## Passo 7 — Avisar o Supabase sobre o endereço do site

Sem isso o link de "esqueci minha senha" não volta para o app.

Em **Authentication → URL Configuration**:
- **Site URL:** o endereço da Netlify (ex.: `https://nome.netlify.app`)
- **Redirect URLs:** adicione `https://nome.netlify.app/` e, se for testar localmente, `http://localhost:5173/`

## Passo 8 — Ativar a verificação em duas etapas

Entre no app → menu **Ajustes → Segurança → Ativar**. Leia o QR code com Google Authenticator, Microsoft Authenticator ou Authy e confirme com o código de 6 dígitos. Faça isso nas duas contas.

## Passo 9 — Instalar no celular

- **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
- **iPhone (Safari):** botão de compartilhar → *Adicionar à Tela de Início*.

---

## Testes rápidos depois de publicar

- [ ] Entrar com e-mail e senha.
- [ ] "Esqueci minha senha" → e-mail chega → link abre o app na tela de nova senha.
- [ ] Botão **R$ → US$** troca o valor grande e o pequeno.
- [ ] Botão **Oculto/Visível** esconde os valores e continua assim ao recarregar.
- [ ] Ajustes → Segurança → ativar 2 etapas → sair → entrar de novo pedindo o código.

## Observações importantes

- **E-mails de recuperação:** o envio padrão do Supabase tem limite baixo por hora e pode cair em spam. Para duas pessoas costuma bastar. Se incomodar, dá para configurar um SMTP próprio depois.
- **Plano gratuito do Supabase:** pode pausar projetos sem uso por vários dias. Na Fase 1 vamos incluir uma rotina que mantém o projeto ativo e outra de backup.
- **Privacidade:** o modo "Oculto" só esconde os valores na tela. A proteção dos dados em si vem do login, das regras de acesso (RLS) e da verificação em duas etapas.

## Estrutura

```
supabase/01_schema_fase1.sql   tabelas e regras de segurança
supabase/02_fase1.sql          função ping() (manter o projeto ativo)
.github/workflows/             rotina que chama o ping() duas vezes por semana
src/contexts/                  login, preferências (privacidade, moeda), dados e câmbio
src/lib/calculos.ts            contas do patrimônio (testadas: npm test)
src/lib/lancamento.ts          lógica do formulário de saldos (testada)
src/pages/                     telas
src/components/                menu, valores, gráficos
netlify.toml                   configuração de publicação
```

---

# Fase 1 — como atualizar e usar

## Passo A — Rodar o SQL novo no Supabase

**SQL Editor → New query**, cole o conteúdo de `supabase/02_fase1.sql` e clique em **Run**. (O `01_schema_fase1.sql` já foi rodado na Fase 0 e não precisa rodar de novo.)

## Passo B — Atualizar o projeto no seu computador e no GitHub

1. Extraia o zip da Fase 1 **por cima** da pasta do projeto (o PowerShell faz isso: `Expand-Archive -Path "CAMINHO\patrimonio-familia-fase1.zip" -DestinationPath "." -Force`, estando dentro da pasta do projeto). Seu `.env.local` e seu `.gitignore` não são tocados.
2. Apague o arquivo antigo que não é mais usado: `Remove-Item src\pages\Inicio.tsx`
3. (Opcional) Teste local: `npm install` e `npm run dev`. Para rodar os testes dos cálculos: `npm test`.
4. Envie para o GitHub; a Netlify publica sozinha:
```powershell
git add .
git status --short
git commit -m "Fase 1: patrimônio, lançamento de saldos e câmbio"
git push
```
Confira no `git status` que `.env.local` não aparece.

## Passo C — Manter o Supabase gratuito ativo (recomendado)

O plano gratuito pausa projetos parados por vários dias. A rotina `.github/workflows/manter-supabase-ativo.yml` chama a função `ping()` duas vezes por semana. Para ela funcionar, no GitHub abra o repositório → **Settings → Secrets and variables → Actions → New repository secret** e crie:

- `SUPABASE_URL` = a URL do projeto (`https://xxxx.supabase.co`)
- `SUPABASE_CHAVE_PUBLICA` = a chave `sb_publishable_...`

Para testar na hora: aba **Actions → Manter Supabase ativo → Run workflow**. Deve terminar em verde.
(O GitHub desliga rotinas agendadas de repositórios sem nenhuma atividade por 60 dias; se isso acontecer, é só reativar na aba Actions. Usando o app todo mês, o projeto também fica ativo por conta própria.)

## Como usar

1. **Lançar:** escolha a pessoa e o mês, digite o saldo de cada banco/corretora (em R$ ou US$) e clique em **Salvar saldos**. Os valores do mês anterior aparecem como lembrete, e as instituições do mês passado já vêm na lista. Para um banco novo: **Adicionar banco ou corretora à lista → Nova instituição**.
2. **Patrimônio:** abas Família, Eu, Esposa e Filho; escolha o mês; veja o total em R$ e US$ (o botão do topo inverte qual é grande), a participação de cada banco/corretora e a evolução mês a mês.
3. **Dólar:** a cotação do dia é buscada sozinha (fonte: AwesomeAPI) e guardada no banco. Se a busca falhar, vale a última guardada, e dá para **Digitar** uma cotação.
4. **De hoje × da época:** "de hoje" converte todos os saldos em dólar pela cotação atual; "da época" usa o dólar que valia quando cada saldo foi lançado.
5. **Backup:** Ajustes → **Baixar backup (JSON)**. Faça depois de lançar o mês e guarde em local seguro.

## Regras que o app segue

- A **Filha** não aparece no Patrimônio nem entra na soma da Família (ela será usada só na tela de Ativos).
- Se um banco **não for lançado** em um mês, vale o último valor informado (o app avisa quantos saldos estão assim). Para zerar uma conta, lance `0`.
- Cada saldo guarda o câmbio do dia do lançamento; linhas já salvas mantêm esse câmbio, a menos que você marque "Reaplicar".


---

# Fase 2 — Ativos e Rendimentos

Novas telas: **Ativos** (carteira de cada pessoa e da família, com preço atual, resultado e participação por tipo; a Filha aparece só como "monitor", fora da soma) e **Rendimentos** (dividendos, JCP e rendimentos de FIIs lançados à mão, com gráfico dos últimos 12 meses, total por ativo, por ano e média anual).

## Passo D — Banco: rodar o SQL novo
**SQL Editor → New query**, cole `supabase/03_fase2.sql` e **Run**. Devem surgir as tabelas `ativos`, `posicoes`, `cotacoes`, `proventos`.

## Passo E — Publicar o código
Na pasta do projeto (PowerShell):
```powershell
Expand-Archive -Path "CAMINHO\patrimonio-familia-fase2.zip" -DestinationPath "." -Force
git add .
git status --short      # confira que .env.local NÃO aparece
git commit -m "Fase 2: ativos e rendimentos"
git push
```

## Passo F — Preços automáticos toda noite (GitHub Actions)
A rotina `.github/workflows/atualizar-cotacoes.yml` busca os preços (fonte: Yahoo Finance, sem chave) todo dia às 21:30 de Brasília e grava no banco. Ela entra no Supabase como um **usuário "robô"** comum, sem usar chave secreta.

1. Supabase → **Authentication → Users → Add user**: e-mail `robo@exemplo.com` (qualquer e-mail seu/fictício), senha forte, confirmar e-mail automaticamente.
2. GitHub → repositório → **Settings → Secrets and variables → Actions** e crie 4 secrets: `SUPABASE_URL`, `SUPABASE_CHAVE_PUBLICA` (as mesmas do Passo C da Fase 1), `ROBO_EMAIL`, `ROBO_SENHA`.
3. Aba **Actions → Atualizar cotações → Run workflow**. Deve ficar verde e o log lista cada ativo ("OK PETR4 = ...").
4. Se um ativo falhar (fica vermelho), em geral é o código de busca: edite o ativo na tela Ativos → **Editar → Código para buscar o preço** (ex.: `PETR4.SA`, `AAPL`, `BTC-USD`).

> Não pude testar a fonte de preços daqui (sem acesso à internet externa); por isso o passo 3 é o teste real. A leitura da resposta está coberta por testes. Se o Yahoo bloquear o GitHub, avise: trocamos por outra fonte (ex.: brapi.dev), mexendo só no script.
> Enquanto o primeiro preço não chega, você pode digitar o **Preço atual** ao cadastrar o ativo; até lá o ativo vale pelo preço médio e aparece "sem preço".

## Como usar
- **Ativos → escolha a pessoa → Adicionar ativo:** informe código (PETR4, XPML11, AAPL, BTC), tipo, quantidade e preço médio (na moeda do ativo). O código de busca é preenchido sozinho. Para ajustar uma posição use **Editar**.
- Tipos: Ação, FII, ETF, BDR, Exterior (EUA) e Cripto. Exterior e cripto vêm em US$.
- **Rendimentos → Lançar provento:** pessoa, ativo, mês, tipo, valor líquido. Dólar convertido pelo câmbio do dia do lançamento.
- **Média anual:** total ÷ tempo de histórico (mínimo 12 meses, para não inflar a média no começo).
- Valores em dólar usam a cotação de hoje nas telas de Ativos.


---

# Fase 3 — Favoritos, cotações ao vivo e notícias

A tela **Favoritos** mostra os ativos que você quer acompanhar (tenha ou não na carteira), com preço atualizado a cada minuto, variação do dia, mini-gráfico do último mês e **notícias**. Cada notícia traz uma etiqueta e uma faixa de cor: **Brasil** (verde, imprensa brasileira) ou **Exterior** (roxo, imprensa estrangeira). Dá para filtrar por imprensa e por ativo.

## Passo G — Banco
**SQL Editor → New query**, cole `supabase/04_fase3.sql` e **Run** (cria a tabela `favoritos`).

## Passo H — Publicar o código
Na pasta do projeto (Mac, no Terminal):
```bash
cd ~/Documents/patrimonio-familia
unzip -o ~/Downloads/patrimonio-familia-fase3.zip
git add .
git status --short
git commit -m "Fase 3: favoritos, cotações ao vivo e notícias"
git push
```
(No Windows: `Expand-Archive -Path "$HOME\Downloads\patrimonio-familia-fase3.zip" -DestinationPath "." -Force`.)

A Netlify publica o site **e duas funções** novas (`cotacao` e `noticias`, em `netlify/functions`). Elas consultam o Yahoo Finanças e o Google Notícias, porque o navegador não pode consultar esses sites diretamente. Só respondem a quem está logado no app. Não há chave nem custo extra.

Confira na Netlify: **Logs → Functions** deve listar `cotacao` e `noticias`. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` que você já criou também são usadas por elas para validar o login.

## Como usar
- **Favoritos → Adicionar favorito:** escolha um ativo que já existe ou **＋ Novo ativo** (ex.: WEGE3, MSFT, ETH). O código de busca é preenchido sozinho e pode ser corrigido.
- Os favoritos também entram na atualização noturna de preços (Fase 2).
- Se a busca ao vivo falhar, a linha mostra o último preço salvo, com a data.
- Cotações da B3 no Yahoo podem ter atraso de cerca de 15 minutos.

## Limites conhecidos
- Não pude testar as fontes de preço e de notícias daqui (sem internet externa); a leitura das respostas é coberta por testes, mas a primeira execução real é a sua. Se as notícias não aparecerem, me envie a mensagem que a tela mostrar.
- Google Notícias e Yahoo são fontes gratuitas sem garantia; podem mudar ou limitar. O app avisa quando falham, e o resto continua funcionando.


---

# Fase 4 — Metas

A tela **Metas** acompanha dois tipos de meta:
- **Patrimônio:** um valor-alvo (em R$ ou US$) para a Família ou para uma pessoa, com prazo opcional.
- **Ativo:** uma quantidade de cotas (ex.: 500 de XPML11) ou um valor em dinheiro para um ativo, da Família ou de uma pessoa (a Filha também pode ter meta de ativo), com prazo opcional.

Cada meta mostra a barra de progresso, quanto já tem, quanto falta, o prazo, **quanto precisa avançar por mês para chegar no prazo** e a situação: atingida, no ritmo, atrasada, acompanhando ou sem prazo. Nas metas de patrimônio há também a **previsão de quando você chega lá**, mantendo o ritmo dos últimos 6 meses.

## Passo I — Banco
**SQL Editor → New query**, cole `supabase/05_fase4.sql` e **Run** (cria a tabela `metas`).

## Passo J — Publicar o código
No Terminal do Mac:
```bash
cd ~/Documents/patrimonio-familia
unzip -o ~/Downloads/patrimonio-familia-fase4.zip
git add .
git status --short
git commit -m "Fase 4: metas"
git push
```
(Windows: `Expand-Archive -Path "$HOME\Downloads\patrimonio-familia-fase4.zip" -DestinationPath "." -Force`.)

## Como as contas funcionam
- Patrimônio da meta = o mesmo total da tela Patrimônio (saldos lançados). A carteira de Ativos não é somada de novo, para não contar em dobro.
- Ritmo = média de crescimento mensal nos últimos 6 meses de saldos. Se você incluir uma pessoa ou conta nova nos saldos, o patrimônio "pula" e o ritmo fica otimista por um tempo. Trate a previsão como uma estimativa.
- Previsões acima de 50 anos aparecem como "sem previsão". Metas de ativo ainda não têm previsão, só o quanto precisa por mês.
- Valores em dólar usam a cotação de hoje.
