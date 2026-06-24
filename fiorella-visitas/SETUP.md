# 🌸 Fiorella Visitas — Guia de Configuração Completo

> Siga **cada etapa na ordem**. Leva cerca de 20 minutos no total.

---

## ETAPA 1 — Criar a Planilha Google Sheets

1. Acesse [sheets.google.com](https://sheets.google.com) e clique em **"+ Em branco"**
2. Dê o nome: **Fiorella Visitas**
3. Copie o **ID** da planilha — é a parte da URL entre `/d/` e `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/  <<ESTE_TRECHO_AQUI>>  /edit
   ```
4. Guarde este ID, você vai precisar na próxima etapa.

---

## ETAPA 2 — Criar o Apps Script (backend gratuito)

1. Acesse [script.google.com](https://script.google.com) e clique em **"Novo projeto"**
2. Dê o nome: **Fiorella Visitas API**
3. Apague todo o código que aparece no editor
4. Abra o arquivo `apps-script/Code.gs` desta pasta e **cole todo o conteúdo** no editor
5. Na linha 7, substitua `COLE_O_ID_DA_SUA_PLANILHA_AQUI` pelo ID que você copiou no passo anterior:
   ```javascript
   const SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'; // exemplo
   ```
6. Clique em **💾 Salvar** (ou Ctrl+S)

---

## ETAPA 3 — Publicar o Apps Script como Web App

1. No Apps Script, clique em **"Implantar"** → **"Nova implantação"**
2. Clique no ícone de engrenagem ⚙️ ao lado de "Tipo" e selecione **"App da Web"**
3. Configure assim:
   - **Descrição:** Fiorella API v1
   - **Executar como:** Eu (seu email)
   - **Quem tem acesso:** ⚠️ **Qualquer pessoa** ← muito importante!
4. Clique em **"Implantar"**
5. Autorize o acesso quando solicitado (clique em "Autorizar acesso" → escolha sua conta → "Avançado" → "Ir para Fiorella Visitas API" → "Permitir")
6. Copie a **URL do app da Web** — parece com:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
7. Guarde esta URL.

> ⚠️ **Atenção:** Toda vez que editar o script, você precisa criar uma **nova implantação** (não "Gerenciar implantações"). Só assim as mudanças entram em vigor.

---

## ETAPA 4 — Subir o projeto no GitHub

1. Crie uma conta em [github.com](https://github.com) se ainda não tiver
2. Clique em **"New repository"** → nome: `fiorella-visitas` → **Create repository**
3. Instale o [Git](https://git-scm.com) no seu computador se necessário
4. Abra o terminal na pasta `fiorella-visitas` e execute:
   ```bash
   git init
   git add .
   git commit -m "Fiorella chegou! 🌸"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/fiorella-visitas.git
   git push -u origin main
   ```

---

## ETAPA 5 — Publicar no Vercel (gratuito)

1. Acesse [vercel.com](https://vercel.com) e crie uma conta com seu GitHub
2. Clique em **"Add New Project"**
3. Importe o repositório `fiorella-visitas`
4. Antes de clicar em Deploy, configure as **variáveis de ambiente**:
   - Clique em **"Environment Variables"**
   - Adicione:

   | Nome | Valor |
   |------|-------|
   | `NEXT_PUBLIC_APPS_SCRIPT_URL` | A URL do Apps Script da Etapa 3 |
   | `NEXT_PUBLIC_ADMIN_PIN` | O PIN de 4 dígitos que você quiser (ex: `2507`) |

5. Clique em **"Deploy"**
6. Aguarde 1-2 minutos ☕
7. Seu site estará no ar em: `https://fiorella-visitas.vercel.app`

---

## ETAPA 6 — Configurar o painel admin

1. Acesse `https://fiorella-visitas.vercel.app/admin`
2. Digite o PIN que você definiu
3. Vá em **⚙️ Configurações** e preencha:
   - Mensagem de boas-vindas
   - Horário de início e fim das visitas
   - Seu número de WhatsApp (para receber avisos dos visitantes)
   - Dias da semana bloqueados
4. Clique em **"Salvar configurações"**

---

## ETAPA 7 — Testar tudo

1. Abra `https://fiorella-visitas.vercel.app` em uma aba anônima
2. Escolha uma data e horário
3. Preencha os dados e agende
4. Vá ao painel admin e confirme o agendamento
5. Teste o cancelamento abrindo o link de cancelamento gerado

---

## 🔗 Links importantes

| O quê | Link |
|-------|------|
| Site público (para compartilhar) | `https://fiorella-visitas.vercel.app` |
| Painel admin | `https://fiorella-visitas.vercel.app/admin` |
| Planilha de dados | O Google Sheets que você criou |
| Apps Script | [script.google.com](https://script.google.com) |

---

## ❓ Dúvidas frequentes

**O site não conecta / dá erro de rede**
→ Verifique se a URL do Apps Script está correta no Vercel (Settings → Environment Variables)
→ Certifique-se de que o script foi publicado com acesso para "Qualquer pessoa"

**Alterei algo no Apps Script mas não funcionou**
→ Você precisa criar uma **nova implantação** (não editar a existente)
→ Copie a nova URL e atualize no Vercel

**Quero mudar o PIN**
→ Vá ao Vercel → Settings → Environment Variables → edite `NEXT_PUBLIC_ADMIN_PIN`
→ Faça um novo deploy (ou o Vercel faz automaticamente)

**Os dados sumiram**
→ Os dados estão na planilha Google Sheets — abra e confira as abas `bookings` e `config`

---

Feito com 💕 para a Fiorella
