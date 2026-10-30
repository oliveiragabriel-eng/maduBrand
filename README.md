# Madu Brand

Catálogo digital e painel interno de gestão para a Madu Brand, uma loja de moda feminina.

> **Importante:** a vitrine pública é destinada à visualização dos produtos. Ela não é um checkout e não processa pagamentos, pedidos ou entregas. Quando a cliente escolhe uma peça, a conversa é aberta no WhatsApp com os dados da seleção. A negociação e a finalização da compra acontecem fora do sistema, pelo WhatsApp da loja.

## Objetivo do projeto

O projeto foi criado para apresentar as peças da Madu Brand de forma elegante, rápida e adaptada a celulares, mantendo o processo comercial simples: a cliente consulta o catálogo, escolhe a peça, cor, tamanho e quantidade, e entra em contato pelo WhatsApp.

Além da vitrine pública, existe um painel administrativo protegido por login para organizar o catálogo, acompanhar estoque, consultar dados financeiros e registrar vendas internas. O painel não transforma a vitrine em uma loja virtual com pagamento automático; ele serve para a gestão da loja.

## Como funciona para a cliente

1. A cliente acessa a página inicial sem fazer login.
2. Visualiza as peças por categoria: Bodies, Croppeds, Vestidos, Saias e Calças.
3. Abre os detalhes de uma peça e navega entre as fotos pelo carrossel.
4. Escolhe cor, tamanho e quantidade disponíveis.
5. Visualiza o preço normal, o valor promocional quando cadastrado e a indicação de 5% de desconto para Pix, dinheiro ou débito.
6. Clica em **Comprar pelo WhatsApp**.
7. O sistema abre uma conversa no WhatsApp com o nome da peça, categoria, cor, tamanho, quantidade, valor e descrição. A equipe da Madu Brand confirma disponibilidade, pagamento, entrega e demais condições diretamente com a cliente.

O catálogo não confirma estoque em tempo real durante a conversa, não cobra a cliente e não registra automaticamente um pedido originado pelo botão do WhatsApp.

## Funcionalidades do painel administrativo

O painel fica separado da vitrine pública em `/painel-mb` e inclui:

- login por telefone e senha;
- cadastro, edição, busca e exclusão de peças;
- categoria, descrição, tamanho, cor, custo, preço, valor promocional e quantidade;
- upload de várias fotos por peça;
- controle de estoque;
- indicadores financeiros, incluindo investimento, faturamento esperado, lucro projetado, margem e médias;
- registro interno de vendas e vendas condicionais, com atualização de estoque;
- resumo mensal de vendas, recebimentos, pendências e condicionais;
- assistente baseado em regras locais para consultar informações do estoque e da gestão;
- saída do painel com retorno para a Home.

As vendas registradas no painel são operações internas de controle da loja. Elas são independentes do botão público de compra pelo WhatsApp.

## Arquitetura

O projeto é dividido em duas aplicações:

```text
maduBrand/
├── frontend/                 # React, Tailwind CSS e componentes da vitrine/painel
│   ├── public/               # assets estáticos, como imagens usadas no login
│   └── src/
│       ├── components/store/ # cards, navegação e modal/carrossel da vitrine
│       ├── components/       # formulários, estoque, vendas, finanças e assistente
│       ├── pages/            # Storefront, Login e Dashboard
│       └── lib/              # API, catálogo, preços e URLs de imagens
├── backend/                  # FastAPI, autenticação, catálogo e regras de negócio
│   ├── server.py
│   ├── scripts/              # scripts de manutenção, incluindo variantes WebP
│   └── tests/                # testes da API, vendas, vitrine e assistente
└── .github/workflows/        # automações de monitoramento
```

### Frontend

O frontend usa React com Create React App/CRACO, Tailwind CSS, React Router e Lucide Icons. A vitrine é a rota `/`. As telas administrativas são carregadas sob demanda para não aumentar o carregamento inicial da vitrine.

O catálogo público usa cache curto no `localStorage`, atualiza os dados em segundo plano e possui tratamento para falhas temporárias de imagens. O modal de produto usa imagens responsivas, carrossel circular, miniaturas e pré-carregamento controlado das fotos seguintes.

### Backend

O backend usa FastAPI, Motor/PyMongo e MongoDB Atlas. Ele fornece:

- autenticação e sessão administrativa;
- CRUD de peças e variantes;
- catálogo público agrupado por nome e categoria;
- rota leve `/health` para monitoramento;
- upload e entrega de imagens pelo GridFS;
- preços promocionais e validações de estoque;
- registros de vendas, condicionais, finanças e assistente local.

### Banco e imagens

As imagens originais ficam no GridFS do MongoDB no bucket `product_images`. Elas não são substituídas durante a otimização.

Para reduzir o processamento durante o primeiro acesso, foram geradas variantes WebP no bucket `product_image_variants` nos tamanhos de 480, 800 e 1200 pixels. A aplicação escolhe uma versão responsiva de acordo com o espaço disponível na tela e envia cabeçalhos de cache de longa duração para arquivos imutáveis.

A migração realizada processou 42 imagens originais e criou 126 variantes WebP. Essa operação não alterou os arquivos originais.

## Tecnologias

- **Frontend:** React, React Router, Tailwind CSS, CRACO, Axios e Lucide React.
- **Backend:** Python, FastAPI, Motor/PyMongo, Pydantic, Pillow e JWT.
- **Banco de dados:** MongoDB Atlas com GridFS para as imagens.
- **Hospedagem:** frontend publicado na Vercel e backend hospedado no Render.
- **Monitoramento:** rota `/health`, GitHub Actions e monitor externo de disponibilidade.
- **Contato comercial:** WhatsApp, aberto pelo frontend com `wa.me`.

## Configuração local

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
pip install -r requirements.txt
cp .env.example .env
```

Preencha o arquivo `backend/.env` com valores locais e seguros. As variáveis principais são:

```env
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=madu_brand
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=um-segredo-aleatorio-forte
ADMIN_PHONE=seu-telefone
ADMIN_PASSWORD=uma-senha-forte
ADMIN_EMAIL=seu-email
```

Inicie a API:

```bash
uvicorn server:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Configure a URL do backend em `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
```

Inicie o frontend:

```bash
npm start
```

A vitrine ficará disponível em `http://localhost:3000` e o painel em `http://localhost:3000/painel-mb/login`.

## Testes e build

No backend, execute os testes a partir da pasta `backend`:

```bash
pytest
```

Os testes que usam login devem receber credenciais de teste por variáveis de ambiente e apontar para uma base descartável. Não execute testes destrutivos contra o banco de produção.

No frontend:

```bash
npm test -- --watchAll=false --passWithNoTests
npm run build
```

O build gera os arquivos de produção na pasta `frontend/build`.

## Deploy e operação

O fluxo esperado é:

1. desenvolver em uma branch separada;
2. testar frontend e backend localmente;
3. abrir Pull Request para `main`;
4. revisar o diff e os checks;
5. mesclar somente depois da validação;
6. deixar a integração do GitHub iniciar o deploy da Vercel e do Render, conforme a configuração dos serviços;
7. verificar a Home, o catálogo, o modal de fotos, o botão do WhatsApp, o login administrativo e a rota `/health`.

Não coloque segredos no repositório. Os arquivos `.env` são ignorados pelo Git. As credenciais devem ser configuradas diretamente nas variáveis seguras da plataforma de hospedagem.

## Dificuldades encontradas e soluções adotadas

### Cold start do Render

O plano gratuito do Render pode suspender o backend após um período sem acesso. Quando isso acontece, a primeira requisição precisa acordar o serviço, o que aumenta o tempo de carregamento tanto da vitrine quanto do painel administrativo.

Foram adicionados uma rota `/health`, monitoramento periódico, retentativas no frontend e cache local do catálogo. Essas medidas reduzem o impacto, mas não eliminam completamente o tempo de despertar de um serviço gratuito.

### Fotos que falhavam principalmente no celular

Durante o despertar do backend, algumas imagens retornavam erros temporários, inclusive 502. O frontend passou a tentar novamente as imagens com intervalos progressivos e fallback para o original. Também foram usadas versões responsivas e carregamento prioritário para a primeira foto aberta no modal.

### Processamento pesado de imagens antigas

As imagens antigas ainda precisavam ser redimensionadas pelo Render na primeira solicitação. Isso sobrecarregava o backend e podia gerar novos erros. A solução foi criar previamente as variantes WebP no MongoDB, preservando os arquivos originais.

### Carrossel e carregamento das fotos seguintes

O modal precisava permitir navegação circular sem deixar a segunda foto sempre para carregar somente depois do clique. O carrossel passou a pré-carregar as fotos seguintes de forma controlada, limitando a concorrência para não competir com a imagem principal nem com a vitrine.

### Primeira visita e visitas recorrentes

Para visitas recorrentes, o catálogo é lido primeiro do `localStorage` por um período curto e atualizado em segundo plano. Para novos dispositivos, foram reduzidos o tamanho das imagens solicitadas e usados `srcset`/`sizes`. A prioridade alta da primeira imagem do modal está sendo avaliada em uma branch separada antes de ser incorporada à `main`.

### Separação entre catálogo e administração

O painel administrativo não deve aumentar o bundle inicial da vitrine. Login e Dashboard são carregados sob demanda. O botão de saída remove a sessão local e leva a pessoa de volta para a Home.

## Limitações conhecidas

- O WhatsApp é o canal de fechamento da compra; não existe checkout, pagamento ou pedido automático no catálogo.
- O tempo de despertar do Render pode continuar perceptível no primeiro acesso após suspensão.
- As imagens passam pelo backend/GridFS; uma camada dedicada de armazenamento e CDN poderia reduzir ainda mais a latência, mas exigiria migração de infraestrutura.
- O caminho `/painel-mb` ajuda a separar a interface, mas não substitui autenticação e autorização no backend.
- Antes de uma operação comercial maior, recomenda-se revisar autorização por função, rate limiting de login, cookies HttpOnly, validação real dos arquivos enviados e atomicidade das operações de estoque.

## Segurança

- Nunca comite `.env`, senhas, tokens ou strings de conexão.
- Se uma credencial for exposta, revogue-a e gere outra imediatamente; remover o arquivo não apaga o histórico Git.
- Restrinja `CORS_ORIGINS` aos domínios reais.
- Use MongoDB com autenticação, TLS e lista de IPs controlada.
- Mantenha as variáveis de produção somente na Vercel, Render ou MongoDB Atlas.

## Estado do projeto

A `main` contém a vitrine pública, o painel administrativo, o carrossel de fotos, preços promocionais, indicação de desconto para Pix/dinheiro/débito, variantes WebP pré-geradas, cache e as correções de carregamento já incorporadas ao projeto. Melhorias experimentais de prioridade da primeira foto devem ser revisadas na branch correspondente antes de um novo merge.
