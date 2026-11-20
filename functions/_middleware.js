// Endereço oficial: operacaoluademel.com. O www e o endereço antigo do Pages
// (inclusive QR Codes já impressos) redirecionam para ele, mantendo caminho e parâmetros.
// As prévias de branch (*.opera-o-lua-de-mel.pages.dev) não são afetadas.
const OFICIAL = "operacaoluademel.com";
const REDIRECIONAR = new Set(["www.operacaoluademel.com", "opera-o-lua-de-mel.pages.dev"]);
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  if (REDIRECIONAR.has(url.hostname)) {
    url.hostname = OFICIAL; url.protocol = "https:"; url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  return ctx.next();
}
