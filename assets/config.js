// Configuração pública do site (NADA secreto aqui).
// apiBase: endereço do backend Pix (Cloudflare Worker "lua-de-mel-api").
// Enquanto estiver vazio, o site mostra R$ 0 e o botão de Pix informa que está em configuração.
window.LUA_CONFIG = {
  apiBase: "",
  // intervalo de atualização automática do total (ms)
  atualizarACada: 30000,
};
