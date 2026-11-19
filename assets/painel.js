(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  // Endereço da API. Para testes locais (somente em localhost) aceita ?api=...
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const qApi = new URLSearchParams(location.search).get("api");
  const API = ((local && qApi) || (window.LUA_CONFIG || {}).apiBase || "").replace(/\/+$/, "");
  const CHAVE = "lua-painel-token";
  const brl = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dataHora = (iso) => { const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }); };

  let token = null, dados = null, filtro = "todos";
  try { token = sessionStorage.getItem(CHAVE); } catch (_) {}

  async function api(path, init = {}) {
    const r = await fetch(API + path, { ...init, headers: { ...(init.headers || {}), Authorization: "Bearer " + token, "content-type": "application/json" }, cache: "no-store" });
    if (r.status === 401) throw Object.assign(new Error("Senha incorreta."), { code: 401 });
    if (!r.ok) throw new Error("Falha ao falar com o servidor (" + r.status + ").");
    return r.json();
  }

  function mostrar(logado) { $("#tela-login").hidden = logado; $("#tela-painel").hidden = !logado; }

  async function carregar() {
    try {
      dados = await api("/api/admin/pagamentos");
      mostrar(true); render();
    } catch (e) {
      if (e.code === 401) { sair(); erroLogin(e.message); } else alert(e.message);
    }
  }

  function render() {
    const ps = dados.pagamentos || [];
    const liquido = (p) => p.valor_centavos - p.devolvido_centavos;
    $("#r-total").textContent = brl(dados.total.centavos);
    $("#r-qtd").textContent = ps.length;
    $("#r-media").textContent = ps.length ? brl(Math.round(ps.reduce((s, p) => s + liquido(p), 0) / ps.length)) : "—";
    $("#r-publicos").textContent = ps.filter((p) => p.publico && !p.oculto && p.nome).length;
    const lista = ps.filter((p) => filtro === "todos" || (filtro === "mensagem" && p.mensagem) || (filtro === "publico" && p.publico && p.nome) || (filtro === "privado" && !(p.publico && p.nome)));
    $("#lista").innerHTML = lista.length ? lista.map((p) => {
      const noMural = p.publico && p.nome;
      const selo = !noMural ? `<span class="selo-c priv">Privado</span>` : p.oculto ? `<span class="selo-c oculto">Oculto do mural</span>` : `<span class="selo-c pub">No mural</span>`;
      const dev = p.devolvido_centavos ? ` <span class="selo-c dev">Devolvido ${brl(p.devolvido_centavos)}</span>` : "";
      const botao = noMural ? `<button class="btn btn-peq btn-claro" type="button" data-ocultar="${esc(p.txid)}" data-valor="${p.oculto ? "false" : "true"}">${p.oculto ? "Mostrar no mural" : "Ocultar do mural"}</button>` : "";
      return `<article class="contrib">
        <div class="topo-c"><span class="nome${p.nome ? "" : " anon"}">${p.nome ? esc(p.nome) : "Anônimo"}</span><span class="valor-c">${brl(liquido(p))}</span></div>
        <div class="meta-c">${dataHora(p.horario)} · confirmado via ${esc(p.origem)}</div>
        ${p.mensagem ? `<p class="msg">${esc(p.mensagem)}</p>` : ""}
        <div class="rodape-c"><span>${selo}${dev}</span>${botao}</div>
      </article>`;
    }).join("") : `<div class="vazio-p">Nenhuma contribuição neste filtro ainda.</div>`;
    const aj = dados.ajustes || [];
    $("#lista-ajustes").innerHTML = aj.map((a) => `<li><span>${esc(a.descricao)} <small>· ${dataHora(a.criado_em)}</small></span><b>${brl(a.valor_centavos)}</b></li>`).join("");
  }

  function csv() {
    const linhas = [["data", "nome", "valor_liquido", "mensagem", "mural", "e2eid"]];
    for (const p of dados.pagamentos || []) linhas.push([dataHora(p.horario), p.nome || "Anônimo", ((p.valor_centavos - p.devolvido_centavos) / 100).toFixed(2).replace(".", ","), p.mensagem || "", p.publico && p.nome ? (p.oculto ? "oculto" : "sim") : "não", p.e2eid]);
    for (const a of dados.ajustes || []) linhas.push([dataHora(a.criado_em), "AJUSTE: " + a.descricao, (a.valor_centavos / 100).toFixed(2).replace(".", ","), "", "", ""]);
    const txt = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    a.download = "contribuicoes-lua-de-mel.csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  function erroLogin(msg) { const e = $("#erro-login"); e.hidden = !msg; e.textContent = msg || ""; }
  function sair() { token = null; try { sessionStorage.removeItem(CHAVE); } catch (_) {} mostrar(false); }

  $("#form-login").addEventListener("submit", async (ev) => {
    ev.preventDefault(); erroLogin("");
    token = $("#senha").value.trim();
    try { sessionStorage.setItem(CHAVE, token); } catch (_) {}
    await carregar();
  });
  $("#btn-sair").onclick = sair;
  $("#btn-atualizar").onclick = carregar;
  $("#btn-csv").onclick = csv;
  $("#filtros-painel").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    filtro = b.dataset.f; $$("#filtros-painel button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render();
  });
  $("#lista").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ocultar]"); if (!b) return;
    b.disabled = true;
    try { await api("/api/admin/ocultar", { method: "POST", body: JSON.stringify({ txid: b.dataset.ocultar, oculto: b.dataset.valor === "true" }) }); await carregar(); }
    catch (err) { alert(err.message); b.disabled = false; }
  });
  $("#form-ajuste").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const err = $("#erro-ajuste"); err.hidden = true;
    const valor = parseFloat($("#aj-valor").value.replace(/\./g, "").replace(",", "."));
    const descricao = $("#aj-desc").value.trim();
    if (!valor || !descricao) { err.hidden = false; err.textContent = "Informe valor (diferente de zero) e descrição."; return; }
    if (!confirm(`Lançar ajuste de ${brl(Math.round(valor * 100))} — "${descricao}"? Isso altera o total exibido no site.`)) return;
    try { await api("/api/admin/ajuste", { method: "POST", body: JSON.stringify({ valor, descricao }) }); $("#form-ajuste").reset(); await carregar(); }
    catch (e2) { err.hidden = false; err.textContent = e2.message; }
  });

  if (token) carregar(); else mostrar(false);
})();
