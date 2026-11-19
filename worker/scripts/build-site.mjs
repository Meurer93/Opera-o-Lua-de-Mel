// Gera src/site.generated.js com os arquivos públicos do site embutidos (base64),
// para o Worker servir o site e a API no mesmo endereço.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tipos = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };
const arquivos = {};
const add = (abs) => {
  const st = statSync(abs);
  if (st.isDirectory()) return readdirSync(abs).forEach((f) => add(join(abs, f)));
  const ext = extname(abs).toLowerCase();
  if (!tipos[ext]) return;
  const buf = readFileSync(abs);
  arquivos["/" + relative(raiz, abs).split("\\").join("/")] = { t: tipos[ext], e: createHash("sha1").update(buf).digest("hex").slice(0, 16), b: buf.toString("base64") };
};
for (const item of ["index.html", "index-antigo.html", "carro.webp", "assets", "img", "fotos"]) add(join(raiz, item));
writeFileSync(join(raiz, "worker", "src", "site.generated.js"), "// Gerado por scripts/build-site.mjs — não editar.\nexport default " + JSON.stringify(arquivos) + ";\n");
console.log(Object.keys(arquivos).length, "arquivos embutidos");
