// Envia o certificado .p12 da Efí ao Cloudflare (binding mTLS do Worker).
// Uso:  node enviar-certificado.mjs caminho/do/certificado.p12 [senha]
// Requisitos: Node.js 18+, `npm i node-forge` na mesma pasta e `npx wrangler login` feito antes.
// O certificado e a chave privada NÃO saem do seu computador, exceto para o Cloudflare.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import forge from "node-forge";

const [arquivo, senha = ""] = process.argv.slice(2);
if (!arquivo) { console.error("Uso: node enviar-certificado.mjs certificado.p12 [senha]"); process.exit(1); }
const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(readFileSync(arquivo).toString("binary")), senha);
const certs = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
const chaves = [
  ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
  ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
];
if (!certs.length || !chaves.length) { console.error("Não encontrei certificado e chave dentro do .p12."); process.exit(1); }
const pasta = mkdtempSync(join(tmpdir(), "efi-"));
const crt = join(pasta, "efi.crt.pem"), key = join(pasta, "efi.key.pem");
try {
  writeFileSync(crt, certs.map((b) => forge.pki.certificateToPem(b.cert)).join(""));
  writeFileSync(key, forge.pki.privateKeyToPem(chaves[0].key), { mode: 0o600 });
  const cn = certs[0].cert.subject.getField("CN")?.value || "?";
  console.log(`Certificado lido (CN: ${cn}, válido até ${certs[0].cert.validity.notAfter.toISOString().slice(0, 10)}). Enviando ao Cloudflare…`);
  const r = spawnSync("npx", ["-y", "wrangler", "mtls-certificate", "upload", "--cert", crt, "--key", key, "--name", "efi-producao"], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status || 1);
  console.log("\nPronto! Copie o ID mostrado acima e envie para o Claude (o ID não é segredo).");
} finally {
  rmSync(pasta, { recursive: true, force: true }); // apaga os .pem temporários
}
