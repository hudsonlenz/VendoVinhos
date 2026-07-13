# Carta de Vinhos — Catálogo Online

Site estático para exibir o catálogo de vinhos publicamente, com uma área
restrita para 3 funcionários marcarem vendas e atualizarem o estoque em
tempo real.

- **Catálogo**: público, qualquer visitante pode ver.
- **Marcar vendas / editar estoque**: só quem fizer login (3 contas).
- **Backend**: Supabase (Postgres + Auth + Realtime).
- **Hospedagem**: GitHub Pages (grátis).

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (grátis).
2. Clique em **New project**. Anote a senha do banco que você definir.
3. Espere o projeto terminar de provisionar (~2 minutos).

## 2. Rodar o schema do banco

1. No painel do Supabase, vá em **SQL Editor** > **New query**.
2. Abra o arquivo `supabase-setup.sql` deste projeto, copie todo o conteúdo
   e cole no editor.
3. Clique em **Run**. Isso cria as tabelas `wines` e `sales`, as políticas
   de segurança (RLS) e já popula o catálogo com os 21 vinhos do PDF.

## 3. Criar os 3 usuários da equipe

1. No painel do Supabase, vá em **Authentication > Users**.
2. Clique em **Add user** > **Create new user**.
3. Cadastre um e-mail e senha para cada um dos 3 funcionários
   (ex: `maria@carteldevinhos.com`, `joao@...`, `ana@...`).
4. Marque a opção para já confirmar o e-mail automaticamente (ou desative
   a confirmação por e-mail em **Authentication > Providers > Email**,
   já que são contas internas, não precisa de verificação).

Esses são os logins que serão usados no botão **"Área da equipe"** do site.

## 4. Pegar a URL e a chave da API

1. Vá em **Project Settings > API**.
2. Copie o **Project URL** e a **anon public key**.
3. Abra o arquivo `config.js` deste projeto e cole os dois valores:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

A `anon key` é segura para expor no front-end: o controle de acesso real
está nas políticas RLS que o script SQL já configurou (leitura pública,
escrita só para quem estiver logado).

## 5. Subir para o GitHub

```bash
cd wine-catalog
git init
git add .
git commit -m "Catálogo de vinhos inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/carta-de-vinhos.git
git push -u origin main
```

## 6. Ativar o GitHub Pages

1. No repositório no GitHub, vá em **Settings > Pages**.
2. Em **Source**, selecione a branch `main` e a pasta `/ (root)`.
3. Salve. Em ~1 minuto o site estará no ar em:
   `https://SEU_USUARIO.github.io/carta-de-vinhos/`

---

## Como usar no dia a dia

- **Clientes/visitantes**: acessam o link e veem o catálogo com busca e
  filtro por categoria (Malbec, Cabernet, Blend, etc). Vinhos esgotados
  aparecem com um carimbo "Esgotado".
- **Equipe**: clica em **"Área da equipe"**, entra com e-mail e senha, e
  passa a ver o botão **"Marcar venda"** em cada vinho, informando a
  quantidade vendida. O estoque é descontado na hora e sincroniza
  automaticamente para os outros 2 usuários (graças ao Realtime do
  Supabase) — sem precisar dar F5.
- Toda venda fica registrada na tabela `sales` (quem vendeu, o quê e
  quando), útil para conferência depois. Você pode consultar isso a
  qualquer momento em **Table Editor > sales** no painel do Supabase.

## Editar o catálogo depois

Para adicionar, remover ou editar vinhos (preço, descrição, foto, estoque
inicial), use o **Table Editor > wines** no painel do Supabase — não
precisa mexer no código nem fazer novo deploy.

Para adicionar fotos das garrafas: suba as imagens em algum lugar público
(ex: um bucket do próprio Supabase Storage, ou o repositório do GitHub em
uma pasta `/images`) e cole o link na coluna `image_url` da linha do
vinho correspondente.

## Estrutura dos arquivos

```
wine-catalog/
├── index.html          # estrutura da página
├── style.css           # visual (tema carta de vinhos, preto e branco + bordô)
├── app.js              # lógica: carrega vinhos, login, registra vendas
├── config.js           # suas credenciais do Supabase (preencher)
└── supabase-setup.sql  # schema do banco + seed com os 21 vinhos
```
