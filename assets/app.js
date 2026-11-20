(function () {
  "use strict";
  const D = window.LUA_DESTINOS, META = window.LUA_META, CFG = window.LUA_CONFIG || {};
  const API = (CFG.apiBase || "").replace(/\/+$/, "");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brl = (n, dec = 0) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: dec, maximumFractionDigits: dec });
  const num2 = (i) => String(i + 1).padStart(2, "0");
  const imgCena = (i) => `assets/scenes/${num2(i)}-${D[i].slug}.webp`;   // paisagem do destino
  const imgNoivos = (i) => D[i].noivos || "assets/characters/casal-aquarela.webp"; // caricatura do casal
  const reduzMov = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------ estado
  const params = new URLSearchParams(location.search);
  const simulado = params.has("simular") ? Math.max(0, Math.min(META, Number(params.get("simular")) || 0)) : null;
  let total = 0;          // valor real (ou simulado) em reais
  let exibido = 0;        // valor exibido durante a animação
  let explorando = null;
  let cenaAtual = -1;
  let trechoAtual = -1, trechoFinal = false; // trecho (meta) em que o carro está    // índice da cena centralizada (para animar a placa ao chegar)  // índice de cena quando o visitante navega com ‹ ›

  // ------------------------------------------------------------ cenários + placas
  const trilho = $("#trilho"), estrada = $("#estrada");
  const cenas = [];
  function montarCenas() {
    // Paisagens pintadas (img/cenarios/00 = abertura, 01..20 = destinos). As próximas carregam sob demanda.
    const fundo = (i, prioridade) => `<img class="fundo-cena" src="${imgCena(i)}" alt="" ${prioridade ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="1280" height="720">`;
    D.forEach((d, i) => {
      const el = document.createElement("div");
      el.className = "cena";
      el.innerHTML = fundo(i, i < 2) +
        `<button type="button" class="placa madeira" data-i="${i}" aria-label="Marco ${i + 1}: ${d.nome}, ${brl(d.meta)}. Ver experiência">` +
        `<span class="num"><b>${i + 1}</b></span><span class="nome"><span class="ic" aria-hidden="true">${d.icone}</span>${d.nome}</span><span class="preco">${brl(d.meta)}</span></button>`;
      trilho.appendChild(el);
      cenas.push(el);
    });
  }

  // Trecho da estrada: cada meta é um trecho próprio. O carro sai do início e vai até o arco
  // da próxima meta; ao atingi-la, volta ao ponto de partida no trecho seguinte.
  function trecho(v) {
    const k = D.findIndex((d) => d.meta > v);
    if (k < 0) return { k: D.length - 1, frac: 1, final: true };
    const ini = k ? D[k - 1].meta : 0;
    return { k, frac: Math.min(1, Math.max(0, (v - ini) / (D[k].meta - ini))), final: false };
  }
  // A paisagem mostra o destino do trecho atual (o que o carro está indo alcançar).
  function posicaoCena(v) { return trecho(v).k; }

  function medidas() {
    const w = estrada.clientWidth;
    estrada.style.setProperty("--cena-w", w + "px");
    return w;
  }

  function desenhar(v) {
    const w = medidas();
    // paisagem
    const pos = explorando !== null ? explorando : posicaoCena(v);
    const atual = Math.round(pos);
    if (atual !== cenaAtual) {
      cenaAtual = atual;
      const pl = cenas[atual] && cenas[atual].querySelector(".placa");
      if (pl && !reduzMov) { pl.classList.remove("chegou"); void pl.offsetWidth; pl.classList.add("chegou"); }
    }
    trilho.style.transform = `translate3d(${-pos * w * 0.88}px,0,0)`;
    // carro: proporcional ao valor dentro do trecho da meta atual (cada real = um pequeno avanço)
    const t = trecho(v);
    const carro = $("#carro"), cw = carro.offsetWidth;
    const chegada = $("#chegada"), aw = chegada.offsetWidth;
    const x0 = cw / 2 + 6, x1 = w - w * 0.015 - aw / 2;
    carro.style.left = x0 + (x1 - x0) * t.frac + "px";
    $("#balao").textContent = brl(v);
    $("#balao").hidden = t.final;
    if (t.k !== trechoAtual || t.final !== trechoFinal) {
      // novo trecho: arco passa a ser o da próxima meta e o carro volta ao ponto de partida
      const voltou = trechoAtual !== -1 && t.k > trechoAtual;
      trechoAtual = t.k; trechoFinal = t.final;
      chegada.classList.toggle("final", t.final);
      $("#faixa-chegada").innerHTML = t.final
        ? "CONSEGUIMOS!<br>R$ 50.000 ♡"
        : `<small>META ${t.k + 1}</small>${brl(D[t.k].meta)} ♡`;
      chegada.setAttribute("aria-label", t.final ? "Chegada: CONSEGUIMOS! R$ 50.000" : `Chegada da meta ${t.k + 1}: ${D[t.k].nome}, ${brl(D[t.k].meta)}`);
      if (voltou && !reduzMov) { carro.classList.remove("reinicio"); void carro.offsetWidth; carro.classList.add("reinicio"); }
    }
  }

  function atualizarPainel(v) {
    const pct = Math.min(100, (v / META) * 100);
    $("#arrecadado").textContent = brl(v);
    $("#percentual").textContent = pct > 0 && pct < 1 ? "<1%" : Math.floor(pct) + "%";
    $("#barra-fill").style.width = pct + "%";
    $("#barra").setAttribute("aria-valuenow", Math.round(pct));
    const prox = D.findIndex((d) => d.meta > v);
    $("#proxima").textContent = prox < 0 ? "Chegamos ao destino final! 🎉" : `${D[prox].nome} · ${brl(D[prox].meta)} (faltam ${brl(D[prox].meta - v)})`;
    $$(".placa").forEach((p) => {
      const i = +p.dataset.i, ok = v >= D[i].meta;
      p.classList.toggle("ok", ok);
      let s = p.querySelector(".selo");
      if (ok && !s) { s = document.createElement("span"); s.className = "selo"; s.textContent = "✓ alcançado"; p.appendChild(s); }
      if (!ok && s) s.remove();
    });
    renderMarcos(v);
  }

  // animação do valor: o carro dirige até o arco; se a meta for atingida, comemora,
  // volta ao início e segue pelo trecho seguinte.
  let raf = null, filaAnim = null;
  function animarTrecho(de, ate, dur, fim) {
    const t0 = performance.now();
    estrada.classList.add("andando");
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      exibido = de + (ate - de) * e;
      desenhar(exibido);
      $("#arrecadado").textContent = brl(exibido);
      if (k < 1) raf = requestAnimationFrame(passo);
      else { estrada.classList.remove("andando"); exibido = ate; desenhar(ate); fim(); }
    };
    raf = requestAnimationFrame(passo);
  }
  function animarAte(alvo, dur = 2200) {
    cancelAnimationFrame(raf); clearTimeout(filaAnim);
    const concluir = () => { exibido = alvo; desenhar(alvo); atualizarPainel(alvo); };
    if (reduzMov || Math.abs(alvo - exibido) < 0.01) return concluir();
    const tIni = trecho(exibido), tAlvo = trecho(alvo);
    const metasCruzadas = (tAlvo.final ? D.length : tAlvo.k) - tIni.k;
    if (alvo < exibido || metasCruzadas === 0) return animarTrecho(exibido, alvo, dur, concluir);
    if (metasCruzadas > 3) {
      // muitos trechos de uma vez (ex.: primeira visita): começa direto no trecho atual
      const inicio = tAlvo.final ? D[D.length - 1].meta - 0.0001 : (tAlvo.k ? D[tAlvo.k - 1].meta : 0);
      exibido = inicio; desenhar(inicio);
      return animarTrecho(inicio, alvo, dur, concluir);
    }
    // até 3 metas: chega a cada arco, comemora, volta ao início e segue
    const passo = dur * (metasCruzadas > 1 ? 0.4 : 0.6);
    const proximaMeta = () => {
      const t = trecho(exibido);
      const meta = D[t.k].meta;
      if (t.final || alvo < meta) return animarTrecho(exibido, alvo, passo, concluir);
      animarTrecho(exibido, meta - 0.0001, passo, () => {
        const ch = $("#chegada"); ch.classList.remove("festeja"); void ch.offsetWidth; ch.classList.add("festeja");
        filaAnim = setTimeout(() => {
          exibido = meta; desenhar(meta); atualizarPainel(meta);
          if (alvo <= meta) return concluir();
          proximaMeta();
        }, 900);
      });
    };
    proximaMeta();
  }

  // ------------------------------------------------------------ lista de marcos
  function renderMarcos(v) {
    const ol = $("#marcos");
    const prox = D.findIndex((d) => d.meta > v);
    if (!ol.children.length) {
      ol.innerHTML = D.map((d, i) =>
        `<li><button type="button" class="marco" data-i="${i}"><span class="foto"><img src="${imgNoivos(i)}" alt="" loading="lazy" decoding="async"><span class="n">${i + 1}</span></span>` +
        `<span class="txt"><strong>${d.icone} ${d.nome}</strong><span class="reg">${d.regiao}</span><span class="v">${brl(d.meta)}</span><span class="chip"></span></span></button></li>`).join("");
    }
    $$(".marco", ol).forEach((b) => {
      const i = +b.dataset.i, ok = v >= D[i].meta, chip = b.querySelector(".chip");
      b.classList.toggle("ok", ok);
      chip.className = "chip" + (ok ? " ok" : i === prox ? " prox" : "");
      chip.textContent = ok ? "✓ Alcançado" : i === prox ? `Próxima parada · faltam ${brl(D[i].meta - v)}` : `Faltam ${brl(D[i].meta - v)}`;
    });
  }

  // ------------------------------------------------------------ modais
  function abrir(d) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); }
  function fechar(d) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }
  $$("dialog").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-fechar]")) fechar(d); });
  });

  function abrirDestino(i) {
    const d = D[i], v = total, ok = v >= d.meta;
    const md = $("#modal-destino");
    $("#md-cena").src = imgCena(i);
    $("#md-cena").alt = `Paisagem ilustrada: ${d.nome}`;
    $("#md-etapa").textContent = `Etapa ${i + 1} de ${D.length}`;
    $("#md-regiao").textContent = d.regiao;
    $("#md-titulo").textContent = `${d.icone} ${d.nome}`;
    $("#md-resumo").textContent = d.resumo;
    $("#md-especial").textContent = d.especial;
    $("#md-atrativos").innerHTML = d.atrativos.map((a) => `<li>${esc(a)}</li>`).join("");
    $("#md-roteiro").innerHTML = d.roteiro.map(([q, t]) => `<li><b>${esc(q)}</b><span>${esc(t)}</span></li>`).join("");
    $("#md-experiencia").textContent = d.experiencia;
    const nv = $("#md-noivos");
    nv.src = imgNoivos(i);
    nv.alt = `Caricatura de André e Érika: ${d.nome}`;
    const est = $("#md-estado");
    const ant = i ? D[i - 1].meta : 0;
    const pctTrecho = Math.max(0, Math.min(100, ((v - ant) / (d.meta - ant)) * 100));
    est.className = "estado" + (ok ? " ok" : "");
    est.innerHTML = ok
      ? `✓ Experiência alcançada! Meta acumulada: ${brl(d.meta)}`
      : `Meta acumulada: <b>${brl(d.meta)}</b> · faltam <b>${brl(d.meta - v)}</b> para chegarmos aqui.<div class="barra"><i style="width:${pctTrecho}%"></i></div>`;
    $("#modal-destino [data-abrir-pix]").textContent = ok ? "♡ Ajude a seguir viagem" : "♡ Contribuir para chegarmos lá";
    abrir(md);
    md.scrollTop = 0;
  }
  trilho.addEventListener("click", (e) => { const p = e.target.closest(".placa"); if (p) abrirDestino(+p.dataset.i); });
  $("#marcos").addEventListener("click", (e) => { const p = e.target.closest(".marco"); if (p) abrirDestino(+p.dataset.i); });

  // navegação manual pelas paisagens
  function explorar(delta) {
    const atual = explorando !== null ? explorando : Math.round(posicaoCena(exibido));
    explorando = Math.max(0, Math.min(D.length - 1, atual + delta));
    trilho.style.transition = "transform .6s cubic-bezier(.2,.8,.2,1)";
    $("#cena-voltar").hidden = false;
    desenhar(exibido);
  }
  $("#cena-ant").onclick = () => explorar(-1);
  $("#cena-prox").onclick = () => explorar(1);
  $("#cena-voltar").onclick = () => { explorando = null; $("#cena-voltar").hidden = true; desenhar(exibido); };
  // deslizar com o dedo
  let toque = null;
  estrada.addEventListener("touchstart", (e) => { toque = e.touches[0].clientX; }, { passive: true });
  estrada.addEventListener("touchend", (e) => {
    if (toque === null) return;
    const dx = e.changedTouches[0].clientX - toque; toque = null;
    if (Math.abs(dx) > 50) explorar(dx < 0 ? 1 : -1);
  }, { passive: true });
  trilho.addEventListener("transitionend", () => { trilho.style.transition = ""; });

  // ------------------------------------------------------------ total (API)
  const statusEl = $("#status-ao-vivo");
  async function carregarTotal(animar = true) {
    if (simulado !== null) {
      statusEl.className = "ao-vivo off";
      statusEl.innerHTML = `<span class="selo-sim">Simulação: ${brl(simulado)}</span>`;
      total = simulado;
      return animarAte(total);
    }
    if (!API) { statusEl.className = "ao-vivo off"; statusEl.textContent = "Pix em configuração"; return animarAte(0); }
    try {
      const r = await fetch(`${API}/api/total`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const novo = Math.min(META, Math.max(0, Number(d.total) || 0));
      statusEl.className = "ao-vivo";
      statusEl.textContent = "atualizado ao vivo";
      if (novo !== total || animar) { total = novo; animarAte(total); }
    } catch (_) {
      statusEl.className = "ao-vivo off";
      statusEl.textContent = "sem conexão";
    }
  }

  // ------------------------------------------------------------ Pix
  const mp = $("#modal-pix");
  let valorEscolhido = 100, poll = null, cobranca = null, relogio = null;
  let pixPronto = null; // null = desconhecido; false = backend sem credenciais Efí
  async function verificarPix() {
    if (!API) return (pixPronto = false);
    try { const d = await (await fetch(`${API}/api/saude`, { cache: "no-store" })).json(); pixPronto = !!(d.efi && d.efi.certificado && d.efi.credenciais && d.efi.chavePix); }
    catch (_) { pixPronto = null; }
  }
  function passo(n) { [1, 2, 3].forEach((k) => ($("#pix-passo-" + k).hidden = k !== n)); }
  function erroPix(msg) { const e = $("#pix-erro"); e.hidden = !msg; e.textContent = msg || ""; }
  function abrirPix() {
    fechar($("#modal-destino"));
    if (!cobranca) { passo(1); erroPix(""); }
    abrir(mp);
  }
  $("#btn-contribuir").onclick = abrirPix;
  document.addEventListener("click", (e) => { if (e.target.closest("[data-abrir-pix]")) abrirPix(); });
  $("#valores").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#valores button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    valorEscolhido = +b.dataset.v; $("#pix-valor").value = "";
  });
  $("#pix-valor").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value.replace(/\./g, "").replace(",", "."));
    if (v > 0) { valorEscolhido = v; $$("#valores button").forEach((x) => x.setAttribute("aria-pressed", "false")); }
  });
  $("#pix-gerar").onclick = async () => {
    erroPix("");
    const valor = Math.round(valorEscolhido * 100) / 100;
    if (!(valor >= 5)) return erroPix("O valor mínimo é R$ 5,00.");
    if (valor > 50000) return erroPix("O valor máximo é R$ 50.000,00.");
    if (!API || pixPronto === false) return erroPix("O Pix automático está sendo configurado. Volte em breve! ♡");
    const btn = $("#pix-gerar"); btn.disabled = true; btn.textContent = "Gerando Pix…";
    try {
      const r = await fetch(`${API}/api/pix`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor, nome: $("#pix-nome").value, mensagem: $("#pix-msg").value, publico: $("#pix-publico").checked }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.mensagem || "Não foi possível gerar o Pix agora.");
      cobranca = d;
      $("#pix-valor-txt").textContent = brl(d.valor, 2);
      $("#pix-qr").src = d.imagemQrcode || "";
      $("#pix-qr").parentElement.hidden = !d.imagemQrcode;
      $("#pix-copia").value = d.copiaECola;
      passo(2);
      iniciarConsulta();
    } catch (e) { erroPix(e.message); }
    finally { btn.disabled = false; btn.textContent = "Gerar Pix"; }
  };
  $("#pix-copiar").onclick = async () => {
    const inp = $("#pix-copia");
    try { await navigator.clipboard.writeText(inp.value); } catch (_) { inp.select(); document.execCommand("copy"); }
    $("#pix-copiar").textContent = "Copiado ✓";
    setTimeout(() => ($("#pix-copiar").textContent = "Copiar"), 2500);
  };
  function iniciarConsulta() {
    clearInterval(poll); clearInterval(relogio);
    const expira = Date.parse(cobranca.expiraEm);
    const tic = () => {
      const s = Math.max(0, Math.round((expira - Date.now()) / 1000));
      $("#pix-expira").textContent = s ? `Este Pix expira em ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "Este Pix expirou. Feche e gere um novo, se quiser.";
      if (!s) { clearInterval(relogio); clearInterval(poll); cobranca = null; }
    };
    tic(); relogio = setInterval(tic, 1000);
    poll = setInterval(async () => {
      if (document.hidden || !cobranca) return;
      try {
        const r = await fetch(`${API}/api/pix/${cobranca.txid}`, { cache: "no-store" });
        const d = await r.json();
        if (d.pago) {
          clearInterval(poll); clearInterval(relogio); cobranca = null;
          passo(3); confete(); carregarTotal(true);
        } else if (d.status && d.status !== "ATIVA") {
          clearInterval(poll); clearInterval(relogio); cobranca = null;
          $("#pix-expira").textContent = "Esta cobrança não está mais ativa. Feche e gere um novo Pix.";
        }
      } catch (_) { /* tenta de novo no próximo ciclo */ }
    }, 5000);
  }
  function confete() {
    if (reduzMov) return;
    const c = document.createElement("div"); c.className = "confete";
    c.innerHTML = Array.from({ length: 28 }, (_, i) => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.8}s">${["🍷", "♥", "🌺", "✨", "🥂"][i % 5]}</i>`).join("");
    document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
  }

  // ------------------------------------------------------------ fotos
  let fotosLista = [], fotoAtual = 0;
  async function carregarFotos() {
    const filtros = $("#filtros"), box = $("#albuns");
    let albuns = [];
    try { const r = await fetch("fotos/fotos.json", { cache: "no-cache" }); if (r.ok) albuns = (await r.json()).albuns || []; } catch (_) {}
    albuns = albuns.filter((a) => a.fotos && a.fotos.length);
    if (!albuns.length) {
      filtros.hidden = true;
      box.innerHTML = `<div class="vazio"><b>As fotos ainda não chegaram</b><br>Vamos publicar os registros de cada destino aqui, durante e depois da viagem.<div class="slots"><div>📷<br>Preparativos e partida</div><div>🌅<br>Primeiras paradas</div><div>🍷<br>Experiências pelo caminho</div><div>💛<br>Momentos especiais</div></div></div>`;
      return;
    }
    const render = (filtro) => {
      fotosLista = [];
      box.innerHTML = albuns.filter((a) => !filtro || a.id === filtro).map((a) =>
        `<section class="album"><h3>${esc(a.titulo)}</h3>${a.descricao ? `<p class="subtitulo" style="margin:0 0 8px">${esc(a.descricao)}</p>` : ""}<div class="grade">` +
        a.fotos.map((f) => { const k = fotosLista.push({ ...f, album: a.titulo }) - 1; return `<button type="button" data-k="${k}" aria-label="Ampliar foto: ${esc(f.legenda || a.titulo)}"><img src="${esc(f.miniatura || f.src)}" alt="${esc(f.legenda || a.titulo)}" loading="lazy" decoding="async"></button>`; }).join("") +
        `</div></section>`).join("");
    };
    filtros.innerHTML = `<button type="button" aria-pressed="true" data-f="">Todas</button>` + albuns.map((a) => `<button type="button" aria-pressed="false" data-f="${esc(a.id)}">${esc(a.titulo)}</button>`).join("");
    filtros.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; $$("button", filtros).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render(b.dataset.f); };
    box.onclick = (e) => { const b = e.target.closest("[data-k]"); if (b) mostrarFoto(+b.dataset.k); };
    render("");
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function mostrarFoto(k) {
    fotoAtual = (k + fotosLista.length) % fotosLista.length;
    const f = fotosLista[fotoAtual];
    $("#lb-img").src = f.src; $("#lb-img").alt = f.legenda || f.album;
    $("#lb-cap").textContent = [f.legenda, f.album].filter(Boolean).join(" · ");
    if (!$("#lightbox").open) abrir($("#lightbox"));
  }
  $("#lb-ant").onclick = () => mostrarFoto(fotoAtual - 1);
  $("#lb-prox").onclick = () => mostrarFoto(fotoAtual + 1);
  let lbX = null;
  $("#lightbox").addEventListener("touchstart", (e) => (lbX = e.touches[0].clientX), { passive: true });
  $("#lightbox").addEventListener("touchend", (e) => { if (lbX === null) return; const dx = e.changedTouches[0].clientX - lbX; lbX = null; if (Math.abs(dx) > 50) mostrarFoto(fotoAtual + (dx < 0 ? 1 : -1)); }, { passive: true });

  // ------------------------------------------------------------ mural de carinho
  async function carregarMural() {
    const box = $("#mural-lista");
    let lista = [];
    if (API) { try { const r = await fetch(`${API}/api/mural`, { cache: "no-store" }); if (r.ok) lista = (await r.json()).mensagens || []; } catch (_) {} }
    if (!lista.length) { box.innerHTML = `<div class="mural-vazio">Ainda não há recados públicos. Ao contribuir, marque a opção do mural para deixar seu nome e sua mensagem aqui. ♡</div>`; return; }
    const fmtData = (d) => { const [a, m, dd] = d.split("-"); return `${dd}/${m}/${a}`; };
    box.innerHTML = lista.map((m) => `<blockquote class="recado">${m.mensagem ? `<p>${esc(m.mensagem)}</p>` : ""}<footer>${esc(m.nome)}<time datetime="${esc(m.data)}">${fmtData(m.data)}</time></footer></blockquote>`).join("");
  }

  // ------------------------------------------------------------ abas
  const abas = $$(".aba"), mapa = { jornada: "aba-jornada", fotos: "aba-fotos", agradecimento: "aba-agradecimento" };
  let fotosCarregadas = false;
  function mostrarAba(id, foco) {
    if (!mapa[id]) id = "jornada";
    abas.forEach((a) => { const sel = a.id === mapa[id]; a.setAttribute("aria-selected", String(sel)); a.tabIndex = sel ? 0 : -1; if (sel && foco) a.focus(); });
    $$(".painel").forEach((p) => (p.hidden = p.id !== id));
    if (id === "fotos" && !fotosCarregadas) { fotosCarregadas = true; carregarFotos(); }
    if (id === "agradecimento") carregarMural();
    if (id === "jornada") desenhar(exibido);
  }
  abas.forEach((a, i) => {
    a.addEventListener("click", () => { const id = a.getAttribute("aria-controls"); history.replaceState(null, "", "#" + id); mostrarAba(id); });
    a.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const n = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
      n.click(); n.focus();
    });
  });
  window.addEventListener("hashchange", () => mostrarAba(location.hash.slice(1)));

  // ------------------------------------------------------------ início
  montarCenas();
  mostrarAba(location.hash.slice(1));
  renderMarcos(0); atualizarPainel(0); desenhar(0);
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => desenhar(exibido), 80); });
  carregarTotal(true);
  verificarPix();
  if (API && simulado === null) {
    setInterval(() => { if (!document.hidden) carregarTotal(false); }, CFG.atualizarACada || 30000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) carregarTotal(false); });
  }
})();
