-- Operação Lua de Mel — esquema do banco (Cloudflare D1)
-- Idempotente: pode ser executado mais de uma vez.

-- Cobranças Pix criadas pelo site (uma por visitante que clicou em "Gerar Pix").
-- Uma cobrança ATIVA NÃO é dinheiro recebido.
CREATE TABLE IF NOT EXISTS cobrancas (
  txid            TEXT PRIMARY KEY,
  valor_centavos  INTEGER NOT NULL,
  nome            TEXT,
  mensagem        TEXT,
  status          TEXT NOT NULL DEFAULT 'ATIVA',   -- status devolvido pela Efí
  criado_em       TEXT NOT NULL,
  expira_em       TEXT NOT NULL,
  verificado_em   TEXT,
  ip_hash         TEXT
);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas(status, criado_em);
CREATE INDEX IF NOT EXISTS idx_cobrancas_ip ON cobrancas(ip_hash, criado_em);

-- Pagamentos confirmados pela API da Efí. A chave primária é o endToEndId do Pix,
-- o que impede contar o mesmo pagamento duas vezes (webhook + conciliação + consulta).
CREATE TABLE IF NOT EXISTS pagamentos (
  e2eid               TEXT PRIMARY KEY,
  txid                TEXT NOT NULL,
  valor_centavos      INTEGER NOT NULL,
  devolvido_centavos  INTEGER NOT NULL DEFAULT 0,
  horario             TEXT NOT NULL,
  registrado_em       TEXT NOT NULL,
  origem              TEXT NOT NULL                 -- consulta | webhook | conciliacao
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_txid ON pagamentos(txid);

-- Ajustes manuais (ex.: presente em dinheiro ou Pix recebido fora do site).
CREATE TABLE IF NOT EXISTS ajustes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  valor_centavos  INTEGER NOT NULL,
  descricao       TEXT NOT NULL,
  criado_em       TEXT NOT NULL
);

-- Trilha de auditoria (webhooks recebidos, erros da API, execuções do cron).
CREATE TABLE IF NOT EXISTS eventos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo       TEXT NOT NULL,
  detalhe    TEXT,
  criado_em  TEXT NOT NULL
);
