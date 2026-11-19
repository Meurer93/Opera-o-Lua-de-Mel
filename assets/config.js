// Configuração pública do site (NADA secreto aqui).
// apiBase: endereço do backend Pix (Cloudflare Worker "lua-de-mel"), que também serve o site.
// Vazio = sem backend: o site mostra R$ 0 e o botão de Pix informa que está em configuração.
window.LUA_CONFIG = {
  apiBase: "https://lua-de-mel.andrejosemeurer.workers.dev",
  // intervalo de atualização automática do total (ms)
  atualizarACada: 30000,
};
