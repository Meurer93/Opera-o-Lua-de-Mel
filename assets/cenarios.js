// Cenários panorâmicos vetoriais (um por destino). viewBox 0 0 800 400.
// A faixa inferior (y > ~330) fica sob o acostamento da estrada; o canto superior
// direito recebe a placa de madeira (HTML), por isso é mantido mais "limpo".
(function () {
  const r = (n) => Math.round(n * 10) / 10;

  // ---------- primitivas ----------
  const sky = (id, a, b, c) =>
    `<defs><linearGradient id="sk${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".62" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="800" height="400" fill="url(#sk${id})"/>`;
  const sun = (x, y, rad, c = "#fff3c4", g = "#ffd27a") =>
    `<circle cx="${x}" cy="${y}" r="${rad * 2.1}" fill="${g}" opacity=".28"/><circle cx="${x}" cy="${y}" r="${rad * 1.45}" fill="${g}" opacity=".35"/><circle cx="${x}" cy="${y}" r="${rad}" fill="${c}"/>`;
  const cloud = (x, y, s = 1, o = 0.9) =>
    `<g fill="#fffaf2" opacity="${o}" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="34" ry="13"/><ellipse cx="-20" cy="4" rx="22" ry="10"/><ellipse cx="22" cy="5" rx="24" ry="10"/><ellipse cx="2" cy="-9" rx="18" ry="12"/></g>`;
  const wave = (y, amp, n, color, ph = 0, extra = "") => {
    const w = 800 / n;
    let d = `M-10 400 L-10 ${r(y + Math.sin(ph) * amp)}`;
    for (let i = 0; i < n; i++) {
      const x0 = i * w, y1 = y + Math.sin(ph + (i + 0.5) * 2.1) * amp, y2 = y + Math.sin(ph + (i + 1) * 2.1) * amp;
      d += ` Q${r(x0 + w / 2)} ${r(y1 - amp * 0.6)} ${r(x0 + w)} ${r(y2)}`;
    }
    return `<path d="${d} L810 400 Z" fill="${color}" ${extra}/>`;
  };
  const mountains = (pts, color, snow) => {
    let d = `M-10 400 L${pts.map((p) => p.join(" ")).join(" L")} L810 400 Z`;
    let s = `<path d="${d}" fill="${color}"/>`;
    if (snow) {
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i];
        if (y < pts[i - 1][1] && y < pts[i + 1][1] && y < snow.limite) {
          const h = snow.h || 26;
          const lx = x + ((pts[i - 1][0] - x) * h) / (pts[i - 1][1] - y), rx = x + ((pts[i + 1][0] - x) * h) / (pts[i + 1][1] - y);
          s += `<path d="M${r(lx)} ${y + h} L${x} ${y} L${r(rx)} ${y + h} L${r(x + (rx - x) * 0.4)} ${y + h - 7} L${r(x - (x - lx) * 0.2)} ${y + h + 3} Z" fill="#fbfdff"/>`;
        }
      }
    }
    return s;
  };
  const sea = (y, a, b, id) =>
    `<defs><linearGradient id="sea${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="0" y="${y}" width="800" height="${400 - y}" fill="url(#sea${id})"/>` +
    [0, 1, 2, 3, 4].map((i) => `<path d="M${40 + i * 150} ${y + 18 + (i % 2) * 22} q14 -5 28 0 t28 0" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" fill="none" stroke-linecap="round"/>`).join("");
  const palm = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C 4 -40, 10 -80, 22 -118" stroke="#8a5a36" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    [[-60, -20], [-40, 10], [0, 30], [45, 14], [62, -14], [10, -40]].map(([dx, dy]) => `<path d="M22 -118 Q ${22 + dx * 0.6} ${-140 + dy * 0.2} ${22 + dx} ${-110 + dy}" stroke="#3f8a4a" stroke-width="9" fill="none" stroke-linecap="round"/>`).join("") +
    `<circle cx="20" cy="-114" r="5" fill="#7a4b2a"/><circle cx="27" cy="-112" r="5" fill="#6b4024"/></g>`;
  const araucaria = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="-120" width="6" height="120" fill="#5b3b25"/>` +
    [[-120, 46], [-104, 38], [-90, 30]].map(([yy, w]) => `<path d="M${-w} ${yy + 6} Q0 ${yy - 16} ${w} ${yy + 6} Q0 ${yy - 4} ${-w} ${yy + 6}Z" fill="#2f5d3a"/>`).join("") +
    `<path d="M-3 -96 L-30 -110 M3 -96 L30 -110 M-3 -84 L-22 -94 M3 -84 L22 -94" stroke="#5b3b25" stroke-width="2.5"/></g>`;
  const cypress = (x, y, s = 1, c = "#2e5a35") => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -92 C 13 -60, 13 -20, 6 0 L-6 0 C -13 -20, -13 -60, 0 -92Z" fill="${c}"/><path d="M0 -84 C 6 -60, 7 -30, 3 -4" stroke="#ffffff" stroke-opacity=".12" stroke-width="3" fill="none"/></g>`;
  const pine = (x, y, s = 1, c = "#2d5a3d") => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="-14" width="6" height="14" fill="#5b3b25"/><path d="M0 -86 L22 -46 L12 -46 L28 -14 L-28 -14 L-12 -46 L-22 -46Z" fill="${c}"/></g>`;
  const tree = (x, y, s = 1, c = "#4f8a4a") => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="-26" width="8" height="26" fill="#6b4428"/><circle cx="0" cy="-42" r="24" fill="${c}"/><circle cx="-16" cy="-30" r="15" fill="${c}"/><circle cx="16" cy="-31" r="16" fill="${c}"/><circle cx="-6" cy="-52" r="10" fill="#fff" opacity=".12"/></g>`;
  const bush = (x, y, s = 1, c = "#4c8b4f", f) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="-8" rx="26" ry="14" fill="${c}"/><ellipse cx="-14" cy="-14" rx="12" ry="10" fill="${c}"/><ellipse cx="12" cy="-16" rx="13" ry="11" fill="${c}"/>${f ? [-14, 2, 15, -4].map((dx, i) => `<circle cx="${dx}" cy="${-12 - (i % 2) * 8}" r="3.6" fill="${f}"/>`).join("") : ""}</g>`;
  const hibisco = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-9" rx="7" ry="10" fill="#e2483d" transform="rotate(${a})"/>`).join("")}<circle r="3.5" fill="#ffd34d"/></g>`;
  const vines = (x, y, w, h, n, c = "#5d8f3a", solo = "#b9894f") => {
    let s = `<path d="M${x} ${y} L${x + w} ${y} L${x + w + 40} ${y + h} L${x - 40} ${y + h}Z" fill="${solo}"/>`;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), yy = y + 4 + t * (h - 8), x0 = x - 40 * t + 4, x1 = x + w + 40 * t - 4;
      s += `<path d="M${r(x0)} ${r(yy)} L${r(x1)} ${r(yy)}" stroke="${c}" stroke-width="${r(3 + t * 6)}" stroke-linecap="round" stroke-dasharray="${r(6 + t * 8)} ${r(2 + t * 2)}"/>`;
    }
    return s;
  };
  const house = (x, y, w, h, wall = "#f4e4c8", roof = "#b5553a", janelas = 2) =>
    `<g><rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${wall}"/><path d="M${x - 6} ${y - h} L${x + w / 2} ${y - h - w * 0.38} L${x + w + 6} ${y - h}Z" fill="${roof}"/>` +
    Array.from({ length: janelas }, (_, i) => `<rect x="${r(x + ((i + 0.5) * w) / janelas - 5)}" y="${r(y - h * 0.68)}" width="10" height="12" fill="#6d8fb0" stroke="#fff" stroke-width="1.5"/>`).join("") +
    `<rect x="${r(x + w / 2 - 6)}" y="${y - 16}" width="12" height="16" fill="#7a4b2a"/></g>`;
  const halfTimber = (x, y, w, h) =>
    `<g><rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="#fbf3e2"/><path d="M${x} ${y - h * 0.5} H${x + w} M${x + w * 0.33} ${y - h} V${y} M${x + w * 0.66} ${y - h} V${y} M${x} ${y - h} L${x + w * 0.33} ${y - h * 0.5} M${x + w} ${y - h} L${x + w * 0.66} ${y - h * 0.5}" stroke="#6b3f26" stroke-width="3.5"/><rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="none" stroke="#6b3f26" stroke-width="3.5"/><path d="M${x - 8} ${y - h} L${x + w / 2} ${y - h - w * 0.6} L${x + w + 8} ${y - h}Z" fill="#a8452f"/><rect x="${x + w * 0.4}" y="${y - h - w * 0.36}" width="${w * 0.2}" height="${w * 0.14}" fill="#f7d98a"/></g>`;
  const boatSail = (x, y, s = 1, sail = "#fffaf0") => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-40 0 L40 0 L28 16 L-30 16Z" fill="#ffffff" stroke="#3d5a74" stroke-width="2"/><rect x="-1.5" y="-70" width="3" height="70" fill="#6b4428"/><path d="M2 -66 L38 -6 L2 -6Z" fill="${sail}"/><path d="M-2 -58 L-30 -6 L-2 -6Z" fill="#f2b8a2"/></g>`;
  const heart = (x, y, s = 1, c = "#d65a5a") => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6 C -10 -2, -9 -12, -3 -12 C 0 -12, 0 -9, 0 -8 C 0 -9, 0 -12, 3 -12 C 9 -12, 10 -2, 0 6Z" fill="${c}"/>`;
  const birds = (x, y) => `<path d="M${x} ${y} q6 -6 12 0 q6 -6 12 0 M${x + 34} ${y - 14} q5 -5 10 0 q5 -5 10 0" stroke="#4b4440" stroke-width="2" fill="none" stroke-linecap="round" opacity=".55"/>`;
  const stars = (n, seed = 3) => Array.from({ length: n }, (_, i) => { const x = (i * 97 + seed * 31) % 780 + 10, y = (i * 53 + seed * 17) % 170 + 10; return `<circle cx="${x}" cy="${y}" r="${1 + (i % 3) * 0.6}" fill="#fff" opacity="${0.5 + (i % 4) * 0.12}"/>`; }).join("");
  const grama = (y, c = "#7fae5a") => wave(y, 6, 9, c, 1.3);

  // ---------- cenários ----------
  const C = [];

  // 1 Piquenique em Itapema
  C.push(() => sky(1, "#7fb2d8", "#f6c48f", "#fbe2b8") + sun(170, 120, 28) + cloud(560, 70, 1) + cloud(320, 50, 0.7) +
    mountains([[-10, 220], [60, 175], [140, 205], [230, 160], [330, 210], [420, 222]], "#6f9a8a") +
    `<g fill="#e8eef2">${[440, 462, 478, 500, 520, 540, 560, 585, 605].map((x, i) => `<rect x="${x}" y="${170 + (i % 3) * 14}" width="16" height="${50 - (i % 3) * 14}"/>`).join("")}</g>` +
    sea(220, "#3fb5c9", "#1f8fae", 1) + `<path d="M-10 290 Q200 268 420 286 T810 282 L810 400 L-10 400Z" fill="#f4dca8"/>` +
    `<g transform="translate(250 330) skewX(-18)"><rect x="-70" y="-22" width="150" height="44" fill="#fff"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${-70 + i * 19}" y="-22" width="9" height="44" fill="#d9403a" opacity=".8"/>`).join("")}${[0, 1, 2, 3].map((i) => `<rect x="-70" y="${-22 + i * 11}" width="150" height="5" fill="#d9403a" opacity=".6"/>`).join("")}</g>` +
    `<g transform="translate(300 314)"><path d="M-22 0 L22 0 L17 22 L-17 22Z" fill="#c48a48" stroke="#8c5a2b" stroke-width="2"/><path d="M-18 0 Q0 -26 18 0" stroke="#8c5a2b" stroke-width="3" fill="none"/><circle cx="-8" cy="-3" r="6" fill="#d03d3d"/><circle cx="5" cy="-4" r="6" fill="#7b3f8f"/><circle cx="12" cy="-1" r="5" fill="#f2b33d"/></g>` +
    palm(70, 330, 1.05) + palm(720, 340, 0.9) + hibisco(110, 345, 1.4) + hibisco(680, 350, 1.2));

  // 2 Pôr do sol e jantar a dois
  C.push(() => sky(2, "#7a6fb0", "#f08c6a", "#ffcf87") + sun(230, 215, 40, "#fff0b0", "#ffb35c") + cloud(520, 60, 0.9, 0.7) + birds(380, 90) +
    sea(225, "#f3a46b", "#5e7fb1", 2) + `<path d="M150 232 L310 232 M170 246 L290 246 M196 260 L264 260" stroke="#fff3c4" stroke-width="4" opacity=".7" stroke-linecap="round"/>` +
    `<path d="M-10 300 Q300 280 810 300 L810 400 L-10 400Z" fill="#e9c995"/>` +
    `<path d="M300 150 Q420 175 560 150" stroke="#6b4428" stroke-width="1.5" fill="none"/>${[330, 360, 390, 420, 450, 480, 510, 540].map((x, i) => `<circle cx="${x}" cy="${158 + Math.sin(i * 0.8) * 6 + (i > 1 && i < 6 ? 6 : 0)}" r="4" fill="#ffe08a"/>`).join("")}` +
    `<g transform="translate(420 300)"><path d="M-62 -40 L62 -40 L70 -6 L-70 -6Z" fill="#fffaf3"/><rect x="-4" y="-6" width="8" height="40" fill="#8c5a2b"/><rect x="-26" y="-56" width="5" height="16" fill="#fff"/><rect x="20" y="-56" width="5" height="16" fill="#fff"/><ellipse cx="-23.5" cy="-60" rx="3" ry="5" fill="#ffd34d"/><ellipse cx="22.5" cy="-60" rx="3" ry="5" fill="#ffd34d"/><path d="M-8 -54 L-6 -40 M8 -54 L6 -40" stroke="#b03a48" stroke-width="5"/></g>` +
    `<g fill="#6b4428"><rect x="320" y="250" width="6" height="80"/><rect x="320" y="290" width="40" height="6"/><rect x="354" y="290" width="6" height="40"/><rect x="514" y="250" width="6" height="80"/><rect x="480" y="290" width="40" height="6"/><rect x="480" y="290" width="6" height="40"/></g>` +
    palm(90, 335, 1.1) + heart(420, 205, 1.3, "#e76a6a") + hibisco(700, 345, 1.4));

  // 3 Gastronomia especial
  C.push(() => sky(3, "#2f3b6b", "#7a5a8c", "#e6a37a") + stars(30, 3) + `<circle cx="650" cy="70" r="18" fill="#fff6d6"/>` +
    wave(250, 12, 4, "#5a6f6a") +
    `<g transform="translate(110 320)"><rect x="0" y="-150" width="260" height="150" fill="#f1dcc0"/><path d="M-12 -150 L272 -150 L260 -178 L0 -178Z" fill="#9c4a33"/>` +
    `<g>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${-4 + i * 34} -128 L${30 + i * 34} -128 L${30 + i * 34} -112 Q${13 + i * 34} -98 ${-4 + i * 34} -112Z" fill="${i % 2 ? "#fff6ea" : "#3f7a5a"}"/>`).join("")}</g>` +
    `<rect x="24" y="-100" width="60" height="70" fill="#ffd98a"/><rect x="176" y="-100" width="60" height="70" fill="#ffd98a"/><rect x="106" y="-90" width="48" height="90" fill="#6b3f26"/>` +
    `<text x="130" y="-156" font-family="Georgia,serif" font-size="18" fill="#fff6ea" text-anchor="middle" font-style="italic">Bistrô</text></g>` +
    `<g transform="translate(560 300)"><ellipse cx="0" cy="0" rx="92" ry="22" fill="#f8f4ee" stroke="#d8cfc2" stroke-width="3"/><ellipse cx="0" cy="-6" rx="54" ry="12" fill="#a8542f"/><circle cx="-18" cy="-12" r="9" fill="#7a3d22"/><circle cx="6" cy="-14" r="10" fill="#8f4a28"/><circle cx="22" cy="-10" r="8" fill="#6f3a1f"/><path d="M-8 -22 l4 -12 l4 12 M2 -24 l6 -10" stroke="#5f9a3a" stroke-width="3"/></g>` +
    `<g transform="translate(690 300)"><path d="M-14 -70 Q-16 -40 0 -36 Q16 -40 14 -70Z" fill="#8c1f33"/><path d="M-14 -70 L14 -70" stroke="#f3eee8" stroke-width="2"/><rect x="-1.5" y="-36" width="3" height="30" fill="#f3eee8"/><ellipse cx="0" cy="-5" rx="13" ry="4" fill="#f3eee8"/></g>` +
    `<g transform="translate(445 300)"><rect x="-10" y="-34" width="20" height="30" rx="4" fill="#3d2f2a"/><rect x="-6" y="-30" width="12" height="20" fill="#ffd34d" opacity=".9"/><path d="M-10 -34 L0 -44 L10 -34" fill="#3d2f2a"/></g>` +
    bush(40, 335, 1.3, "#3f6f4a", "#f2b8c6") + bush(760, 340, 1.2, "#3f6f4a", "#ffd34d"));

  // 4 Passeio de barco — Costa Esmeralda
  C.push(() => sky(4, "#6cb4e0", "#b8e0ef", "#e9f6f2") + sun(640, 70, 22) + cloud(200, 60, 1) + cloud(450, 90, 0.6) +
    mountains([[-10, 230], [80, 160], [170, 200], [250, 150], [360, 215], [430, 230]], "#3f8a5c") + mountains([[380, 240], [470, 196], [560, 232]], "#56a06a") +
    sea(225, "#20c2b0", "#0f8f9a", 4) +
    `<g transform="translate(400 290)"><path d="M-110 0 L110 0 Q100 26 70 30 L-96 30Z" fill="#fff" stroke="#2f4f6a" stroke-width="2.5"/><path d="M-96 30 L70 30" stroke="#1f6f8a" stroke-width="5"/><path d="M-60 0 L-46 -34 L60 -34 L76 0Z" fill="#f7f7f2" stroke="#2f4f6a" stroke-width="2"/><rect x="-36" y="-28" width="80" height="14" rx="4" fill="#2f4f6a"/><path d="M-20 -34 L-10 -52 L30 -52 L36 -34Z" fill="#f7f7f2" stroke="#2f4f6a" stroke-width="2"/><path d="M-130 20 Q-110 12 -96 22 M90 26 Q120 16 150 26" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/></g>` +
    boatSail(650, 250, 0.6) + `<ellipse cx="160" cy="232" rx="60" ry="10" fill="#2f7a52"/>` + palm(150, 232, 0.5) + birds(520, 120));

  // 5 Vinícola Thera — Bom Retiro
  C.push(() => sky(5, "#8fb8de", "#d7e6ee", "#f4ead5") + cloud(160, 60, 0.9) + cloud(620, 80, 0.7) +
    mountains([[-10, 200], [90, 130], [190, 185], [300, 120], [420, 190], [520, 150], [640, 200], [810, 170]], "#6c8fa0") +
    wave(220, 14, 3, "#6e9a52") + araucaria(80, 250, 0.9) + araucaria(140, 238, 0.6) + araucaria(700, 245, 0.8) +
    vines(220, 255, 420, 75, 7, "#4f7f30", "#a77c48") +
    `<g transform="translate(330 250)"><rect x="0" y="-62" width="160" height="62" fill="#e9dcc4"/><path d="M-10 -62 L80 -96 L170 -62Z" fill="#7a4b2a"/><rect x="30" y="-46" width="100" height="22" fill="#fbf4e6" stroke="#7a4b2a" stroke-width="2"/><text x="80" y="-29" text-anchor="middle" font-family="Georgia,serif" font-size="16" font-weight="700" fill="#5a3a22" letter-spacing="2">THERA</text><rect x="10" y="-20" width="140" height="20" fill="#cdb995"/></g>` +
    `<g transform="translate(110 330)"><ellipse cx="0" cy="0" rx="34" ry="14" fill="#8c5a2b"/><rect x="-34" y="-30" width="68" height="30" fill="#9c6a3a"/><ellipse cx="0" cy="-30" rx="34" ry="12" fill="#b07a46"/><path d="M-34 -18 H34 M-34 -8 H34" stroke="#5b3b25" stroke-width="3"/></g>` +
    `<g transform="translate(700 330)">${[[-10, 0], [8, -4], [0, -12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#6a2c6e"/>`).join("")}<circle cx="-2" cy="4" r="7" fill="#6a2c6e"/><path d="M0 -18 Q8 -30 18 -26" stroke="#4f7f30" stroke-width="3" fill="none"/></g>`);

  // 6 Cabana romântica na Serra
  C.push(() => sky(6, "#232a55", "#5a4a7c", "#d98a6a") + stars(46, 6) + `<path d="M690 55 a22 22 0 1 0 14 38 a17 17 0 1 1 -14 -38Z" fill="#fff4cf"/>` +
    mountains([[-10, 210], [100, 140], [210, 190], [340, 130], [470, 200], [600, 160], [810, 210]], "#3d3f66") + wave(240, 10, 4, "#2e4a3e") +
    araucaria(70, 300, 1.1) + araucaria(170, 270, 0.75) + pine(620, 300, 1.2, "#244a35") + pine(700, 310, 1.4, "#1f4230") + pine(560, 290, 0.9, "#2a5040") +
    `<g transform="translate(380 315)"><path d="M-90 0 L0 -140 L90 0Z" fill="#6b3f26"/><path d="M-70 0 L0 -112 L70 0Z" fill="#ffcf6e"/><path d="M0 -112 V0 M-35 -56 H35 M-52 -28 H52" stroke="#6b3f26" stroke-width="4"/><path d="M-100 4 L0 -152 L100 4" stroke="#3a2a22" stroke-width="12" fill="none" stroke-linejoin="round"/><rect x="-100" y="0" width="200" height="10" fill="#5b3b25"/></g>` +
    `<g transform="translate(250 330)"><path d="M-22 0 L22 0 M-18 -4 L18 4 M18 -4 L-18 4" stroke="#6b4428" stroke-width="5" stroke-linecap="round"/><path d="M-14 -4 Q-10 -30 0 -40 Q4 -24 10 -30 Q16 -16 14 -4Z" fill="#ff9a3c"/><path d="M-6 -4 Q-4 -20 2 -26 Q6 -14 6 -4Z" fill="#ffe08a"/><circle cx="0" cy="-20" r="40" fill="#ffb35c" opacity=".14"/></g>` +
    heart(380, 120, 1.4, "#ff8f8f"));

  // 7 Hotel-fazenda
  C.push(() => sky(7, "#7cc0e8", "#c9e7f3", "#f6efd8") + sun(120, 80, 24) + cloud(400, 60, 1) + cloud(640, 95, 0.7) +
    wave(200, 16, 3, "#8bb86a", 0.5) + wave(232, 10, 4, "#73a556", 2) +
    `<g transform="translate(220 260)"><rect x="0" y="-70" width="190" height="70" fill="#f6ead2"/><path d="M-14 -70 L95 -116 L204 -70Z" fill="#b5553a"/>${[20, 60, 120, 160].map((x) => `<rect x="${x}" y="-52" width="16" height="18" fill="#5f87a8" stroke="#fff" stroke-width="2"/>`).join("")}<rect x="84" y="-40" width="22" height="40" fill="#6b3f26"/><rect x="-14" y="-6" width="218" height="6" fill="#8c5a2b"/></g>` +
    `<g transform="translate(480 268)"><rect x="0" y="-60" width="90" height="60" fill="#b5413a"/><path d="M-8 -60 L45 -96 L98 -60Z" fill="#7a2f2a"/><path d="M25 0 V-36 H65 V0 M25 -36 L65 0 M65 -36 L25 0" stroke="#fff" stroke-width="3" fill="none"/></g>` +
    `<ellipse cx="170" cy="300" rx="80" ry="16" fill="#58b0c9"/><ellipse cx="160" cy="296" rx="40" ry="5" fill="#fff" opacity=".35"/>` +
    `<path d="M0 300 H800" stroke="#8c5a2b" stroke-width="3"/>${Array.from({ length: 17 }, (_, i) => `<rect x="${i * 50}" y="288" width="5" height="22" fill="#8c5a2b"/>`).join("")}<path d="M0 296 H800" stroke="#8c5a2b" stroke-width="2"/>` +
    `<g transform="translate(610 320)"><ellipse cx="0" cy="-30" rx="34" ry="16" fill="#9c5a2b"/><path d="M26 -38 L44 -66 L54 -60 L40 -32Z" fill="#9c5a2b"/><ellipse cx="50" cy="-66" rx="12" ry="8" fill="#9c5a2b"/><path d="M38 -72 L36 -82 L44 -74" fill="#5b3b25"/><path d="M30 -60 Q40 -74 48 -70" stroke="#4a2a16" stroke-width="5" fill="none"/>${[-24, -10, 12, 24].map((x) => `<rect x="${x}" y="-20" width="6" height="22" fill="#8a4f25"/>`).join("")}<path d="M-34 -32 Q-48 -24 -44 -4" stroke="#4a2a16" stroke-width="5" fill="none"/></g>` +
    tree(60, 280, 1.1) + tree(740, 285, 1.2, "#5d9a50") + bush(380, 330, 1, "#5c9a4f", "#fff"));

  // 8 Vinícolas do Rio Grande do Sul
  C.push(() => sky(8, "#88b9de", "#e9d9b8", "#f4c98f") + sun(600, 110, 30, "#fff1c0", "#ffc070") + cloud(200, 60, 0.8) +
    wave(185, 22, 3, "#89a55f", 0.3) + vines(-20, 205, 360, 60, 6, "#5b8a2f", "#c49a5a") + vines(400, 196, 420, 70, 7, "#4f7f30", "#b58a4f") +
    cypress(380, 200, 0.7) + cypress(398, 205, 0.6) +
    `<g transform="translate(470 296)"><rect x="0" y="-70" width="150" height="70" fill="#b9a68a"/>${Array.from({ length: 24 }, (_, i) => `<rect x="${(i % 6) * 25 + (Math.floor(i / 6) % 2) * 12}" y="${-70 + Math.floor(i / 6) * 17}" width="23" height="15" fill="#c8b597" stroke="#8f7c62" stroke-width="1"/>`).join("")}<path d="M-12 -70 L75 -108 L162 -70Z" fill="#9c4a33"/><path d="M60 0 V-34 Q75 -50 90 -34 V0Z" fill="#6b3f26"/></g>` +
    `<g transform="translate(160 300)"><path d="M-40 -48 L40 -48 L46 0 L-46 0Z" fill="#fffaf3"/>${[-18, 18].map((x) => `<g transform="translate(${x} -48)"><path d="M-9 -34 Q-10 -14 0 -12 Q10 -14 9 -34Z" fill="#7a1a2c"/><rect x="-1" y="-12" width="2" height="10" fill="#eee"/></g>`).join("")}<path d="M-6 -48 L-2 -94 L4 -94 L8 -48Z" fill="#2f3a2a"/></g>` +
    `<g transform="translate(320 330)">${[[0, 0], [12, 0], [6, -10], [-6, -10], [18, -10], [0, -20], [12, -20], [6, -30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#5a2a6e"/>`).join("")}<path d="M24 -36 q14 -14 28 -6 q-14 2 -14 14z" fill="#5b8a2f"/></g>`);

  // 9 Gramado e Canela
  C.push(() => sky(9, "#8fbfe6", "#d9e8f2", "#efe6d4") + cloud(130, 60, 0.9) + cloud(560, 50, 0.8) +
    mountains([[-10, 230], [120, 180], [260, 220], [420, 170], [580, 220], [810, 190]], "#7b9a86") + wave(240, 8, 5, "#77a35a") +
    `<g transform="translate(380 300)"><rect x="-26" y="-210" width="52" height="210" fill="#a9967e"/><path d="M-26 -210 L0 -290 L26 -210Z" fill="#8a7864"/><rect x="-6" y="-300" width="3" height="20" fill="#6b5a4a"/><rect x="-10" y="-292" width="11" height="3" fill="#6b5a4a"/><circle cx="0" cy="-160" r="12" fill="#e9dfcf" stroke="#6b5a4a" stroke-width="3"/><path d="M-10 -100 V-130 Q0 -146 10 -130 V-100Z" fill="#5f87a8"/><rect x="-90" y="-110" width="64" height="110" fill="#b6a58c"/><rect x="26" y="-110" width="64" height="110" fill="#b6a58c"/><path d="M-100 -110 L-26 -150 L-26 -110Z M100 -110 L26 -150 L26 -110Z" fill="#8a7864"/><path d="M-12 0 V-40 Q0 -56 12 -40 V0Z" fill="#5b3b25"/></g>` +
    halfTimber(90, 300, 90, 70) + halfTimber(560, 300, 100, 80) +
    [60, 150, 240, 520, 640, 740].map((x, i) => bush(x, 345, 1.2, "#4f8a4f", i % 2 ? "#7c8fe6" : "#a07ad6")).join("") +
    [100, 200, 600, 700].map((x) => `<g transform="translate(${x} 330)">${[0, 1, 2, 3, 4, 5].map((k) => `<circle cx="${(k % 3) * 9 - 9}" cy="${-Math.floor(k / 3) * 8}" r="6" fill="${k % 2 ? "#8ea2f0" : "#b7a0ee"}"/>`).join("")}</g>`).join(""));

  // 10 Foz do Iguaçu
  C.push(() => sky(10, "#6fb6e3", "#c4e6f3", "#eaf5ee") + cloud(150, 50, 1) + cloud(600, 60, 0.7) +
    `<path d="M120 210 A260 260 0 0 1 640 210" stroke="#ff5b5b" stroke-width="8" fill="none" opacity=".45"/><path d="M128 210 A252 252 0 0 1 632 210" stroke="#ffb347" stroke-width="8" fill="none" opacity=".45"/><path d="M136 210 A244 244 0 0 1 624 210" stroke="#fff16b" stroke-width="8" fill="none" opacity=".45"/><path d="M144 210 A236 236 0 0 1 616 210" stroke="#6fd36f" stroke-width="8" fill="none" opacity=".45"/><path d="M152 210 A228 228 0 0 1 608 210" stroke="#5fa8ff" stroke-width="8" fill="none" opacity=".45"/>` +
    `<path d="M-10 150 Q100 130 200 150 L260 150 Q340 140 420 150 L520 150 Q620 135 810 160 L810 200 L-10 200Z" fill="#3f7a3a"/>` +
    [[40, 110], [220, 70], [440, 90], [600, 80]].map(([x, w]) => `<rect x="${x}" y="160" width="${w}" height="120" fill="#e9f6fb"/>${Array.from({ length: Math.floor(w / 9) }, (_, i) => `<path d="M${x + 4 + i * 9} 165 V275" stroke="#a8d6ec" stroke-width="2.5"/>`).join("")}`).join("") +
    `<path d="M-10 160 L40 160 L40 290 L-10 290Z M150 155 L220 155 L220 290 L150 290Z M290 150 L440 150 L440 290 L290 290Z M530 152 L600 152 L600 290 L530 290Z M680 158 L810 158 L810 290 L680 290Z" fill="#6c5a48"/>` +
    `<path d="M-10 290 Q400 260 810 290 L810 400 L-10 400Z" fill="#7fc6d6"/><path d="M0 280 Q60 262 120 280 Q200 262 280 282 Q360 262 440 282 Q520 262 600 282 Q680 262 810 282" stroke="#fff" stroke-width="10" fill="none" opacity=".75"/>` +
    [30, 120, 330, 420, 560, 760].map((x, i) => tree(x, 160, 0.7 + (i % 2) * 0.2, i % 2 ? "#2f7a3a" : "#3e8a44")).join(""));

  // 11 Cruzeiro romântico — Itajaí
  C.push(() => sky(11, "#6f7fc0", "#f39a7a", "#ffd59a") + sun(620, 180, 34, "#fff0b0", "#ffb35c") + cloud(200, 60, 0.9, 0.7) + birds(420, 80) +
    sea(225, "#f0a77a", "#3c6fa1", 11) +
    `<g fill="#5a5f7a">${[30, 70, 110].map((x) => `<rect x="${x}" y="150" width="8" height="78"/><rect x="${x - 26}" y="150" width="48" height="6"/>`).join("")}</g>` +
    `<g transform="translate(360 300)"><path d="M-220 -40 L200 -40 L240 -70 L250 -40 Q240 6 200 14 L-200 14 Q-226 -10 -220 -40Z" fill="#fff" stroke="#2f3f5a" stroke-width="3"/><path d="M-210 -6 L230 -6" stroke="#2f4f8a" stroke-width="8"/><path d="M-200 -40 L-190 -76 L170 -76 L196 -40Z" fill="#f7f7f2" stroke="#2f3f5a" stroke-width="2"/><path d="M-170 -76 L-160 -104 L120 -104 L140 -76Z" fill="#f7f7f2" stroke="#2f3f5a" stroke-width="2"/><path d="M-130 -104 L-120 -126 L70 -126 L86 -104Z" fill="#f7f7f2" stroke="#2f3f5a" stroke-width="2"/>${Array.from({ length: 34 }, (_, i) => `<rect x="${-186 + i * 11}" y="-62" width="6" height="6" rx="1.5" fill="#2f4f8a"/>`).join("")}${Array.from({ length: 26 }, (_, i) => `<rect x="${-150 + i * 10.5}" y="-94" width="6" height="6" rx="1.5" fill="#2f4f8a"/>`).join("")}${Array.from({ length: 18 }, (_, i) => `<circle cx="${-196 + i * 23}" cy="-24" r="3.4" fill="#2f3f5a"/>`).join("")}<rect x="-30" y="-158" width="34" height="34" fill="#d65a3a"/><rect x="-30" y="-158" width="34" height="8" fill="#2f3f5a"/><path d="M60 -126 L70 -170 M70 -170 L120 -150" stroke="#2f3f5a" stroke-width="2"/></g>` +
    heart(560, 110, 1.4, "#f3757a") + `<path d="M120 330 q20 -6 40 0 M480 340 q20 -6 40 0" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>`);

  // 12 Bonito
  C.push(() => sky(12, "#7ec3e6", "#cbe9e8", "#e7f3df") + sun(660, 70, 22) + cloud(260, 60, 0.9) +
    wave(170, 18, 3, "#2f6f3a") + wave(205, 10, 4, "#3e8a44", 1.6) +
    `<path d="M-10 230 Q200 214 400 230 T810 226 L810 400 L-10 400Z" fill="#33c9c1"/><path d="M-10 260 Q300 246 810 262 L810 400 L-10 400Z" fill="#1fb1b5"/>` +
    `<g opacity=".55">${[[100, 290], [180, 300], [240, 280], [460, 290], [520, 305], [600, 290]].map(([x, y]) => `<ellipse cx="${x}" cy="${y + 24}" rx="16" ry="6" fill="#d8c48a"/>`).join("")}</g>` +
    [[160, 280, 1], [260, 300, -1], [430, 270, 1], [560, 296, 1], [650, 276, -1]].map(([x, y, d]) => `<g transform="translate(${x} ${y}) scale(${d} 1)"><ellipse cx="0" cy="0" rx="22" ry="8" fill="#f2a43a"/><path d="M18 0 L32 -9 L32 9Z" fill="#e28a2a"/><circle cx="-12" cy="-2" r="2" fill="#2a2a2a"/><path d="M-4 -7 L4 -12 L8 -6" fill="#e28a2a"/></g>`).join("") +
    `<g transform="translate(330 300)" opacity=".85"><ellipse cx="0" cy="0" rx="26" ry="8" fill="#ffd34d"/><circle cx="-16" cy="-6" r="7" fill="#7a4b2a"/><path d="M-8 0 L-30 10 M8 -2 L26 -10" stroke="#ffd34d" stroke-width="6" stroke-linecap="round"/></g>` +
    tree(60, 235, 1.2, "#2f7a3a") + tree(130, 230, 0.9, "#3f8a44") + tree(720, 232, 1.3, "#2a6f35") + palm(620, 232, 0.8) +
    [[520, 120], [540, 140]].map(([x, y]) => `<rect x="${x}" y="${y}" width="40" height="${230 - y}" fill="#d9f2f6" opacity=".9"/>`).join("") + `<path d="M500 120 L600 120 L600 140 L500 140Z" fill="#6c5a48"/>`);

  // 13 Lençóis Maranhenses
  C.push(() => sky(13, "#58a6e0", "#a9d6f0", "#f6efe0") + sun(140, 70, 24) + cloud(480, 50, 0.8) + cloud(700, 90, 0.6) +
    wave(190, 22, 3, "#f8f3e6", 0.4) + wave(225, 20, 4, "#f1e8d2", 2.2) +
    [[160, 260, 90, 18], [420, 245, 120, 20], [660, 262, 80, 15], [300, 300, 140, 22], [580, 310, 100, 18], [80, 320, 70, 12]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#2bb8c9"/><ellipse cx="${x}" cy="${y - 3}" rx="${rx * 0.8}" ry="${ry * 0.55}" fill="#62d6e0"/><ellipse cx="${x - rx * 0.3}" cy="${y - 5}" rx="${rx * 0.25}" ry="3" fill="#fff" opacity=".6"/>`).join("") +
    `<path d="M-10 280 Q120 262 260 286" stroke="#e4d7b8" stroke-width="10" fill="none"/><path d="M500 280 Q640 262 810 284" stroke="#e4d7b8" stroke-width="10" fill="none"/>` +
    `<g transform="translate(470 300)"><path d="M0 0 l0 -24" stroke="#6b4428" stroke-width="3"/><path d="M0 -24 l14 6 l-14 6z" fill="#d65a3a"/></g>` + birds(330, 120));

  // 14 Mendoza
  C.push(() => sky(14, "#5f9fd8", "#bcdcf0", "#f3e7cf") + sun(140, 80, 22) + cloud(330, 50, 0.7) +
    mountains([[-10, 200], [80, 120], [170, 170], [300, 70], [420, 160], [520, 110], [640, 170], [740, 120], [810, 160]], "#7a7fa6", { limite: 150, h: 34 }) +
    mountains([[-10, 230], [140, 190], [300, 225], [460, 185], [620, 228], [810, 200]], "#9b8f7a") +
    wave(232, 6, 4, "#a8b56a") + vines(-30, 245, 460, 80, 7, "#4f7f30", "#c79b5e") + vines(470, 250, 360, 75, 6, "#5b8a2f", "#bb905a") +
    [[440, 240], [460, 240], [480, 240], [760, 240], [780, 240]].map(([x, y]) => cypress(x, y, 0.8, "#4a7a3a")).join("") +
    `<g transform="translate(540 248)"><rect x="0" y="-40" width="120" height="40" fill="#f2e2c4"/><path d="M-8 -40 L60 -64 L128 -40Z" fill="#c0603e"/><path d="M14 0 V-20 Q24 -32 34 -20 V0 M50 0 V-20 Q60 -32 70 -20 V0 M86 0 V-20 Q96 -32 106 -20 V0" fill="#8c5a2b"/></g>`);

  // 15 Vinícolas da Patagônia
  C.push(() => sky(15, "#6aa6dc", "#cfe3f2", "#eef3f2") + cloud(560, 60, 1) + cloud(180, 80, 0.6) +
    mountains([[-10, 200], [90, 150], [160, 90], [190, 120], [230, 60], [270, 115], [300, 95], [360, 180], [460, 140], [560, 200], [810, 180]], "#5c6c8f", { limite: 130, h: 30 }) +
    `<path d="M-10 200 Q300 190 520 205 T810 200 L810 260 L-10 260Z" fill="#4fb6d6"/><path d="M60 214 h80 M260 222 h120 M520 216 h90" stroke="#fff" stroke-width="3" opacity=".6"/>` +
    wave(250, 10, 4, "#9fb36a", 0.9) + vines(330, 265, 470, 70, 6, "#557f30", "#b38a52") +
    `<g transform="translate(90 300)"><path d="M0 0 V-30 L18 -36 L22 -26 L14 -20 V0 M6 0 V-18" stroke="#c99a62" stroke-width="7" stroke-linecap="round" fill="none"/><ellipse cx="2" cy="-20" rx="20" ry="11" fill="#c99a62"/><path d="M18 -36 l4 -8" stroke="#c99a62" stroke-width="4"/></g>` +
    pine(220, 300, 1, "#2f5a45") + pine(260, 296, 0.8, "#2a5040") + `<g transform="translate(640 262)"><rect x="0" y="-32" width="90" height="32" fill="#efe3cc"/><path d="M-6 -32 L45 -52 L96 -32Z" fill="#5b6f8a"/></g>`);

  // 16 Tour pela América Latina (Machu Picchu)
  C.push(() => sky(16, "#6aa8d8", "#d4e6ec", "#f2ecd8") + cloud(120, 120, 1.2, 0.85) + cloud(700, 160, 1, 0.8) +
    `<path d="M380 400 L430 210 Q470 70 520 60 Q580 70 600 200 L660 400Z" fill="#3f7a4a"/><path d="M500 80 Q520 60 540 80 L560 150 L520 160Z" fill="#5c9a5a" opacity=".6"/>` +
    mountains([[-10, 260], [120, 170], [260, 240], [330, 210]], "#5f8a6a") +
    `<g transform="translate(120 300)">${Array.from({ length: 6 }, (_, i) => `<path d="M${i * 14} ${-i * 16} L${360 - i * 16} ${-i * 16} L${352 - i * 16} ${-i * 16 + 12} L${i * 14 + 6} ${-i * 16 + 12}Z" fill="${i % 2 ? "#8db35e" : "#7aa252"}"/>`).join("")}${[[100, -84], [150, -84], [200, -84], [130, -100], [180, -100]].map(([x, y]) => `<g><rect x="${x}" y="${y}" width="34" height="20" fill="#b6a58c" stroke="#7d6c56" stroke-width="2"/><path d="M${x} ${y} L${x + 17} ${y - 10} L${x + 34} ${y}" stroke="#7d6c56" stroke-width="2" fill="none"/></g>`).join("")}</g>` +
    `<g transform="translate(640 330)"><ellipse cx="0" cy="-30" rx="26" ry="14" fill="#f4ede0"/><rect x="14" y="-74" width="12" height="44" rx="6" fill="#f4ede0"/><ellipse cx="22" cy="-76" rx="12" ry="8" fill="#f4ede0"/><path d="M16 -84 l-2 -10 l6 6 M26 -84 l2 -10 l-6 6" fill="#f4ede0" stroke="#d8cfc0"/><circle cx="26" cy="-78" r="1.8" fill="#333"/>${[-18, -6, 8, 18].map((x) => `<rect x="${x}" y="-20" width="6" height="22" fill="#e9dfcf"/>`).join("")}<path d="M-16 -38 h30" stroke="#d65a3a" stroke-width="6"/><path d="M-12 -38 h6 M2 -38 h6" stroke="#2f7ad6" stroke-width="6"/></g>` + birds(260, 90));

  // 17 Mochilão pela Europa
  C.push(() => sky(17, "#9db8e6", "#f2d4c4", "#f7e6c8") + sun(400, 120, 26, "#fff1c4", "#ffc78a") + cloud(170, 50, 0.8) +
    `<g transform="translate(150 290)"><path d="M-110 0 L-110 -90 Q0 -120 110 -90 L110 0Z" fill="#d9b48a"/>${[0, 1, 2].map((row) => Array.from({ length: 8 }, (_, i) => `<path d="M${-100 + i * 26} ${-row * 28 - 4} V${-row * 28 - 18} Q${-90 + i * 26} ${-row * 28 - 28} ${-80 + i * 26} ${-row * 28 - 18} V${-row * 28 - 4}Z" fill="#8a6a4a"/>`).join("")).join("")}<path d="M60 -96 L110 -90 L110 0 L84 0 L84 -40 L60 -60Z" fill="#c4a07a"/></g>` +
    `<g transform="translate(400 290)" stroke="#5a4a3e" stroke-width="3" fill="none"><path d="M-40 0 L-6 -150 L-2 -200 M40 0 L6 -150 L2 -200"/><path d="M-30 -40 Q0 -70 30 -40 M-20 -90 H20 M-12 -140 H12"/><path d="M-36 -20 L36 -20 M-26 -60 L26 -60 M-18 -100 L18 -100" stroke-width="2"/><path d="M0 -200 V-220"/></g>` +
    `<g transform="translate(610 290)"><rect x="-18" y="-160" width="36" height="160" fill="#c9a77a"/><path d="M-22 -160 L0 -200 L22 -160Z" fill="#5a6f6a"/><circle cx="0" cy="-130" r="12" fill="#fff6e0" stroke="#5a4a3e" stroke-width="3"/><path d="M0 -130 V-138 M0 -130 L6 -128" stroke="#5a4a3e" stroke-width="2"/><rect x="18" y="-70" width="110" height="70" fill="#d8c09a"/>${[30, 56, 82, 108].map((x) => `<rect x="${x}" y="-56" width="12" height="20" fill="#5f87a8"/>`).join("")}<path d="M14 -70 L73 -96 L132 -70Z" fill="#b5553a"/></g>` +
    `<g transform="translate(250 330)"><rect x="-160" y="-20" width="300" height="24" rx="6" fill="#d65a3a"/><rect x="-160" y="-30" width="300" height="12" rx="6" fill="#f2e6cf"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${-150 + i * 32}" y="-16" width="20" height="10" rx="2" fill="#bfe0f2"/>`).join("")}${Array.from({ length: 6 }, (_, i) => `<circle cx="${-140 + i * 52}" cy="6" r="6" fill="#3a3a3a"/>`).join("")}</g>` +
    cypress(30, 300, 0.9) + cypress(760, 300, 1));

  // 18 Eurotour vinícola (Toscana)
  C.push(() => sky(18, "#e9a87a", "#f6d2a2", "#fbe8c4") + sun(560, 150, 36, "#fff1c4", "#ffb370") + cloud(200, 60, 0.8, 0.7) +
    wave(170, 26, 2, "#c7b072", 0.4) + wave(205, 22, 3, "#a9a65e", 1.1) + vines(-30, 240, 420, 90, 7, "#5b7f30", "#c58f55") + vines(430, 250, 400, 80, 6, "#68863a", "#c99a5e") +
    [[250, 180], [270, 182], [290, 184], [520, 196], [700, 186], [720, 188]].map(([x, y]) => cypress(x, y, 0.75, "#3f5f35")).join("") +
    `<g transform="translate(340 236)"><rect x="0" y="-50" width="120" height="50" fill="#f0d8b0"/><rect x="80" y="-90" width="30" height="40" fill="#e8cca0"/><path d="M-6 -50 L60 -72 L126 -50Z" fill="#c0603e"/><path d="M76 -90 L95 -102 L114 -90Z" fill="#c0603e"/>${[16, 44, 72].map((x) => `<rect x="${x}" y="-36" width="10" height="16" fill="#6b4428"/>`).join("")}</g>` +
    `<g transform="translate(700 330)"><ellipse cx="0" cy="0" rx="34" ry="14" fill="#8c5a2b"/><rect x="-34" y="-30" width="68" height="30" fill="#9c6a3a"/><ellipse cx="0" cy="-30" rx="34" ry="12" fill="#b07a46"/><path d="M-34 -18 H34 M-34 -8 H34" stroke="#5b3b25" stroke-width="3"/><path d="M-6 -62 Q-8 -46 0 -44 Q8 -46 6 -62Z" fill="#7a1a2c"/><rect x="-1" y="-44" width="2" height="12" fill="#eee"/></g>`);

  // 19 Tailândia
  C.push(() => sky(19, "#4fa6d8", "#a8dcea", "#f4e9c8") + sun(120, 70, 22) + cloud(340, 50, 0.7) +
    [[470, 120, 60], [560, 90, 50], [650, 140, 70], [740, 110, 50]].map(([x, y, w]) => `<path d="M${x - w} 240 Q${x - w} ${y} ${x} ${y} Q${x + w * 0.8} ${y + 10} ${x + w * 0.7} 240Z" fill="#4a8a6a"/><path d="M${x - 10} ${y + 6} Q${x} ${y - 4} ${x + 10} ${y + 6}" fill="#6fae7a"/>`).join("") +
    sea(225, "#25c3c7", "#0f8fa8", 19) +
    `<g transform="translate(200 300)"><rect x="-90" y="-40" width="180" height="40" fill="#e9c46a"/><path d="M-100 -40 L-60 -80 L60 -80 L100 -40Z" fill="#c0392b"/><path d="M-70 -80 L-36 -112 L36 -112 L70 -80Z" fill="#a8312a"/><path d="M-100 -40 L-112 -52 M100 -40 L112 -52 M-70 -80 L-80 -92 M70 -80 L80 -92" stroke="#e9b84a" stroke-width="5" stroke-linecap="round"/><path d="M-10 -112 Q0 -190 10 -112Z" fill="#f2c14e"/><circle cx="0" cy="-130" r="10" fill="#f2c14e"/>${[-60, -30, 0, 30, 60].map((x) => `<rect x="${x - 4}" y="-36" width="8" height="36" fill="#c99a3a"/>`).join("")}</g>` +
    `<g transform="translate(470 296)"><path d="M-70 0 Q0 18 70 -4 L84 -24 Q60 -4 0 -6 Q-50 -8 -70 0Z" fill="#8c5a2b"/><path d="M-70 0 L-80 -18" stroke="#8c5a2b" stroke-width="5"/>${["#d65a3a", "#f2c14e", "#3fa0d6"].map((c, i) => `<path d="M${80 - i * 3} ${-22 + i * 2} l${6} ${-6}" stroke="${c}" stroke-width="4"/>`).join("")}<rect x="-30" y="-18" width="50" height="10" rx="3" fill="#e8d8b8"/></g>` +
    palm(60, 300, 1) + palm(740, 320, 1.1) + hibisco(110, 340, 1.4));

  // 20 Nova Zelândia — Hobbiton e vinícolas
  C.push(() => sky(20, "#f0a07a", "#f8cf9a", "#fbe6b8") + sun(400, 90, 30, "#fff4c8", "#ffc078") +
    mountains([[-10, 180], [100, 110], [200, 160], [320, 95], [450, 165], [560, 105], [690, 160], [810, 120]], "#8e86b0", { limite: 140, h: 26 }) +
    wave(190, 20, 3, "#86b85a", 0.7) + vines(470, 215, 340, 55, 6, "#4f7f30", "#a5b05a") +
    `<path d="M-10 330 Q60 190 230 200 Q360 210 420 330Z" fill="#6fae4a"/><path d="M40 240 Q150 200 260 226" stroke="#8fd06a" stroke-width="6" fill="none" opacity=".6"/>` +
    `<g transform="translate(210 300)"><circle cx="0" cy="0" r="40" fill="#7a4b2a"/><circle cx="0" cy="0" r="32" fill="#3f8a3f"/><circle cx="0" cy="0" r="32" fill="none" stroke="#2f6f2f" stroke-width="3"/><path d="M0 -32 V32 M-32 0 H32" stroke="#2f6f2f" stroke-width="2" opacity=".5"/><circle cx="0" cy="0" r="5" fill="#f2c14e"/><rect x="-60" y="30" width="120" height="14" fill="#c9a77a"/></g>` +
    `<g transform="translate(320 270)"><circle cx="0" cy="0" r="16" fill="#f4d78a" stroke="#7a4b2a" stroke-width="4"/><path d="M0 -16 V16 M-16 0 H16" stroke="#7a4b2a" stroke-width="2"/></g>` +
    `<path d="M130 210 L130 196 M128 196 q2 -6 4 0" stroke="#6b4428" stroke-width="3"/>` + tree(80, 230, 1.6, "#4f8a3a") +
    [120, 280, 360].map((x) => bush(x, 330, 1, "#4f8a4f", ["#f2a3c4", "#ffd34d", "#a07ad6"][x % 3])).join("") +
    `<g transform="translate(600 320)"><ellipse cx="0" cy="-16" rx="22" ry="13" fill="#fbf7ee"/><circle cx="20" cy="-22" r="8" fill="#3a3a3a"/>${[-12, 0, 12].map((x) => `<rect x="${x}" y="-6" width="4" height="10" fill="#3a3a3a"/>`).join("")}</g>` +
    `<g transform="translate(680 316)"><ellipse cx="0" cy="-16" rx="22" ry="13" fill="#fbf7ee"/><circle cx="-20" cy="-22" r="8" fill="#3a3a3a"/>${[-12, 0, 12].map((x) => `<rect x="${x}" y="-6" width="4" height="10" fill="#3a3a3a"/>`).join("")}</g>` +
    heart(400, 40, 1.6, "#e26a6a"));

  // Cenário de abertura (antes do primeiro marco): saída de casa, litoral catarinense
  const abertura = () => sky(0, "#8cc2e6", "#f3dcb0", "#f8e8c6") + cloud(200, 60, 1) + cloud(560, 90, 0.7) + birds(400, 70) +
    mountains([[-10, 220], [120, 160], [240, 210], [380, 150], [520, 215], [660, 170], [810, 220]], "#7ea592") +
    wave(250, 10, 5, "#7aae5a") + palm(160, 320, 1) + palm(600, 316, 0.9) + bush(320, 330, 1.2, "#4f8a4f", "#e2483d") + bush(470, 334, 1, "#4f8a4f", "#ffd34d") +
    hibisco(80, 345, 1.4) + hibisco(720, 340, 1.4) + heart(400, 160, 2, "#e26a6a");

  window.LUA_CENARIOS = { abertura, lista: C };
})();
