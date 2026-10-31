# Frontend da Madu Brand

Aplicação React responsável pela vitrine pública e pelo painel administrativo da Madu Brand.

## Responsabilidades

- Exibir o catálogo público sem exigir login.
- Organizar as peças por categoria.
- Mostrar fotos responsivas em cards e no modal de detalhes.
- Permitir navegação circular entre as fotos de uma peça.
- Exibir preço normal, preço promocional e a indicação de 5% para Pix, dinheiro ou débito.
- Abrir o WhatsApp com os dados da seleção da cliente.
- Oferecer o painel administrativo em `/painel-mb`, carregado sob demanda.

A vitrine é somente para visualização. O frontend não possui checkout nem processa pagamentos. A compra é negociada e finalizada diretamente pelo WhatsApp.

## Desenvolvimento local

Na pasta `frontend`:

```bash
npm install
cp .env.example .env
npm start
```

Configure em `.env` a URL do backend, sem acrescentar `/api` ao final:

```env
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
```

A aplicação fica disponível em `http://localhost:3000`.

## Scripts

```bash
npm start                         # servidor de desenvolvimento
npm test -- --watchAll=false     # testes sem modo interativo
npm run build                     # build de produção em build/
```

## Organização do código

- `src/pages/Storefront.js`: página pública do catálogo.
- `src/components/store/`: cards, navegação, footer e modal/carrossel de produtos.
- `src/pages/Login.js`: login administrativo.
- `src/pages/Dashboard.js`: painel administrativo.
- `src/components/ClothingForm.js`: cadastro e edição de peças.
- `src/components/Inventory.js`: estoque e catálogo interno.
- `src/components/Sales.js` e `src/components/SaleForm.js`: vendas internas.
- `src/components/Finance.js`: indicadores financeiros.
- `src/components/Assistant.js`: assistente baseado nas regras disponíveis no backend.
- `src/lib/catalog.js`: cache curto do catálogo, preços, categorias e URLs de imagem.
- `src/lib/api.js`: cliente HTTP do backend.

## Decisões de performance

- Login e Dashboard usam code splitting e não entram no carregamento inicial da vitrine.
- O catálogo pode ser exibido rapidamente a partir de cache curto no `localStorage`.
- Fotos usam `srcset`, `sizes`, variantes WebP e carregamento prioritário da primeira foto do modal.
- Fotos seguintes são pré-carregadas de maneira controlada.
- Falhas temporárias de imagem possuem retentativas progressivas e fallback.

Para a documentação completa do produto, arquitetura, deploy, limitações e dificuldades encontradas, consulte o [README principal](../README.md).
