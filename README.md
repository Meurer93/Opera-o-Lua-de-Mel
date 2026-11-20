# Operação Lua de Mel

Site de arrecadação da lua de mel de André e Érika. É uma estrada interativa em que o carrinho (BYD branco, placa "Nosso Sonho ❤️") avança conforme as contribuições via Pix (Efí).

- **Site oficial:** https://operacaoluademel.com (Cloudflare Pages, publica automaticamente a branch `main`). O `www` e o antigo `opera-o-lua-de-mel.pages.dev` redirecionam para ele.
- **API Pix (Cloudflare Worker `lua-de-mel`):** https://lua-de-mel.andrejosemeurer.workers.dev/api/... (a raiz redireciona para o site)
- **Meta:** R$ 50.000, com 20 marcos de valor acumulado (ver `assets/destinos.js`, que não deve ser reordenado).

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | Página única com as abas Nossa Jornada, Fotos da Viagem e Agradecimento |
| `assets/estilo.css` | Visual (madeira, terracota, areia, sálvia), mobile-first |
| `assets/experiences/destinos.js` | Os 20 destinos: valor acumulado, apresentação, atrativos, roteiro, experiência e caricatura |
| `assets/scenes/NN-destino.webp` | Paisagens pintadas (fundo da estrada e capa do modal), na resolução original |
| `assets/characters/NN-destino.webp` | 20 caricaturas dos noivos (pacote aprovado), sem filtros |
| `assets/ui/` | Monograma, ramo de oliveira e textura de papel (SVG) |
| `assets/app.js` | Estrada, carro, placas, modais, Pix, fotos e abas |
| `assets/config.js` | Endereço público do backend (`apiBase`). Não contém segredos |
| `carro.webp` | Ilustração aprovada do casal no BYD |
| `fotos/fotos.json` | Álbuns de fotos reais da viagem |
| `worker/` | Worker `lua-de-mel`: API Pix com D1 e cron (`npm run deploy`) |
| `efi-proxy/` | Intermediário mTLS (Vercel, região São Paulo) que repassa as chamadas à Efí com o certificado |
| `index-antigo.html` | Versão antiga, preservada como backup |

## Painel do casal

Endereço: `/painel` (por exemplo, https://operacaoluademel.com/painel). A senha é o `ADMIN_TOKEN` salvo nos secrets do Worker. O painel mostra:

- total, contribuições e lista com data, nome (ou "Anônimo"), valor, mensagem e situação no mural (público, privado ou oculto);
- botão para ocultar ou mostrar recados no mural;
- ajuste manual (valor positivo ou negativo) para presentes recebidos fora do site;
- download da planilha em CSV, que abre no Excel ou no Google Planilhas.

A página não é indexada por buscadores. A senha fica só na aba do navegador e é apagada ao clicar em "Sair" ou fechar a aba.

## Vitrine (tela para passageiros e recepção)

Endereço: `/vitrine` (por exemplo, https://operacaoluademel.com/vitrine). É uma página em tela cheia para um celular ou tablet preso no encosto do banco ou na recepção. Ela mostra:

- a paisagem e a meta atuais, com o carrinho entrando na estrada a cada 20 s;
- um QR Code grande e os recados do mural passando no rodapé;
- o total, atualizado a cada 30 s.

Toque uma vez para entrar em tela cheia; a tela fica acesa enquanto a página estiver aberta. Para testar com outro valor, use `?simular=12500`. **Não usar na tela do carro no campo de visão de quem dirige.**

## Mural de carinho (aba Agradecimento)

- No Pix, a caixa "Quero que meu nome e mensagem apareçam no mural" vem **desmarcada**.
- Aparece no mural somente quem: marcou a caixa, preencheu o nome e teve o pagamento confirmado. Contribuições anônimas nunca aparecem, e os valores nunca são exibidos.
- Quem não marcou fica visível só para o casal, em `GET /api/admin/pagamentos`.
- Para ocultar um recado: `POST /api/admin/ocultar {"txid": "...", "oculto": true}`, com o `ADMIN_TOKEN`.

## Como funciona o movimento

- **Trechos por meta:** cada meta é um trecho da estrada. O arco de chegada mostra a próxima meta ("META N · R$ X"). O carro avança proporcionalmente ao valor dentro do trecho, desde o ponto de partida até o arco.
- **Ao atingir uma meta,** o arco comemora, o carro volta ao ponto de partida e a paisagem passa para o próximo destino. Se uma contribuição cruza até 3 metas, as chegadas são animadas em sequência.
- **Na meta final** (R$ 50.000) o arco mostra "CONSEGUIMOS! R$ 50.000 ♡".
- **Pré-visualização sem dinheiro real:** acrescente `?simular=12500` ao endereço. Aparece um selo "Simulação" e nada é gravado.

## Adicionar fotos da viagem

1. Envie as fotos para a pasta `fotos/` pelo GitHub ("Add file → Upload files"). Use JPG ou WebP com até cerca de 1600 px de largura.
2. Edite `fotos/fotos.json` e coloque cada foto no álbum do destino:

```json
{ "id": "itapema", "titulo": "Piquenique em Itapema",
  "fotos": [ { "src": "fotos/itapema-1.jpg", "legenda": "Pé na areia" } ] }
```

Álbuns sem fotos não aparecem no site. O Cloudflare publica sozinho depois do commit.

## Identidade visual

- **Interface:** vinho `#65283B`, verde-oliva `#687044`, verde profundo `#343B2C`, champagne `#E8D9BD`, dourado envelhecido `#B89562` e marfim `#F7F1E6`.
- **Tipografia:** Cormorant Garamond nos títulos, Great Vibes nos detalhes manuscritos e Nunito Sans nos textos.
- **Ilustrações:** paisagens e caricaturas não recebem filtro nem camada de cor.

## Trocar uma imagem

- **Paisagem:** substitua `assets/scenes/NN-destino.webp` mantendo o mesmo nome.
- **Caricatura:** substitua `assets/characters/NN-destino.webp`.

As 20 paisagens estão na resolução original recebida (cerca de 372×208 px). Se existirem versões maiores, basta trocar os arquivos para ficarem nítidas também no computador.

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
| `POST /api/pix` `{valor, nome?, mensagem?, publico?}` | Cria a cobrança e devolve QR e copia-e-cola |
| `GET /api/mural` | Recados públicos autorizados, sem valores |
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
4. Rode `cd worker && npm run deploy`. O `apiBase` em `assets/config.js` já aponta para `https://lua-de-mel.andrejosemeurer.workers.dev`.
5. Opcional: `POST /api/admin/webhook` para cadastrar o webhook.

### Custos

| Serviço | Custo |
|---|---|
| Cloudflare Pages, Workers (100 mil req/dia), D1 (5 GB) e Cron | Plano gratuito |
| Efí | Tarifa por Pix recebido, conforme o contrato da conta |
