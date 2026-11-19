// Intermediário mTLS para a API Pix da Efí (roda FORA do Cloudflare, ex.: Vercel).
// Motivo: o Cloudflare não apresenta certificado de cliente a destinos que também
// estão atrás do Cloudflare — e a API da Efí está. Este serviço só repassa a
// requisição com o certificado; o Client ID/Secret continuam no Worker.
//
// Variáveis de ambiente:
//   PROXY_SECRET          segredo compartilhado com o Worker (cabeçalho x-proxy-auth)
//   EFI_CERT_P12_BASE64   certificado .p12 da Efí em base64
//   EFI_CERT_PASS         senha do .p12 (vazia na Efí)
//   EFI_ENV               producao | homologacao
import https from "node:https";
import { timingSafeEqual } from "node:crypto";

const HOSTS = { producao: "pix.api.efipay.com.br", homologacao: "pix-h.api.efipay.com.br" };
const ROTA_PERMITIDA = /^\/(oauth\/token|v2\/[A-Za-z0-9\/_\-.:%?=&]+)$/;

function autorizado(valor) {
  const a = Buffer.from(String(valor || "")), b = Buffer.from(String(process.env.PROXY_SECRET || ""));
  return b.length >= 32 && a.length === b.length && timingSafeEqual(a, b);
}

export function encaminhar({ method, path, authorization, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: process.env.EFI_HOST_OVERRIDE || HOSTS[process.env.EFI_ENV === "homologacao" ? "homologacao" : "producao"],
      port: Number(process.env.EFI_PORT_OVERRIDE) || 443,
      path, method,
      pfx: Buffer.from(process.env.EFI_CERT_P12_BASE64 || "", "base64"),
      passphrase: process.env.EFI_CERT_PASS || "",
      rejectUnauthorized: process.env.EFI_INSECURE_TEST !== "1",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      timeout: 20000,
    }, (r) => {
      let dados = "";
      r.setEncoding("utf8");
      r.on("data", (c) => (dados += c));
      r.on("end", () => resolve({ status: r.statusCode, body: dados }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "metodo" });
  if (!autorizado(req.headers["x-proxy-auth"])) return res.status(401).json({ erro: "nao_autorizado" });
  const { method = "GET", path = "", authorization, body } = req.body || {};
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) || !ROTA_PERMITIDA.test(path))
    return res.status(400).json({ erro: "rota_nao_permitida" });
  try {
    const r = await encaminhar({ method, path, authorization, body });
    res.status(200).json(r);
  } catch (e) {
    res.status(502).json({ erro: "falha_conexao_efi", detalhe: e.message });
  }
}
