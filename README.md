# Madu Brand — código-fonte

## Antes de publicar

**Este pacote remove arquivos de ambiente, caches, relatórios de testes e metadados internos da plataforma de desenvolvimento.** Isso não equivale a uma auditoria de segurança certificada. Revise e teste antes de usar com dados reais.

### Segredos expostos no pacote original
O arquivo original continha uma chave de API, credenciais de administrador, telefone e e-mail em arquivos `.env`, testes e documentação. Considere esses valores comprometidos: **revogue/rotacione a chave de API e altere a senha de administrador antes de qualquer publicação**. Se o código já foi enviado a um repositório, remover o arquivo não apaga o histórico Git; rotacione os segredos e avalie limpar o histórico.

### Configuração local
1. Copie `backend/.env.example` para `backend/.env` e preencha os valores reais.
2. Copie `frontend/.env.example` para `frontend/.env` e ajuste `REACT_APP_BACKEND_URL`.
3. Nunca comite arquivos `.env`. Configure as mesmas variáveis na plataforma de hospedagem.
4. Em produção, use MongoDB gerenciado com autenticação, TLS e acesso de rede restrito; não use `localhost` para banco remoto.
5. Defina `CORS_ORIGINS` apenas para os domínios reais do frontend, sem `*`.

### Testes
Os testes de integração agora exigem `TEST_ADMIN_PHONE` e `TEST_ADMIN_PASSWORD` e usam `TEST_BASE_URL` (padrão `http://127.0.0.1:8000`) para evitar atingir acidentalmente um site real. Execute-os somente contra um ambiente de teste com dados descartáveis.

### Pontos que ainda exigem correção/validação antes de produção
- Revisar autorização por função: atualmente as rotas administrativas aceitam qualquer usuário autenticado; implemente uma verificação explícita de `role == admin` em todas as rotas de gestão.
- O caminho `/painel-mb` é apenas uma rota de interface, não um mecanismo de segurança.
- O token JWT fica em `localStorage`, o que aumenta o impacto de uma eventual vulnerabilidade XSS; considere cookies `HttpOnly`, `Secure` e `SameSite` com proteção CSRF adequada.
- Revisar rate limiting de login por IP atrás de proxy e criar expiração/limpeza dos registros de tentativas.
- Validar upload pelo conteúdo real do arquivo (não apenas `Content-Type`), limites e processamento seguro de imagens.
- Revisar atomicidade das operações de vendas/estoque e idempotência para evitar divergências em falhas simultâneas.
- Fixar versões de dependências, executar auditorias de dependências e testes em ambiente de homologação.
- Confirmar que logs e respostas de erro não revelam dados internos.

## Estrutura
- `frontend/`: React
- `backend/`: FastAPI e MongoDB


## Modo independente de serviços Emergent (alteração desta versão)

- Upload de fotos usa GridFS no MongoDB configurado em `MONGO_URL`; não usa armazenamento Emergent nem disco temporário do servidor.
- Assistente usa regras locais em Python e dados reais do estoque para responder a perguntas comuns; não usa chave de IA externa. Respostas são limitadas às intenções implementadas.
- Removidas as dependências de build e os scripts de rastreamento da Emergent do frontend.
- O assistente mantém o formato de resposta em streaming esperado pelo frontend, mas gera respostas por regras locais sem API externa.
- Fotos ocupam o espaço do cluster MongoDB; acompanhe os limites do plano escolhido.
- Antes de produção, rode testes de upload/consulta com MongoDB de teste, confira permissões administrativas, configure variáveis secretas e revise segurança.
