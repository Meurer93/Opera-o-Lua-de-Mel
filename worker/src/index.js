/**
 * Operação Lua de Mel — backend Pix (Cloudflare Worker)
 *
 * Princípio de segurança: um pagamento só é contabilizado quando a PRÓPRIA API
 * da Efí (chamada com mTLS + OAuth) informa a cobrança como CONCLUIDA e devolve
 * o Pix com endToEndId. O corpo de webhooks nunca é usado como prova de pagamento;
 * ele apenas dispara uma nova consulta à API. Abrir o QR Code não conta nada.
 *
 * Bindings / variáveis (ver wrangler.toml e README):
 *   DB                  D1
 *   EFI_CERT            mTLS certificate binding (certificado .p12 convertido p/ PEM)
 *   EFI_CLIENT_ID       secret
 *   EFI_CLIENT_SECRET   secret
 *   EFI_PIX_KEY         secret/var — chave Pix (de preferência aleatória) da conta Efí
 *   WEBHOOK_HMAC        secret — segredo que vai na URL do webhook
 *   ADMIN_TOKEN         secret — protege rotas /api/admin/*
 *   EFI_ENV             "producao" | "homologacao"
 *   ALLOWED_ORIGINS     origens do site separadas por vírgula
 *   EFI_WEBHOOK_IPS     IPs de origem aceitos no webhook (doc Efí: 34.193.116.226)
 *   EFI_BASE_URL        (somente testes locais) substitui a URL da Efí
 */

const EFI_URLS = {
  producao: "https://pix.api.efipay.com.br",
  homologacao: "https://pix-h.api.efipay.com.br",
};
const MIN_CENTAVOS = 500; // R$ 5,00
const MAX_CENTAVOS = 5_000_000; // R$ 50.000,00
const EXPIRACAO_S = 1800; // 30 min
const MAX_COBRANCAS_POR_IP_10MIN = 6;

let tokenCache = { token: null, expira: 0 };

// ---------------------------------------------------------------- site
// O site oficial é servido pelo Cloudflare Pages; este Worker é só a API.
const SITE_OFICIAL = "https://opera-o-lua-de-mel.pages.dev";
function servirSite(_req, url) {
  return Response.redirect(SITE_OFICIAL + url.pathname + url.search, 301);
}

// ---------------------------------------------------------------- utilidades
const agoraISO = () => new Date().toISOString();

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const permitidas = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok =
    permitidas.includes(origin) ||
    /^https:\/\/([a-z0-9-]+\.)?opera-o-lua-de-mel\.pages\.dev$/.test(origin);
  if (!ok) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function iguaisTempoConstante(a, b) {
  const ea = new TextEncoder().encode(String(a || ""));
  const eb = new TextEncoder().encode(String(b || ""));
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] || 0) ^ (eb[i] || 0);
  return diff === 0 && ea.length > 0;
}

async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function reaisParaCentavos(str) {
  // "123.45" -> 12345, sem erros de ponto flutuante
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(str).trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 100 + parseInt((m[2] || "0").padEnd(2, "0"), 10);
}
const centavosParaReais = (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;

function limparTexto(s, max) {
  if (typeof s !== "string") return null;
  const t = s.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max);
  return t || null;
}

async function registrarEvento(env, tipo, detalhe) {
  try {
    await env.DB.prepare("INSERT INTO eventos (tipo, detalhe, criado_em) VALUES (?, ?, ?)")
      .bind(tipo, typeof detalhe === "string" ? detalhe.slice(0, 2000) : JSON.stringify(detalhe).slice(0, 2000), agoraISO())
      .run();
  } catch (_) { /* auditoria nunca derruba a requisição */ }
}

// ---------------------------------------------------------------- cliente Efí
function efiConfigurada(env) {
  return Boolean(env.EFI_CLIENT_ID && env.EFI_CLIENT_SECRET && env.EFI_PIX_KEY && (env.EFI_PROXY_URL || env.EFI_CERT || env.EFI_BASE_URL));
}

function efiBase(env) {
  return env.EFI_BASE_URL || EFI_URLS[env.EFI_ENV === "homologacao" ? "homologacao" : "producao"];
}

function efiFetcher(env) {
  // A API da Efí está atrás do Cloudflare, e o binding mTLS de Workers não apresenta
  // certificado a destinos que também estão no Cloudflare (403 do WAF da Efí).
  // Por isso, em produção, as chamadas passam por um intermediário mTLS fora do Cloudflare.
  if (env.EFI_PROXY_URL && env.EFI_PROXY_SECRET) {
    return async (url, init = {}) => {
      const u = new URL(url);
      const r = await fetch(env.EFI_PROXY_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-proxy-auth": env.EFI_PROXY_SECRET },
        body: JSON.stringify({ method: init.method || "GET", path: u.pathname + u.search, authorization: init.headers?.Authorization, body: init.body || null }),
      });
      if (!r.ok) return new Response(await r.text(), { status: r.status === 401 ? 500 : r.status });
      const d = await r.json();
      return new Response(d.body, { status: d.status, headers: { "content-type": "application/json" } });
    };
  }
  if (env.EFI_CERT) return (url, init) => env.EFI_CERT.fetch(url, init);
  if (env.EFI_BASE_URL) return (url, init) => fetch(url, init); // apenas mock local
  throw new Error("Certificado Efí (binding EFI_CERT) não configurado");
}

async function efiToken(env) {
  if (tokenCache.token && Date.now() < tokenCache.expira) return tokenCache.token;
  const basic = btoa(`${env.EFI_CLIENT_ID}:${env.EFI_CLIENT_SECRET}`);
  const r = await efiFetcher(env)(`${efiBase(env)}/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (!r.ok) {
    const html = await r.text();
    const titulo = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
    const codigo = (html.match(/(?:Error code|cf-error-code[^>]*>|Error)\s*([0-9]{3,4})/i) || [])[1] || "";
    const corpo = titulo ? `[${titulo.trim()}] erro ${codigo} ray=${r.headers.get("cf-ray") || ""} server=${r.headers.get("server") || ""}` : html.slice(0, 300);
    throw new Error(`OAuth Efí falhou: HTTP ${r.status} ${corpo}`);
  }
  const d = await r.json();
  tokenCache = { token: d.access_token, expira: Date.now() + Math.max(60, (d.expires_in || 3600) - 120) * 1000 };
  return tokenCache.token;
}

async function efi(env, method, path, body, extraHeaders = {}) {
  const exec = async () =>
    efiFetcher(env)(`${efiBase(env)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await efiToken(env)}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  let r = await exec();
  if (r.status === 401) {
    tokenCache = { token: null, expira: 0 };
    r = await exec();
  }
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (_) { dados = { bruto: texto.slice(0, 500) }; }
  if (!r.ok) {
    const err = new Error(`Efí ${method} ${path.replace(/\/[A-Za-z0-9]{26,35}$/, "/:txid")} → HTTP ${r.status}`);
    err.status = r.status;
    err.dados = dados;
    throw err;
  }
  return dados;
}

// ---------------------------------------------------------------- regras de negócio
/**
 * Recebe o objeto de cobrança devolvido por GET /v2/cob/:txid (fonte da verdade)
 * e grava pagamentos/devoluções. Idempotente.
 */
async function aplicarCobranca(env, cob, origem) {
  if (!cob || !cob.txid) return { status: "DESCONHECIDO", novos: 0 };
  const local = await env.DB.prepare("SELECT txid FROM cobrancas WHERE txid = ?").bind(cob.txid).first();
  if (!local) {
    await registrarEvento(env, "cobranca_desconhecida", { txid: cob.txid, origem });
    return { status: cob.status, novos: 0 };
  }
  let novos = 0;
  const stmts = [];
  if (cob.status === "CONCLUIDA" && Array.isArray(cob.pix)) {
    for (const p of cob.pix) {
      if (!p || !p.endToEndId || p.txid && p.txid !== cob.txid) continue;
      if (env.EFI_PIX_KEY && p.chave && p.chave !== env.EFI_PIX_KEY) continue;
      const valor = reaisParaCentavos(p.valor);
      if (!valor || valor <= 0) continue;
      const devolvido = (p.devolucoes || [])
        .filter((d) => d.status === "DEVOLVIDO")
        .reduce((s, d) => s + (reaisParaCentavos(d.valor) || 0), 0);
      stmts.push(
        env.DB.prepare(
          `INSERT INTO pagamentos (e2eid, txid, valor_centavos, devolvido_centavos, horario, registrado_em, origem)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(e2eid) DO UPDATE SET devolvido_centavos = excluded.devolvido_centavos`
        ).bind(p.endToEndId, cob.txid, valor, devolvido, p.horario || agoraISO(), agoraISO(), origem)
      );
    }
  }
  stmts.push(
    env.DB.prepare("UPDATE cobrancas SET status = ?, verificado_em = ? WHERE txid = ?").bind(
      String(cob.status || "DESCONHECIDO").slice(0, 60), agoraISO(), cob.txid
    )
  );
  const antes = await env.DB.prepare("SELECT COUNT(*) AS n FROM pagamentos WHERE txid = ?").bind(cob.txid).first();
  await env.DB.batch(stmts);
  const depois = await env.DB.prepare("SELECT COUNT(*) AS n FROM pagamentos WHERE txid = ?").bind(cob.txid).first();
  novos = (depois?.n || 0) - (antes?.n || 0);
  if (novos > 0) await registrarEvento(env, "pagamento_confirmado", { txid: cob.txid, origem, novos });
  return { status: cob.status, novos };
}

async function verificarTxid(env, txid, origem) {
  const cob = await efi(env, "GET", `/v2/cob/${txid}`);
  return aplicarCobranca(env, cob, origem);
}

async function totalArrecadado(env) {
  const p = await env.DB.prepare(
    "SELECT COALESCE(SUM(valor_centavos - devolvido_centavos),0) AS c, COUNT(*) AS n FROM pagamentos"
  ).first();
  const a = await env.DB.prepare("SELECT COALESCE(SUM(valor_centavos),0) AS c FROM ajustes").first();
  return { centavos: (p?.c || 0) + (a?.c || 0), pagamentos: p?.n || 0 };
}

// ---------------------------------------------------------------- rotas
/** Mural público: só pagamentos confirmados, com consentimento, nome preenchido e não ocultados. Sem valores. */
async function rotaMural(env) {
  const r = await env.DB.prepare(
    `SELECT c.nome, c.mensagem, MIN(p.horario) AS horario
       FROM cobrancas c JOIN pagamentos p ON p.txid = c.txid
      WHERE c.publico = 1 AND c.oculto = 0 AND c.nome IS NOT NULL AND TRIM(c.nome) <> ''
        AND (p.valor_centavos - p.devolvido_centavos) > 0
      GROUP BY c.txid ORDER BY horario DESC LIMIT 300`
  ).all();
  return json(
    { mensagens: r.results.map((m) => ({ nome: m.nome, mensagem: m.mensagem || null, data: String(m.horario).slice(0, 10) })) },
    200,
    { "Cache-Control": "public, max-age=30" }
  );
}

async function rotaTotal(env) {
  const t = await totalArrecadado(env);
  return json(
    { totalCentavos: t.centavos, total: t.centavos / 100, pagamentos: t.pagamentos, meta: 50000, atualizadoEm: agoraISO() },
    200,
    { "Cache-Control": "public, max-age=10" }
  );
}

async function rotaCriarPix(req, env, ctx) {
  if (!efiConfigurada(env)) return json({ erro: "pix_nao_configurado", mensagem: "O Pix ainda está sendo configurado. Volte em breve! ♡" }, 503);
  let body;
  try { body = await req.json(); } catch (_) { return json({ erro: "json_invalido" }, 400); }
  const centavos = Math.round(Number(body?.valor) * 100);
  if (!Number.isFinite(centavos) || centavos < MIN_CENTAVOS || centavos > MAX_CENTAVOS)
    return json({ erro: "valor_invalido", mensagem: "Escolha um valor entre R$ 5 e R$ 50.000." }, 400);

  const ip = req.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ipHash = (await sha256Hex(`${ip}|${env.WEBHOOK_HMAC || "lua"}`)).slice(0, 32);
  const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const rec = await env.DB.prepare("SELECT COUNT(*) AS n FROM cobrancas WHERE ip_hash = ? AND criado_em > ?").bind(ipHash, desde).first();
  if ((rec?.n || 0) >= MAX_COBRANCAS_POR_IP_10MIN)
    return json({ erro: "muitas_tentativas", mensagem: "Muitas cobranças em pouco tempo. Tente de novo em alguns minutos." }, 429);

  const txid = crypto.randomUUID().replace(/-/g, ""); // 32 caracteres [a-f0-9] (regra Efí: 26–35 alfanuméricos)
  const nome = limparTexto(body?.nome, 60);
  const mensagem = limparTexto(body?.mensagem, 280);
  // Mural público só com consentimento explícito E nome preenchido (anônimos nunca aparecem).
  const publico = body?.publico === true && nome ? 1 : 0;
  let cob, qr;
  try {
    cob = await efi(env, "PUT", `/v2/cob/${txid}`, {
      calendario: { expiracao: EXPIRACAO_S },
      valor: { original: centavosParaReais(centavos) },
      chave: env.EFI_PIX_KEY,
      solicitacaoPagador: "Operação Lua de Mel — presente para André e Érika ♡",
    });
    qr = await efi(env, "GET", `/v2/loc/${cob.loc.id}/qrcode`);
  } catch (e) {
    ctx.waitUntil(registrarEvento(env, "erro_criar_cobranca", { msg: e.message, dados: e.dados }));
    return json({ erro: "falha_efi", mensagem: "Não conseguimos gerar o Pix agora. Tente novamente em instantes." }, 502);
  }
  const criado = agoraISO();
  const expira = new Date(Date.now() + EXPIRACAO_S * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO cobrancas (txid, valor_centavos, nome, mensagem, status, criado_em, expira_em, ip_hash, publico) VALUES (?, ?, ?, ?, 'ATIVA', ?, ?, ?, ?)"
  ).bind(txid, centavos, nome, mensagem, criado, expira, ipHash, publico).run();

  return json({
    txid,
    valor: centavos / 100,
    copiaECola: qr.qrcode || cob.pixCopiaECola,
    imagemQrcode: qr.imagemQrcode || null,
    expiraEm: expira,
  });
}

async function rotaStatusPix(env, txid, ctx) {
  if (!/^[a-f0-9]{32}$/.test(txid)) return json({ erro: "txid_invalido" }, 400);
  const c = await env.DB.prepare("SELECT txid, status, verificado_em, expira_em FROM cobrancas WHERE txid = ?").bind(txid).first();
  if (!c) return json({ erro: "nao_encontrada" }, 404);
  let status = c.status;
  const ultima = c.verificado_em ? Date.parse(c.verificado_em) : 0;
  // Consulta a Efí no máximo a cada 4 s por cobrança (protege a cota da API).
  if (status === "ATIVA" && Date.now() - ultima > 4000 && efiConfigurada(env)) {
    try {
      const r = await verificarTxid(env, txid, "consulta");
      status = r.status;
    } catch (e) {
      ctx.waitUntil(registrarEvento(env, "erro_consulta", { txid, msg: e.message }));
    }
  }
  const pago = await env.DB.prepare("SELECT COUNT(*) AS n FROM pagamentos WHERE txid = ?").bind(txid).first();
  return json({ txid, status, pago: (pago?.n || 0) > 0, expiraEm: c.expira_em });
}

async function rotaWebhook(req, env, ctx) {
  const url = new URL(req.url);
  if (!env.WEBHOOK_HMAC || !iguaisTempoConstante(url.searchParams.get("hmac"), env.WEBHOOK_HMAC)) {
    ctx.waitUntil(registrarEvento(env, "webhook_rejeitado", { motivo: "hmac" }));
    return new Response("forbidden", { status: 403 });
  }
  const ips = (env.EFI_WEBHOOK_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = req.headers.get("CF-Connecting-IP") || "";
  if (ips.length && !ips.includes(ip)) {
    ctx.waitUntil(registrarEvento(env, "webhook_rejeitado", { motivo: "ip", ip }));
    return new Response("forbidden", { status: 403 });
  }
  let body = null;
  try { body = await req.json(); } catch (_) { /* notificação de teste pode vir vazia */ }
  const txids = [...new Set((body?.pix || []).map((p) => p?.txid).filter((t) => typeof t === "string" && /^[A-Za-z0-9]{26,35}$/.test(t)))];
  ctx.waitUntil(
    (async () => {
      await registrarEvento(env, "webhook_recebido", { txids });
      for (const t of txids) {
        try { await verificarTxid(env, t, "webhook"); }
        catch (e) { await registrarEvento(env, "erro_webhook", { txid: t, msg: e.message }); }
      }
    })()
  );
  return new Response("200", { status: 200 });
}

function admin(req, env) {
  const auth = req.headers.get("Authorization") || "";
  return env.ADMIN_TOKEN && iguaisTempoConstante(auth.replace(/^Bearer\s+/i, ""), env.ADMIN_TOKEN);
}

async function rotaAdmin(req, env, url) {
  if (!admin(req, env)) return json({ erro: "nao_autorizado" }, 401);
  const p = url.pathname;
  if (p === "/api/admin/pagamentos" && req.method === "GET") {
    const pag = await env.DB.prepare(
      `SELECT p.e2eid, p.txid, p.valor_centavos, p.devolvido_centavos, p.horario, p.origem, c.nome, c.mensagem, c.publico, c.oculto
       FROM pagamentos p LEFT JOIN cobrancas c ON c.txid = p.txid ORDER BY p.horario DESC LIMIT 500`
    ).all();
    const aj = await env.DB.prepare("SELECT * FROM ajustes ORDER BY id DESC").all();
    return json({ total: await totalArrecadado(env), pagamentos: pag.results, ajustes: aj.results });
  }
  if (p === "/api/admin/eventos" && req.method === "GET") {
    const ev = await env.DB.prepare("SELECT * FROM eventos ORDER BY id DESC LIMIT 200").all();
    return json(ev.results);
  }
  if (p === "/api/admin/ajuste" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const c = Math.round(Number(b.valor) * 100);
    const d = limparTexto(b.descricao, 200);
    if (!Number.isFinite(c) || c === 0 || !d) return json({ erro: "dados_invalidos" }, 400);
    await env.DB.prepare("INSERT INTO ajustes (valor_centavos, descricao, criado_em) VALUES (?, ?, ?)").bind(c, d, agoraISO()).run();
    return json({ ok: true, total: await totalArrecadado(env) });
  }
  if (p === "/api/admin/ocultar" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (!/^[A-Za-z0-9]{26,35}$/.test(String(b.txid || ""))) return json({ erro: "txid_invalido" }, 400);
    const r = await env.DB.prepare("UPDATE cobrancas SET oculto = ? WHERE txid = ?").bind(b.oculto === false ? 0 : 1, b.txid).run();
    return json({ ok: r.meta.changes === 1 });
  }
  if (p === "/api/admin/conciliar" && req.method === "POST") {
    return json(await conciliar(env, 24 * 7));
  }
  if (p === "/api/admin/webhook" && req.method === "POST") {
    // Cadastra o webhook na Efí. A Efí exige mTLS no servidor de destino; o
    // Cloudflare (planos não-Enterprise) não valida CA própria. Por isso o
    // cadastro usa o cabeçalho x-skip-mtls-checking, e a segurança vem do
    // HMAC na URL + filtro de IP + reconsulta obrigatória na API.
    const destino = `${url.origin}/api/webhook/efi?hmac=${encodeURIComponent(env.WEBHOOK_HMAC)}&ignorar=`;
    try {
      const r = await efi(env, "PUT", `/v2/webhook/${encodeURIComponent(env.EFI_PIX_KEY)}`, { webhookUrl: destino }, { "x-skip-mtls-checking": "true" });
      return json({ ok: true, resposta: r });
    } catch (e) {
      return json({ ok: false, status: e.status, resposta: e.dados }, 502);
    }
  }
  return json({ erro: "rota_desconhecida" }, 404);
}

/** Conciliação: reconsulta cobranças em aberto e lista Pix recebidos na Efí. */
async function conciliar(env, horas = 26) {
  if (!efiConfigurada(env)) return { ok: false, motivo: "efi_nao_configurada" };
  const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString();
  const abertas = await env.DB.prepare(
    "SELECT txid FROM cobrancas WHERE status = 'ATIVA' AND criado_em > ? ORDER BY criado_em DESC LIMIT 40"
  ).bind(desde).all();
  let verificadas = 0, novos = 0, erros = 0;
  for (const { txid } of abertas.results) {
    try { const r = await verificarTxid(env, txid, "conciliacao"); verificadas++; novos += r.novos; }
    catch (e) { erros++; }
  }
  // Varredura dos Pix recebidos (pega pagamentos de cobranças que já tinham expirado no nosso controle)
  try {
    const inicio = new Date(Date.now() - Math.min(horas, 48) * 3600 * 1000).toISOString();
    const lista = await efi(env, "GET", `/v2/pix?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(agoraISO())}`);
    const txids = [...new Set((lista?.pix || []).map((p) => p.txid).filter(Boolean))];
    for (const t of txids) {
      const local = await env.DB.prepare("SELECT 1 FROM cobrancas WHERE txid = ?").bind(t).first();
      const ja = await env.DB.prepare("SELECT 1 FROM pagamentos WHERE txid = ?").bind(t).first();
      if (local && !ja) {
        try { const r = await verificarTxid(env, t, "conciliacao"); novos += r.novos; } catch (_) { erros++; }
      }
    }
  } catch (e) { erros++; await registrarEvento(env, "erro_listar_pix", e.message); }
  const res = { ok: true, verificadas, novos, erros };
  if (novos || erros) await registrarEvento(env, "conciliacao", res);
  return res;
}

async function rotaSaude(env) {
  return json({
    ok: true,
    banco: Boolean(env.DB),
    efi: { ambiente: env.EFI_ENV || "producao", certificado: Boolean(env.EFI_PROXY_URL && env.EFI_PROXY_SECRET), intermediario: Boolean(env.EFI_PROXY_URL), credenciais: Boolean(env.EFI_CLIENT_ID && env.EFI_CLIENT_SECRET), chavePix: Boolean(env.EFI_PIX_KEY) },
    webhookProtegido: Boolean(env.WEBHOOK_HMAC),
    admin: Boolean(env.ADMIN_TOKEN),
  });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      const p = url.pathname.replace(/\/+$/, "");
      if (p === "/api/total" && req.method === "GET") res = await rotaTotal(env);
      else if (p === "/api/mural" && req.method === "GET") res = await rotaMural(env);
      else if (p === "/api/pix" && req.method === "POST") res = await rotaCriarPix(req, env, ctx);
      else if (p.startsWith("/api/pix/") && req.method === "GET") res = await rotaStatusPix(env, p.slice(9), ctx);
      else if (p.startsWith("/api/webhook/efi") && req.method === "POST") return await rotaWebhook(req, env, ctx);
      else if (p.startsWith("/api/admin/")) res = await rotaAdmin(req, env, url);
      else if (p === "/api/saude") res = await rotaSaude(env);
      else if (!p.startsWith("/api/")) return servirSite(req, url);
      else res = json({ erro: "nao_encontrado" }, 404);
    } catch (e) {
      ctx.waitUntil(registrarEvento(env, "erro_interno", e.message));
      res = json({ erro: "erro_interno" }, 500);
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },

  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(conciliar(env, 26));
  },
};

// exportado para testes
export const _internals = { reaisParaCentavos, centavosParaReais, iguaisTempoConstante, aplicarCobranca, conciliar };
