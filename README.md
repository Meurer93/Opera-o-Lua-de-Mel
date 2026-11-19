# Operação Lua de Mel

Site de arrecadação da lua de mel de André e Érika. É uma estrada interativa em que o carrinho (BYD branco, placa "Nosso Sonho ❤️") avança conforme as contribuições via Pix (Efí).

- **Versão nova publicada (Cloudflare Worker, site + API):** https://lua-de-mel.andrejosemeurer.workers.dev/
- **Endereço antigo (Cloudflare Pages, ligado ao GitHub):** https://opera-o-lua-de-mel.pages.dev/. Passa a mostrar a versão nova quando este código chegar à branch `main`.
- **Meta:** R$ 50.000, com 20 marcos de valor acumulado (ver `assets/destinos.js`, que não deve ser reordenado).

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | Página única com as abas Nossa Jornada, Fotos da Viagem e Agradecimento |
| `assets/estilo.css` | Visual (madeira, terracota, areia, sálvia), mobile-first |
| `assets/destinos.js` | Os 20 marcos: valor acumulado, nome, ícone, região e texto |
| `assets/cenarios.js` | 21 paisagens vetoriais (abertura + 1 por destino) que passam atrás da estrada |
| `assets/app.js` | Estrada, carro, placas, modais, Pix, fotos e abas |
| `assets/config.js` | Endereço público do backend (`apiBase`). Não contém segredos |
| `carro.webp` | Ilustração aprovada do casal no BYD |
| `img/destinos/NN.webp` | Cartões-postais de cada destino (recortes das artes aprovadas) |
| `img/casal-aquarela.webp` | Retrato em aquarela usado no Agradecimento |
| `fotos/fotos.json` | Álbuns de fotos reais da viagem |
| `worker/` | Worker `lua-de-mel`: serve o site (embutido por `npm run build`) e a API Pix, com D1 |
| `img/ilustracoes/NN.webp` | Caricaturas do casal nas experiências (8 de 20, recortadas das artes aprovadas) |
| `efi-proxy/` | Intermediário mTLS (Vercel, região São Paulo) que repassa as chamadas à Efí com o certificado |
| `index-antigo.html` | Versão antiga, preservada como backup |

## Como funciona o movimento

- **Carro:** posição linear no valor arrecadado (`total / 50.000`). Cada real é um pequeno avanço. Em R$ 50.000 ele para sob o arco "CONSEGUIMOS!".
- **Paisagem:** interpolada entre os marcos, de modo que o cenário exibido é sempre o do trecho atual. A estrada é fixa e só os cenários mudam.
- **Pré-visualização sem dinheiro real:** acrescente `?simular=12500` ao endereço. Aparece um selo "Simulação" e nada é gravado.

## Adicionar fotos da viagem

1. Envie as fotos para a pasta `fotos/` pelo GitHub ("Add file → Upload files"). Use JPG ou WebP com até cerca de 1600 px de largura.
2. Edite `fotos/fotos.json` e coloque cada foto no álbum do destino:

```json
{ "id": "itapema", "titulo": "Piquenique em Itapema",
  "fotos": [ { "src": "fotos/itapema-1.jpg", "legenda": "Pé na areia" } ] }
```

Álbuns sem fotos não aparecem no site. O Cloudflare publica sozinho depois do commit.

## Trocar a ilustração de um destino

Para usar uma caricatura própria do casal em um destino, salve a imagem em `img/ilustracoes/` e acrescente `ilustracao: "img/ilustracoes/05.webp"` ao destino correspondente em `assets/destinos.js`.

## Backend Pix (pasta `worker/`)

Fluxo: o visitante escolhe o valor e o Worker cria a cobrança na Efí (`PUT /v2/cob/:txid`, com mTLS e OAuth). O site mostra o QR Code e o copia-e-cola. A confirmação acontece **somente** quando a própria API da Efí devolve a cobrança como `CONCLUIDA` com `endToEndId`. Essa consulta é disparada de três formas:

1. pelo site, a cada 5 s, enquanto o QR está aberto;
2. pelo cron do Worker, a cada 5 min, que também faz a varredura em `GET /v2/pix`;
3. pelo webhook da Efí, quando cadastrado. O webhook nunca é tratado como prova de pagamento: ele só provoca uma nova consulta.

Outras garantias:

- **Sem contagem dupla:** o `endToEndId` é a chave primária da tabela `pagamentos`.
- **Devoluções:** são descontadas automaticamente do total.
- **Webhook:** exige o HMAC na URL e aceita só o IP divulgado pela Efí (34.193.116.226).
- **Segredos:** ficam apenas em Cloudflare Secrets, nunca no repositório.

Por que a confirmação não depende do webhook: a Efí exige mTLS no servidor que recebe o webhook, validando a cadeia de certificados dela. No Cloudflare, validar a CA de terceiros (BYOCA) é recurso só do plano Enterprise. Por isso o cadastro usa `x-skip-mtls-checking`, e a segurança vem da reconsulta obrigatória na API.

### Por que existe o `efi-proxy`

A API Pix da Efí fica atrás do Cloudflare. O binding mTLS de Workers não apresenta certificado de cliente a destinos que também estão no Cloudflare, e por isso o firewall da Efí devolvia 403 "Attention Required". Esse diagnóstico foi confirmado em 19/11/2026: a mesma resposta aparece numa chamada sem certificado.

A solução é que o Worker chame `https://efi-proxy-lua-de-mel.vercel.app/api/efi`. O intermediário só repassa a requisição para `pix.api.efipay.com.br` usando o certificado. Ele aceita apenas o caminho `/oauth/token` e as rotas `/v2/*`, e exige o segredo compartilhado `EFI_PROXY_SECRET`/`PROXY_SECRET`. O Client ID e o Client Secret continuam somente no Worker.

Variáveis na Vercel (projeto `efi-proxy-lua-de-mel`): `PROXY_SECRET`, `EFI_CERT_P12_BASE64` e `EFI_ENV`.

### Rotas

| Rota | Uso |
|---|---|
| `GET /api/total` | Total arrecadado (público) |
| `POST /api/pix` `{valor, nome?, mensagem?}` | Cria a cobrança e devolve QR e copia-e-cola |
| `GET /api/pix/:txid` | Status da cobrança (consulta a Efí) |
| `POST /api/webhook/efi?hmac=…` | Webhook da Efí |
| `GET /api/saude` | Diagnóstico da configuração, sem segredos |
| `GET /api/admin/pagamentos` | Histórico (requer `Authorization: Bearer ADMIN_TOKEN`) |
| `POST /api/admin/ajuste` `{valor, descricao}` | Lança contribuição recebida fora do site |
| `POST /api/admin/webhook` | Cadastra o webhook na Efí |
| `POST /api/admin/conciliar` | Força a conciliação dos últimos 7 dias |

### Banco

O banco é o D1 `lua-de-mel` (id `aaad3483-d6b4-48c4-8a5d-d4cb5bd8a918`). O esquema está em `worker/schema.sql` e já foi aplicado.

### Testes

```bash
cd worker && npm install && npm test
```

O comando roda o Worker localmente contra uma Efí **simulada**: cria cobranças, confirma pagamentos, rejeita webhook forjado, ignora duplicatas, aplica devolução e executa o cron. Nenhum pagamento real é feito.

### Publicar o backend (feito uma vez)

1. Na Efí, gere **novas** credenciais de produção e um **novo** certificado. Revogue os antigos se tiverem sido expostos. Ative os escopos `cob.write`, `cob.read`, `pix.read`, `webhook.write` e `webhook.read`.
2. Converta o certificado e envie-o ao Cloudflare:

   ```bash
   openssl pkcs12 -in certificado.p12 -out efi.crt.pem -clcerts -nokeys -legacy -passin pass:
   openssl pkcs12 -in certificado.p12 -out efi.key.pem -nocerts -nodes -legacy -passin pass:
   npx wrangler mtls-certificate upload --cert efi.crt.pem --key efi.key.pem --name efi-producao
   ```

   Coloque o ID exibido em `worker/wrangler.toml` (bloco `mtls_certificates`).
3. Defina os segredos: `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_PIX_KEY`, `WEBHOOK_HMAC` e `ADMIN_TOKEN` (`npx wrangler secret put NOME`).
4. Rode `cd worker && npm run deploy`, que gera o site embutido e publica o Worker. O `apiBase` em `assets/config.js` já aponta para `https://lua-de-mel.andrejosemeurer.workers.dev`.
5. Opcional: `POST /api/admin/webhook` para cadastrar o webhook.

### Custos

| Serviço | Custo |
|---|---|
| Cloudflare Pages, Workers (100 mil req/dia), D1 (5 GB) e Cron | Plano gratuito |
| Efí | Tarifa por Pix recebido, conforme o contrato da conta |
