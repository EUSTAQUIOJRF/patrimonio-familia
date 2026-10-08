# Patrimônio Família — Fase 0

Web-app (PWA) para acompanhar o patrimônio da família. Esta é a **Fase 0**: a fundação.

**O que já funciona:** login com e-mail e senha, recuperação de senha por e-mail, verificação em duas etapas (opcional, mas recomendada), menu, botão **R$ ↔ US$**, **modo privacidade** (esconde os valores) e instalação no celular (PWA).
**O que ainda não existe:** as telas reais de patrimônio (Fase 1) e as demais. O número que aparece na tela inicial é só um exemplo fictício.

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

Entre no app → menu **Segurança → Ativar**. Leia o QR code com Google Authenticator, Microsoft Authenticator ou Authy e confirme com o código de 6 dígitos. Faça isso nas duas contas.

## Passo 9 — Instalar no celular

- **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
- **iPhone (Safari):** botão de compartilhar → *Adicionar à Tela de Início*.

---

## Testes rápidos depois de publicar

- [ ] Entrar com e-mail e senha.
- [ ] "Esqueci minha senha" → e-mail chega → link abre o app na tela de nova senha.
- [ ] Botão **R$ → US$** troca o valor grande e o pequeno.
- [ ] Botão **Oculto/Visível** esconde os valores e continua assim ao recarregar.
- [ ] Segurança → ativar 2 etapas → sair → entrar de novo pedindo o código.

## Observações importantes

- **E-mails de recuperação:** o envio padrão do Supabase tem limite baixo por hora e pode cair em spam. Para duas pessoas costuma bastar. Se incomodar, dá para configurar um SMTP próprio depois.
- **Plano gratuito do Supabase:** pode pausar projetos sem uso por vários dias. Na Fase 1 vamos incluir uma rotina que mantém o projeto ativo e outra de backup.
- **Privacidade:** o modo "Oculto" só esconde os valores na tela. A proteção dos dados em si vem do login, das regras de acesso (RLS) e da verificação em duas etapas.

## Estrutura

```
supabase/01_schema_fase1.sql   tabelas e regras de segurança
src/contexts/                  login (AuthContext) e preferências (privacidade, moeda)
src/pages/                     telas
src/components/                menu, valores, moldura de login
netlify.toml                   configuração de publicação
```
