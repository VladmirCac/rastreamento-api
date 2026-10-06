![Node.js](https://img.shields.io/badge/Node.js-18%2B-3C873A?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

# rastreamento-api

API em Node.js para consultar rastreamentos dos Correios e atualizar registros pendentes no Airtable automaticamente.

## Destaques

- Integracao com a API dos Correios
- Atualizacao automatica de registros no Airtable
- Processamento em lote para reduzir chamadas
- Endpoint protegido por segredo para uso com cron ou automacoes
- Suporte a Docker, Docker Compose e healthcheck

## Sobre o projeto

O fluxo principal da aplicacao e:

1. Gerar um token de autenticacao na API dos Correios.
2. Buscar no Airtable os registros que ainda nao foram entregues.
3. Consultar os codigos de rastreio em lote.
4. Mapear o ultimo evento do objeto para um status legivel.
5. Atualizar os campos correspondentes no Airtable.

## Tecnologias utilizadas

- Node.js
- Express
- Axios
- Dotenv
- Airtable API
- API dos Correios
- Docker

## Estrutura principal

```bash
src/
  config/
    env.js
  controllers/
    rastreio.controller.js
  services/
    airtable.service.js
    correios.service.js
    token.service.js
  utils/
    statusMapper.js
  server.js
```

## Requisitos

- Node.js 18 ou superior
- Docker Desktop ou Docker Engine, se for usar containers
- Conta e credenciais validas da API dos Correios
- Base no Airtable com os campos esperados

## Instalacao

```bash
npm install
```

Depois, gere seu arquivo de ambiente:

```bash
cp .env.example .env
```

No PowerShell, voce tambem pode usar:

```powershell
Copy-Item .env.example .env
```

## Variaveis de ambiente

Use o arquivo `.env.example` como base para criar o seu `.env`:

```env
PORT=3000

CORREIOS_BASE_URL=https://api.correios.com.br
USUARIO_MEUS_CORREIOS=seu_usuario
WS_NOVA_API=sua_senha_ou_token_ws
CONTRATO_CORREIOS=seu_contrato
CORREIOS_DR=30

AIRTABLE_API_KEY=sua_chave_airtable
AIRTABLE_BASE_ID=seu_base_id
AIRTABLE_TABLE=nome_da_tabela

CRON_SECRET=defina_um_segredo_forte

DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario_banco
DB_PASS=sua_senha_banco
DB_NAME=seu_nome_banco

REQUEST_TIMEOUT_MS=20000
CORREIOS_CONCURRENCY=10
TOKEN_EXPIRY_SAFETY_MS=60000
```

## Campos esperados no Airtable

A aplicacao considera principalmente estes campos na tabela:

- `Codigo`
- `Status`
- `Ultimo Evento`
- `Ultima Atualizacao`
- `Data Postagem`
- `Data Entrega`

Os registros buscados seguem a regra:

- `Status != 'Entregue'`
- `Status != 'Devolvido'`
- `Status != 'Cancelado'`
- `Codigo != ''`

## Como executar

Ambiente de desenvolvimento:

```bash
npm run dev
```

Ambiente normal:

```bash
npm start
```

Por padrao, a API sobe na porta `3000`, ou na porta definida em `PORT`.

## Como executar com Docker

### Build manual da imagem

```bash
docker build -t rastreamento-api .
```

O arquivo `Dockerfile` possui `HEALTHCHECK` para monitorar o endpoint `/health`.

### Rodando com `docker run`

```bash
docker run --env-file .env -p 3000:3000 --name rastreamento-api rastreamento-api
```

### Rodando com Docker Compose

```bash
docker compose up --build -d
```

Para conferir se o container ficou saudavel:

```bash
docker compose ps
```

O servico deve aparecer com status `healthy` depois que o endpoint `/health` responder com sucesso.

Para acompanhar os logs:

```bash
docker compose logs -f
```

Para parar o container:

```bash
docker compose down
```

## Endpoints

### `GET /health`

Endpoint de verificacao de saude da aplicacao.

Exemplo de resposta:

```json
{
  "ok": true,
  "service": "rastreamento-api",
  "timestamp": "2026-03-22T12:00:00.000Z"
}
```

### `POST /atualizar-rastreios`

Executa o processo completo de atualizacao dos rastreamentos.

Esse endpoint exige o header:

```http
x-secret: SEU_CRON_SECRET
```

Exemplo com `curl`:

```bash
curl -X POST http://localhost:3000/atualizar-rastreios \
  -H "Content-Type: application/json" \
  -H "x-secret: SEU_CRON_SECRET"
```

Exemplo de resposta:

```json
{
  "sucesso": true,
  "mensagem": "Rastreios processados com sucesso",
  "totalEncontrados": 20,
  "totalAtualizados": 18,
  "totalFalhas": 2,
  "totalLotes": 1,
  "tamanhoLote": 50,
  "duracaoMs": 2480
}
```

## Mapeamento de status

Os eventos retornados pelos Correios sao convertidos para status mais simples no Airtable, como:

- `Postado`
- `Em transito`
- `Saiu para entrega`
- `Entregue`
- `Tentativa de entrega`
- `Retirada`
- `Tributado`
- `Devolvido`
- `Desconhecido`

## Funcionamento em lote

- Os codigos sao consultados em lotes de ate `50` objetos por vez.
- As atualizacoes no Airtable sao enviadas em blocos de ate `10` registros por requisicao.

## Seguranca

Para evitar execucoes indevidas:

- o endpoint `POST /atualizar-rastreios` exige o header `x-secret`
- o valor enviado deve ser igual ao `CRON_SECRET` configurado no ambiente

## Sugestao de uso com automacao

Voce pode acionar essa API com:

- GitHub Actions
- cron job no servidor
- plataformas como Railway, Render ou VPS propria

Um exemplo comum e agendar chamadas periodicas para `POST /atualizar-rastreios`.

## Deploy

Esta API pode ser publicada em qualquer ambiente Node.js ou Docker que permita configurar variaveis de ambiente.

Opcoes comuns:

- Railway
- Render
- VPS com PM2
- Docker
- GitHub Actions chamando uma instancia ja publicada

Passos gerais de deploy:

1. Configure todas as variaveis do `.env.example` no provedor.
2. Defina o comando de inicializacao como `npm start` ou use o `Dockerfile`.
3. Garanta que a porta da aplicacao seja lida por `PORT`.
4. Proteja o endpoint de execucao com um `CRON_SECRET` forte.
5. Aponte sua automacao para `POST /atualizar-rastreios`.

### Deploy com Railway usando Docker

1. Crie um novo projeto no Railway a partir deste repositorio.
2. Garanta que o deploy use o `Dockerfile` da raiz do projeto.
3. Configure no Railway todas as variaveis presentes no `.env.example`.
4. Mantenha a porta dinamica lida por `PORT`, sem fixar outra porta no codigo.
5. Apos o deploy, valide `GET /health` e depois integre sua automacao ao endpoint `POST /atualizar-rastreios`.

### Deploy com Render usando Docker

1. Crie um novo `Web Service` no Render conectado a este repositorio.
2. Escolha a opcao de deploy via `Docker`.
3. Informe as variaveis de ambiente do `.env.example` no painel do servico.
4. Deixe o Render expor a porta informada por `PORT`.
5. Depois do primeiro deploy, confira o endpoint `/health` e os logs da aplicacao.

### Publicacao automatica de imagem com GitHub Actions

O workflow `.github/workflows/docker-image.yml` faz build automatico da imagem e publica no GitHub Container Registry (`ghcr.io`) quando ha push na branch `main`, tags `v*` ou execucao manual.

Exemplo de imagem publicada:

```bash
ghcr.io/SEU_USUARIO/rastreamento-api:latest
```

Para usar esse workflow:

1. Publique o repositorio no GitHub.
2. Garanta que a branch principal seja `main` ou ajuste o workflow.
3. Ative permissoes de pacote para o repositorio no GitHub, se necessario.
4. Faca push para `main` e confira a aba `Actions`.
5. Depois, consulte a imagem publicada em `Packages` no GitHub.

### Exemplo de automacao com GitHub Actions

Se a API ja estiver publicada, voce pode criar um workflow para disparar a atualizacao periodicamente:

```yaml
name: Atualizar rastreios

on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:

jobs:
  atualizar:
    runs-on: ubuntu-latest
    steps:
      - name: Chamar API
        run: |
          curl -X POST "${{ secrets.RASTREAMENTO_API_URL }}/atualizar-rastreios" \
            -H "x-secret: ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

Secrets sugeridos no GitHub:

- `RASTREAMENTO_API_URL`
- `CRON_SECRET`

## Scripts disponiveis

```bash
npm start
npm run dev
npm test
```

## Observacoes

- O projeto utiliza cache temporario do token dos Correios para evitar autenticacoes desnecessarias.
- Em caso de erro, a API registra informacoes detalhadas nos logs do servidor e protege o retorno ao cliente.
- Testes automatizados podem ser executados com `npm test`.
- Mantenha o arquivo `.env` fora do versionamento e publique apenas o `.env.example`.

## Licenca

Este projeto esta licenciado sob a licenca MIT. Consulte o arquivo `LICENSE` para mais detalhes.
