# Madu Brand - PRD

## Original problem statement
Preciso de um aplicativo para gerenciamento da minha loja, chamada Madu Brand na qual quero login: quero que seja por telefone o login <REMOVED_PHONE> e senha:<REMOVED_SECRET> para gerenciar, quero funções para adicionar roupas, o nome, tamanho, valor, cor, e deixe tudo editável, e quero também uma janela para controle financeiro na qual faça uma média, de quanto eu paguei em cada peça e quanto eu vou vender, na qual me dá o quanto eu lucraria.

Choices: custo pago + quantidade em estoque; financeiro com totais/médias + lucro por peça; elegante minimalista, marrom claro e escuro mesclados, brancos não tão claros.

## Architecture
- FastAPI + MongoDB (users, clothes, login_attempts); JWT Bearer (localStorage), admin seeded from .env (phone/password)
- React: Login, Dashboard (tabs Catálogo / Financeiro), ClothingForm (sheet), Inventory, Finance

## User personas
- Dona da loja (único admin)

## Implemented (2026-10-12)
- Login por telefone + senha, brute force lockout
- CRUD de roupas: nome, tamanho, cor, custo, preço, quantidade; busca
- Controle financeiro: total investido, faturamento esperado, lucro projetado, margem, médias por peça (ponderadas pela quantidade), tabela de lucro por peça
- Tested: backend 9/9, frontend full flow

## Implemented (2026-10-12) - Gemini Assistant
- "Assistente" tab: AI chat (gemini-3.1-pro-preview, Emergent Universal Key, SSE streaming) answering about stock, costs, profit using live store data; history persisted per user in assistant_messages; clear button
- Tested: backend 6/6, frontend full flow

## Implemented (2026-10-12) - Vendas
- "Vendas" tab: register venda or condicional (piece, qty, price, client), payment Pix / Crédito 1-3x (2x/3x +5%) / Crediário with due date, paid flag; stock auto-adjusts
- Condicional: mark paid, "Ficou com a peça" (-> vendida), "Devolveu" (stock back); delete restores stock
- Catalog badges: green available qty, red sem estoque, yellow em condicional
- Monthly summary: real profit, revenue, cost, received, pending, open conditionals
- Tested: backend 17/17, frontend full flow

## Implemented (2026-10-12) - Public storefront
- Public site at "/" (no login): hero, navbar Todos/Bodies/Croppeds/Vestidos/Saias/Calças, product grid; variants grouped by name+category; product dialog with color/size/qty and "Comprar pelo WhatsApp" (wa.me/55<REMOVED_PHONE> with piece, cor, tamanho, qtd, valor, descrição)
- Admin moved to hidden /painel-mb (login /painel-mb/login), no link from public site
- Admin clothing form: category, description, photo uploads (Emergent object storage, /api/uploads, public /api/public/images/{id})
- Tested: backend 8/8, frontend full flow

## Implemented (2026-10-12) - Storefront tweaks
- Removed dark brown hero; simple big title "Catálogo Madu Brand"
- Footer: Instagram link (https://www.instagram.com/madu_braand?mdxt=MWQxZ2pyeTh2c2lncQ==) + discreet "Admin" link to /painel-mb/login

## Backlog
- P1: Registro de vendas realizadas (baixa no estoque, lucro real)
- P2: Fotos das peças, categorias, alerta de estoque baixo
