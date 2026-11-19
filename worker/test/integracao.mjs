// Teste de integração LOCAL do backend contra uma Efí SIMULADA.
// Nada aqui toca a Efí real nem cria pagamentos reais: serve para validar a lógica
// (criação de cobrança, confirmação só via API, idempotência, webhook com HMAC,
// devolução, conciliação). Executar: npm test
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MOCK_PORT = 18787, API_PORT = 18788;
const CHAVE = "chave-teste-0000";
const cobs = new Map();
let tokenCalls = 0;

const mock = http.createServer(async (req, res) => {
  let body = "";
  for await (const c of req) body += c;
  const send = (s, d) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(d)); };
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/oauth/token") {
    tokenCalls++;
    const ok = req.headers.authorization === "Basic " + Buffer.from("cid:csecret").toString("base64");
    return ok ? send(200, { access_token: "tok", expires_in: 3600 }) : send(401, {});
  }
  if (req.headers.authorization !== "Bearer tok") return send(401, {});
  let m;
  if ((m = u.pathname.match(/^\/v2\/cob\/([A-Za-z0-9]+)$/)) && req.method === "PUT") {
    const b = JSON.parse(body);
    if (b.chave !== CHAVE) return send(400, { nome: "chave" });
    const cob = { txid: m[1], status: "ATIVA", valor: b.valor, loc: { id: cobs.size + 1 }, pixCopiaECola: "000201COPIA" + m[1] };
    cobs.set(m[1], cob);
    return send(201, cob);
  }
  if ((m = u.pathname.match(/^\/v2\/loc\/(\d+)\/qrcode$/))) return send(200, { qrcode: "000201QR" + m[1], imagemQrcode: "data:image/png;base64,AAAA" });
  if ((m = u.pathname.match(/^\/v2\/cob\/([A-Za-z0-9]+)$/)) && req.method === "GET") {
    const c = cobs.get(m[1]);
    return c ? send(200, c) : send(404, {});
  }
  if (u.pathname === "/v2/pix") return send(200, { pix: [...cobs.values()].flatMap((c) => c.pix || []) });
  send(404, { nome: "rota" });
});

function pagar(txid, e2e, valor) {
  const c = cobs.get(txid);
  c.status = "CONCLUIDA";
  c.pix = [...(c.pix || []), { endToEndId: e2e, txid, chave: CHAVE, valor, horario: new Date().toISOString() }];
}

let falhas = 0;
const DEBUG = process.env.DEBUG_TEST;
const ok = (cond, msg) => { console.log(`${cond ? "✔" : "✘"} ${msg}`); if (!cond) falhas++; };
const api = (p, init = {}) => fetch(`http://127.0.0.1:${API_PORT}${p}`, init).then(async (r) => ({ s: r.status, d: await r.json().catch(() => null) }));

await new Promise((r) => mock.listen(MOCK_PORT, r));
const persist = mkdtempSync(join(tmpdir(), "lua-d1-"));
const vars = { EFI_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, EFI_CLIENT_ID: "cid", EFI_CLIENT_SECRET: "csecret", EFI_PIX_KEY: CHAVE, WEBHOOK_HMAC: "segredo-hmac", ADMIN_TOKEN: "adm", EFI_WEBHOOK_IPS: "" };
writeFileSync(".dev.vars", Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n"));

// Cópia da configuração sem o certificado mTLS (que só existe no Cloudflare real).
writeFileSync("wrangler.test.toml", readFileSync("wrangler.toml", "utf8").replace(/\[\[mtls_certificates\]\][^\[]*/s, ""));
const run = (args) => new Promise((res, rej) => { const p = spawn("npx", ["wrangler", ...args], { stdio: "inherit" }); p.on("exit", (c) => (c ? rej(new Error("falhou " + args.join(" "))) : res())); });
await run(["d1", "execute", "lua-de-mel", "--config", "wrangler.test.toml", "--local", "--persist-to", persist, "--file", "schema.sql"]);
const dev = spawn("npx", ["wrangler", "dev", "--config", "wrangler.test.toml", "--port", String(API_PORT), "--persist-to", persist, "--test-scheduled"], { stdio: ["ignore", "pipe", "pipe"] });
let log = ""; dev.stdout.on("data", (d) => (log += d)); dev.stderr.on("data", (d) => (log += d));
for (let i = 0; i < 90; i++) { try { if ((await api("/api/saude")).s === 200) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

try {
  let r = await api("/api/total");
  if (DEBUG) console.log("DEBUG total:", r.s, JSON.stringify(r.d));
  ok(r.s === 200 && r.d.totalCentavos === 0, "total inicial é zero");

  r = await api("/api/pix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor: 2 }) });
  ok(r.s === 400, "rejeita valor abaixo do mínimo");

  r = await api("/api/pix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor: 150.5, nome: "Tia <b>Ana</b>", mensagem: "Felicidades" }) });
  ok(r.s === 200 && /^[a-f0-9]{32}$/.test(r.d.txid) && r.d.copiaECola.startsWith("000201"), "cria cobrança e devolve copia-e-cola");
  const tx = r.d.txid;
  ok(cobs.get(tx).valor.original === "150.50", "envia valor.original no formato da Efí (150.50)");

  r = await api(`/api/pix/${tx}`);
  ok(r.d.status === "ATIVA" && r.d.pago === false, "QR aberto NÃO conta como pago");
  ok((await api("/api/total")).d.totalCentavos === 0, "total continua zero com cobrança apenas aberta");

  pagar(tx, "E00000000202611191234abcdef", "150.50");
  await new Promise((r) => setTimeout(r, 4200));
  r = await api(`/api/pix/${tx}`);
  ok(r.d.status === "CONCLUIDA" && r.d.pago, "confirma pagamento consultando a API");
  ok((await api("/api/total")).d.totalCentavos === 15050, "total = R$ 150,50");

  // webhook: HMAC errado
  r = await fetch(`http://127.0.0.1:${API_PORT}/api/webhook/efi?hmac=errado&ignorar=`, { method: "POST", body: "{}" });
  ok(r.status === 403, "webhook com HMAC inválido é rejeitado");

  // webhook forjado: corpo diz que pagou, mas a API não confirma
  const r2 = await api("/api/pix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor: 1000 }) });
  const tx2 = r2.d.txid;
  r = await fetch(`http://127.0.0.1:${API_PORT}/api/webhook/efi?hmac=segredo-hmac&ignorar=`, { method: "POST", body: JSON.stringify({ pix: [{ txid: tx2, endToEndId: "EFALSO", valor: "1000.00" }] }) });
  await new Promise((r) => setTimeout(r, 800));
  ok(r.status === 200 && (await api("/api/total")).d.totalCentavos === 15050, "webhook forjado não altera o total (reconsulta a API)");

  // webhook legítimo repetido 2x → conta uma vez só
  pagar(tx2, "E00000000202611191234zzzzzz", "1000.00");
  for (let i = 0; i < 2; i++) await fetch(`http://127.0.0.1:${API_PORT}/api/webhook/efi?hmac=segredo-hmac&ignorar=`, { method: "POST", body: JSON.stringify({ pix: [{ txid: tx2 }] }) });
  await new Promise((r) => setTimeout(r, 1000));
  ok((await api("/api/total")).d.totalCentavos === 115050, "webhook duplicado é contado uma única vez");

  // devolução
  cobs.get(tx2).pix[0].devolucoes = [{ status: "DEVOLVIDO", valor: "200.00" }];
  r = await api("/api/admin/conciliar", { method: "POST", headers: { Authorization: "Bearer adm" } });
  // tx2 já está CONCLUIDA localmente; força reprocesso via webhook
  await fetch(`http://127.0.0.1:${API_PORT}/api/webhook/efi?hmac=segredo-hmac&ignorar=`, { method: "POST", body: JSON.stringify({ pix: [{ txid: tx2 }] }) });
  await new Promise((r) => setTimeout(r, 800));
  ok((await api("/api/total")).d.totalCentavos === 95050, "devolução é descontada do total");

  // conciliação via cron: cobrança paga sem ninguém consultando
  const r3 = await api("/api/pix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor: 50 }) });
  pagar(r3.d.txid, "E0000000020261119cron0001", "50.00");
  await fetch(`http://127.0.0.1:${API_PORT}/__scheduled?cron=*/5+*+*+*+*`);
  await new Promise((r) => setTimeout(r, 1500));
  ok((await api("/api/total")).d.totalCentavos === 100050, "cron de conciliação registra pagamento sem visitante na página");

  r = await api("/api/admin/pagamentos");
  ok(r.s === 401, "rota admin exige token");
  r = await api("/api/admin/pagamentos", { headers: { Authorization: "Bearer adm" } });
  ok(r.s === 200 && r.d.pagamentos.length === 3 && r.d.pagamentos.some((p) => p.nome === "Tia bAna/b"), "histórico com 3 pagamentos e texto saneado");

  r = await api("/api/admin/ajuste", { method: "POST", headers: { Authorization: "Bearer adm", "content-type": "application/json" }, body: JSON.stringify({ valor: 300, descricao: "Presente em dinheiro na festa" }) });
  ok(r.s === 200 && r.d.total.centavos === 130050, "ajuste manual soma no total");
  ok(tokenCalls === 1, `token OAuth reutilizado (chamadas: ${tokenCalls})`);
} finally {
  dev.kill("SIGTERM");
  rmSync("wrangler.test.toml", { force: true }); rmSync(".dev.vars", { force: true });
  mock.close();
}
if (falhas) { console.log(log.slice(-3000)); process.exit(1); }
console.log("\nTodos os testes passaram.");
process.exit(0);
