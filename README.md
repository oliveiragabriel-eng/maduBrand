# Madu Brand

Site de uma loja de moda feminina com duas partes: uma vitrine pública, onde a cliente vê as peças, e um painel interno para a dona da loja cuidar de estoque, vendas e finanças.

Online em https://madu-brand.vercel.app

![Vitrine da Madu Brand](./docs/vitrine.png)

## Como a compra funciona

Não tem checkout. A vitrine mostra o catálogo e a venda acontece no WhatsApp.

A cliente entra sem login, filtra por categoria (Bodies, Croppeds, Vestidos, Saias e Calças), abre a peça, passa pelas fotos, escolhe cor, tamanho e quantidade e clica em **Comprar pelo WhatsApp**. O botão abre a conversa já com nome da peça, categoria, cor, tamanho, quantidade, valor e descrição. Pagamento, entrega e disponibilidade são combinados ali, com a loja.

Os preços aparecem em duas versões: o normal (ou promocional, quando existe) e o valor com 5% de desconto para Pix, dinheiro ou débito.

## Painel administrativo

Fica em `/painel-mb`, sem link visível na vitrine, com login por telefone e senha. Dentro dele dá para:

- cadastrar, editar, buscar e excluir peças (categoria, descrição, cor, tamanho, custo, preço, preço promocional, quantidade e várias fotos);
- acompanhar o estoque;
- ver os números da loja: investimento, faturamento esperado, lucro projetado, margem e médias por peça;
- registrar vendas e vendas condicionais, com baixa automática no estoque;
- ver o resumo do mês: o que entrou, o que está pendente e quantas condicionais estão abertas;
- perguntar ao assistente sobre estoque e finanças. Ele responde com regras e cálculos feitos no próprio backend, sem API de IA externa.

As vendas do painel são controle interno e não têm relação com o botão do WhatsApp da vitrine.

## Tecnologias

| Parte | O que usei |
|---|---|
| Frontend | React 19, React Router, Tailwind CSS, componentes Radix/shadcn, Axios, CRACO |
| Backend | Python, FastAPI, Motor/PyMongo, Pydantic, JWT, Pillow |
| Banco | MongoDB Atlas, com GridFS para as fotos |
| Hospedagem | Vercel (frontend) e Render (backend) |
| Monitoramento | rota `/health` + GitHub Actions |

## Estrutura

```text
maduBrand/
├── frontend/
│   ├── public/
│   └── src/
│       ├── pages/        # Storefront, Login, Dashboard
│       ├── components/   # formulários, estoque, vendas, finanças, assistente
│       │   └── store/    # cards, navegação e modal com carrossel da vitrine
│       └── lib/          # cliente da API, catálogo, preços e URLs de imagem
├── backend/
│   ├── server.py         # API inteira
│   ├── scripts/          # geração das variantes WebP
│   └── tests/
└── .github/workflows/    # ping periódico no backend
```

## Rodando na sua máquina

Precisa de Node, Python 3 e um MongoDB (local ou Atlas).

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --port 8000
```

Antes de subir, preencha o `.env`:

```env
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=madu_brand
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=<segredo aleatório com pelo menos 32 bytes>
ADMIN_PHONE=<só números>
ADMIN_PASSWORD=<senha forte>
ADMIN_EMAIL=<seu e-mail>
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env
npm start
```

No `frontend/.env`, `REACT_APP_BACKEND_URL` aponta para o backend sem `/api` no final (`http://127.0.0.1:8000`).

A vitrine abre em `http://localhost:3000` e o painel em `http://localhost:3000/painel-mb/login`.

## Testes

Os testes do backend fazem requisições reais a uma API já rodando, então precisam de um banco descartável e de credenciais de teste:

```bash
cd backend
export TEST_BASE_URL=http://127.0.0.1:8000
export TEST_ADMIN_PHONE=<telefone do admin local>
export TEST_ADMIN_PASSWORD=<senha do admin local>
pytest
```

Não rode contra o banco de produção, porque os testes criam e apagam dados.

No frontend:

```bash
npm test -- --watchAll=false --passWithNoTests
npm run build
```

## Problemas que apareceram

**Backend dormindo.** O plano gratuito do Render suspende o serviço depois de um tempo parado, e a primeira visita sofre com isso. Adicionei a rota `/health`, um workflow do GitHub Actions que bate nela a cada 10 minutos, retentativas no frontend e cache do catálogo. Melhorou bastante, mas o primeiro acesso depois de uma suspensão longa ainda pode demorar.

**Fotos quebrando no celular.** Enquanto o backend acordava, algumas imagens voltavam com erro 502. O frontend agora tenta de novo com intervalo crescente e cai para a imagem original se precisar.

**Redimensionamento no primeiro acesso.** As fotos antigas eram redimensionadas pelo backend na hora em que alguém pedia, e isso derrubava o servidor pequeno. Gerei as variantes antes, em WebP (480, 800 e 1200 px), com um script em `backend/scripts/`. Foram 42 originais e 126 variantes, e os originais continuam intactos no GridFS.

**Carrossel.** O modal precisava de navegação circular sem deixar a segunda foto só começar a carregar depois do clique. As próximas fotos são pré-carregadas, com limite de downloads simultâneos para não atrapalhar a foto principal.

**Peso da vitrine.** Login e Dashboard são carregados só quando alguém entra no painel (code splitting), então a vitrine não paga por isso. O catálogo fica guardado no `localStorage` por 10 minutos e é atualizado em segundo plano.

## Limitações

- Sem pagamento nem pedido automático: o fechamento é sempre pelo WhatsApp.
- As fotos passam pelo backend. Um armazenamento dedicado com CDN seria mais rápido, mas exigiria migrar a infraestrutura.
- O caminho `/painel-mb` só esconde o painel. A proteção de verdade é o login e a autorização no backend.
- Antes de crescer, falta revisar permissões por perfil, limite de tentativas de login mais robusto, cookies HttpOnly no lugar do token no `localStorage`, validação real dos arquivos enviados e operações de estoque atômicas.

## Segurança

O `.env` está no `.gitignore` e as credenciais de produção ficam só nas variáveis da Vercel, do Render e do Atlas. Se algum segredo vazar, revogue e troque na hora: apagar o arquivo não limpa o histórico do Git.

## Licença

Todos os direitos reservados. Ninguém pode copiar, modificar, distribuir ou usar o projeto sem autorização do autor. Detalhes no arquivo [LICENSE](./LICENSE).

## Autor

Gabriel de Souza Oliveira
