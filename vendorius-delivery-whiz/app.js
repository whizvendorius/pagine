/* Vendorius Cockpit v2 — una card per cliente → pagina con Overview · Lista · Copy. */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const root = $("#root");
const S = { me: null, clienti: null, det: {}, lista: {}, ui: {} };

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { S.me = null; throw new Error("accesso"); }
  if (!r.ok) throw new Error(j.errore || r.statusText);
  return j;
}
function toast(t) {
  $$(".toast").forEach(x => x.remove());
  const d = document.createElement("div"); d.className = "toast"; d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1800);
}
const quando = s => s ? s.slice(8, 10) + "/" + s.slice(5, 7) + " " + s.slice(11) : "";
const nomeDi = chi => chi === "matteo" ? "Matteo" : chi === "whiz" ? "Whiz" : chi;

/* ---------------- mini markdown (solo quello che serve nei file cliente) */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>")
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:])/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function md(src) {
  const L = String(src || "").split("\n"); let out = "", i = 0;
  while (i < L.length) {
    const l = L[i], t = l.trim();
    if (!t) { i++; continue; }
    if (/^-{3,}$/.test(t)) { out += "<hr>"; i++; continue; }
    if (/^#{2,4}\s/.test(t)) { out += `<h4>${inline(t.replace(/^#+\s/, ""))}</h4>`; i++; continue; }
    if (t.startsWith("|")) {
      const rows = []; while (i < L.length && L[i].trim().startsWith("|")) rows.push(L[i++].trim());
      const cells = rows.filter(r => !/^\|[\s\-:|]+\|$/.test(r)).map(r => r.replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
      if (!cells.length) continue;
      out += "<table><thead><tr>" + cells[0].map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
        cells.slice(1).map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>";
      continue;
    }
    if (/^([-*]|\d+\.)\s/.test(t)) {
      const ord = /^\d+\./.test(t); const items = [];
      while (i < L.length && /^\s*([-*]|\d+\.)\s/.test(L[i])) items.push(L[i++].trim().replace(/^([-*]|\d+\.)\s/, ""));
      out += (ord ? "<ol>" : "<ul>") + items.map(x => `<li>${inline(x)}</li>`).join("") + (ord ? "</ol>" : "</ul>");
      continue;
    }
    if (t.startsWith(">")) {
      const q = []; while (i < L.length && L[i].trim().startsWith(">")) q.push(L[i++].trim().replace(/^>\s?/, ""));
      out += `<blockquote>${md(q.join("\n"))}</blockquote>`; continue;
    }
    const p = []; while (i < L.length && L[i].trim() && !/^(\||[-*]\s|\d+\.\s|>|#{2,4}\s|-{3,}$)/.test(L[i].trim())) p.push(L[i++].trim());
    if (!p.length) { out += `<p>${inline(t)}</p>`; i++; continue; }
    out += `<p>${p.map(inline).join("<br>")}</p>`;
  }
  return out;
}

/* ---------------- shell */
function shell(inner, crumb = "") {
  root.innerHTML = `
  <header class="top">
    <a class="brand" href="#/"><img src="logo.png" alt="">Vendorius <small>Cockpit</small></a>
    ${crumb ? `<span class="crumb">/ <b>${esc(crumb)}</b></span>` : ""}
    <span class="sp"></span>
    <span class="me">${esc(S.me?.nome || "")}</span>
  </header>
  <main class="wrap">${inner}</main>`;
}
function setBrand(c) {
  const r = document.documentElement.style;
  r.setProperty("--c1", c ? c.c1 : "#111111");
  r.setProperty("--c1-soft", c ? hexA(c.c1, .09) : "rgba(17,17,17,.06)");
}
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function sopBar(sop, big) {
  const i = sop.findIndex(s => s.stato === "ora"); const done = sop.filter(s => s.stato === "fatto").length;
  const cur = i >= 0 ? sop[i] : sop[done - 1];
  const bar = `<div class="sop${big ? " big" : ""}">${sop.map(s => `<i class="${s.stato}" title="${esc(s.nome)}"></i>`).join("")}</div>`;
  if (big) return bar + `<div class="soplabels">${sop.map(s => `<span class="${s.stato}">${s.stato === "fatto" ? "✓ " : ""}${esc(s.nome)}</span>`).join("")}</div>`;
  return bar + `<div class="sopl"><span>Step SOP <b>${(i >= 0 ? i : done - 1) + 1}/7</b></span><b>${esc(cur?.nome || "")}</b></div>`;
}
const finito = c => c.domande_fatte >= c.domande_tot && c.valutate >= c.da_valutare.length;

/* ---------------- home */
async function pHome() {
  setBrand(null);
  shell(`<div class="grid">${"<div class='skel'></div>".repeat(6)}</div>`);
  S.clienti = await api("api/clienti");
  const C = S.clienti;
  shell(`<section class="grid" style="margin-top:40px">${C.map(card).join("")}</section>`);
}
function card(c) {
  const done = finito(c);
  const chips = [];
  if (c.domande_tot) chips.push(`<span class="chip ${c.domande_fatte >= c.domande_tot ? "ok" : ""}">${c.domande_fatte}/${c.domande_tot} sì/no</span>`);
  for (const s of c.da_valutare) {
    const e = c.esiti[s]; const nome = s === "lista" ? "Lista" : "Copy";
    chips.push(e ? `<span class="chip ${e.esito === "approvata" ? "ok" : "ko"}">${nome} ${e.esito === "approvata" ? "✓" : "✗"}</span>`
                 : `<span class="chip c1"><span class="dot"></span>${nome}</span>`);
  }
  if (c.note_aperte) chips.push(`<span class="chip">${c.note_aperte} note</span>`);
  return `<a class="card ${done ? "done" : ""}" href="#/c/${c.slug}" style="--c1:${c.c1};--c1-soft:${hexA(c.c1, .09)}">
    <div class="plate" style="background:${c.logo_bg}"><img src="brand/${c.logo}" alt="${esc(c.nome)}"></div>
    <div class="body">
      <div class="who"><span>${esc(c.nome)}</span><span>${esc(c.aggiornato)}</span></div>
      <h2>${done ? "Fatto. Tocca a Whiz." : esc(c.headline)}</h2>
      <p class="why">${esc(c.per_matteo)}</p>
      ${sopBar(c.sop)}
      <div class="foot">${chips.join("")}<span class="go">Apri →</span></div>
    </div></a>`;
}

/* ---------------- client page */
async function pCliente(slug, tab) {
  const meta = (S.clienti || []).find(c => c.slug === slug);
  setBrand(meta);
  if (!S.det[slug]) shell(`<div class="skel" style="height:300px"></div>`, meta?.nome || "");
  const d = S.det[slug] = await api(`api/clienti/${slug}`);
  setBrand(d);
  const ov = d.overview || {};
  const tabs = [["overview", "Overview", ov.domande?.length ? `${d.domande_fatte}/${d.domande_tot}` : "", d.domande_fatte >= d.domande_tot ? "ok" : ""],
                ["lista", "Lista", ...badge(d, "lista")], ["copy", "Copy", ...badge(d, "copy")]];
  if (d.altri.length) tabs.push(["file", "Altri file", String(d.altri.length), ""]);
  tab = tabs.some(t => t[0] === tab) ? tab : "overview";
  const done = finito(d);
  shell(`
  <section class="hero">
    <div class="band">
      <div class="logo" style="background:${d.logo_bg}"><img src="brand/${d.logo}" alt="${esc(d.nome)}"></div>
      <div class="t"><small>${esc(d.nome)} · aggiornato ${esc(d.aggiornato)}</small>
        <h1>${done ? "Fatto. Tocca a Whiz." : esc(d.headline)}</h1><p>${esc(ov.per_matteo || "")}</p></div>
    </div>
    <div class="steps">${sopBar(d.sop, true)}</div>
    <div class="facts">${ov.obiettivo ? `<span><b>Obiettivo</b> · ${esc(ov.obiettivo)}</span>` : ""}${ov.chi_e ? `<span><b>Chi è</b> · ${esc(ov.chi_e)}</span>` : ""}</div>
  </section>
  <nav class="tabs">${tabs.map((t, i) => `<a href="#/c/${slug}/${t[0]}" class="${t[0] === tab ? "on" : ""}"><span class="n">${i + 1}</span>${t[1]}${t[2] ? `<span class="b ${t[3]}">${esc(t[2])}</span>` : ""}</a>`).join("")}</nav>
  <div id="tab"></div>`, d.nome);
  const el = $("#tab");
  if (tab === "overview") tOverview(el, d);
  if (tab === "lista") await tLista(el, d);
  if (tab === "copy") await tCopy(el, d);
  if (tab === "file") tFile(el, d);
}
function badge(d, s) {
  const has = s === "lista" ? d.ha_lista : d.ha_copy;
  if (!has) return ["—", ""];
  const e = d.esiti[s];
  if (!e) return ["da valutare", ""];
  return e.esito === "approvata" ? ["approvata", "ok"] : ["non approvata", "ko"];
}

/* ---- 1. overview: sì/no + sintesi */
function tOverview(el, d) {
  const ov = d.overview;
  if (!ov) { el.innerHTML = `<div class="empty"><b>Manca l'overview</b>Nessun file OVERVIEW+INCONSISTENCIES nella cartella.</div>`; return; }
  const n = ov.domande.length, f = ov.domande.filter(q => q.risposta).length;
  el.innerHTML = `
  <section class="blk">
    <h2 class="h2">Decidi</h2>
    <div class="prog"><span class="bar"><i style="width:${n ? f / n * 100 : 0}%"></i></span><span>${f} di ${n} risposte</span></div>
    <div class="qs">${ov.domande.map((q, i) => {
      const r = q.risposta?.risposta;
      return `<div class="q ${r ? "answered" : ""}" data-k="${q.chiave}">
        <span class="num">${i + 1}</span>
        <div><h3>${inline(q.domanda)}</h3>${q.perche ? `<p>${inline(q.perche)}</p>` : ""}
          ${q.se_si ? `<div class="si"><b>Sì =</b> ${inline(q.se_si)}</div>` : ""}
          ${r ? `<div class="by">${nomeDi(q.risposta.chi)} · ${quando(q.risposta.quando)}${q.risposta.nota ? ` · ${esc(q.risposta.nota)}` : ""}</div>` : ""}</div>
        <div class="yn"><button class="si ${r === "si" ? "on" : ""}" data-r="si">SÌ</button><button class="no ${r === "no" ? "on" : ""}" data-r="no">NO</button></div>
      </div>`; }).join("") || `<div class="empty">Nessuna domanda aperta.</div>`}</div>
  </section>
  <section class="blk">
    <h2 class="h2">In breve</h2><p class="sub">Solo se vuoi il contesto. Le risposte sopra bastano.</p>
    ${ov.punti.length ? `<div class="brief" style="margin-bottom:12px">${ov.punti.map(p => `<div class="row"><b>${inline(p.punto)}</b><span>${inline(p.azione)}</span></div>`).join("")}</div>` : ""}
    ${ov.prossimo ? fold("Prossimo passo", md(ov.prossimo), true) : ""}
    ${ov.incongruenze.length ? fold(`Incongruenze nei documenti <span class="chip">${ov.incongruenze.length}</span>`,
        (ov.incongruenze_intro ? `<p class="sub" style="margin:0 0 8px">${inline(ov.incongruenze_intro)}</p>` : "") +
        `<div class="brief">${ov.incongruenze.map(x => `<div class="row"><b>${inline(x.tema)}</b><span>${inline(x.versioni)}</span></div>`).join("")}</div>`) : ""}
    ${ov.regole ? fold("Regole del cliente", md(ov.regole)) : ""}
    ${ov.situazione ? fold("Cronologia", md(ov.situazione)) : ""}
  </section>`;
  $$(".q", el).forEach(qel => $$("button", qel).forEach(b => b.onclick = async () => {
    const q = ov.domande.find(x => x.chiave === qel.dataset.k);
    const nuova = q.risposta?.risposta === b.dataset.r ? "" : b.dataset.r;
    await api(`api/clienti/${d.slug}/risposta`, { chiave: q.chiave, domanda: q.domanda, risposta: nuova });
    toast(nuova ? `Salvato: ${nuova === "si" ? "Sì" : "No"}` : "Risposta tolta");
    delete S.clienti; route();
  }));
}
const fold = (t, body, open) => `<details class="fold" ${open ? "open" : ""}><summary>${t}</summary><div class="in md">${body}</div></details>`;

/* ---- verdetto (lista / copy) */
function verdict(d, sez) {
  const e = d.esiti[sez]; const L = sez === "lista" ? ["Approvata", "Non approvata", "La lista"] : ["Approvato", "Da rivedere", "Il copy"];
  return `<div class="verdict ${e ? (e.esito === "approvata" ? "ok" : "ko") : ""}" data-sez="${sez}">
    <div class="lbl">${L[2]} va bene?<small>${e ? `${nomeDi(e.chi)} · ${quando(e.quando)}` : "Un clic. La nota è facoltativa."}</small></div>
    <div class="btns"><button class="ap ${e?.esito === "approvata" ? "on" : ""}" data-e="approvata">✓ ${L[0]}</button>
      <button class="na ${e?.esito === "non_approvata" ? "on" : ""}" data-e="non_approvata">✗ ${L[1]}</button></div>
    <textarea placeholder="Nota (facoltativa): cosa cambiare, cosa va bene…">${esc(e?.nota || "")}</textarea>
    <button class="save">Salva nota</button>
  </div>`;
}
function bindVerdict(el, d) {
  $$(".verdict", el).forEach(v => {
    const sez = v.dataset.sez, ta = $("textarea", v);
    const save = async esito => {
      await api(`api/clienti/${d.slug}/esito`, { sezione: sez, esito, nota: ta.value });
      delete S.clienti; toast(esito ? "Salvato" : "Tolto"); route();
    };
    $$("[data-e]", v).forEach(b => b.onclick = () => save(d.esiti[sez]?.esito === b.dataset.e ? "" : b.dataset.e));
    $(".save", v).onclick = () => d.esiti[sez] ? save(d.esiti[sez].esito) : toast("Prima scegli ✓ o ✗");
  });
}

/* ---- note (su email o lead) */
function notesFor(d, sez, ancora) {
  return d.note.filter(n => n.sezione === sez && n.ancora === ancora);
}
function notesHtml(d, sez, ancora, label) {
  const N = notesFor(d, sez, ancora);
  return `<div class="notes" data-sez="${sez}" data-a="${esc(ancora)}" data-l="${esc(label)}">${N.map(n => `
    <div class="note ${n.risolta ? "res" : ""}"><div class="h"><b>${nomeDi(n.autore)}</b>${quando(n.creato)}
      ${S.me.chi === "whiz" ? `<button class="linkbtn" data-res="${n.id}" data-v="${n.risolta ? 0 : 1}">${n.risolta ? "riapri" : "risolta ✓"}</button>` : ""}</div>${esc(n.testo)}</div>`).join("")}</div>`;
}
function bindNotes(el, d) {
  $$("[data-res]", el).forEach(b => b.onclick = async e => {
    e.stopPropagation();
    await api(`api/clienti/${d.slug}/nota_risolvi`, { id: +b.dataset.res, risolta: b.dataset.v === "1" }); route();
  });
  $$("[data-addnote]", el).forEach(b => b.onclick = () => {
    const box = b.closest("[data-notebox]"); const nb = $(".notes", box);
    if ($(".noteform", box)) { $(".noteform textarea", box).focus(); return; }
    nb.insertAdjacentHTML("afterend", `<div class="noteform"><textarea placeholder="Scrivi la nota…"></textarea><button>Aggiungi</button></div>`);
    const f = $(".noteform", box); $("textarea", f).focus();
    $("button", f).onclick = async () => {
      const t = $("textarea", f).value.trim(); if (!t) return;
      await api(`api/clienti/${d.slug}/nota`, { sezione: nb.dataset.sez, ancora: nb.dataset.a, ancora_label: nb.dataset.l, testo: t });
      delete S.clienti; toast("Nota salvata"); route();
    };
  });
}

/* ---- 2. lista */
async function getLista(d) {
  if (!d.liste.length) return null;
  const k = d.slug + "|" + d.liste[0];
  if (!S.lista[k]) S.lista[k] = await api(`api/clienti/${d.slug}/lista?f=${encodeURIComponent(d.liste[0])}`);
  return S.lista[k];
}
async function tLista(el, d) {
  const lc = d.overview?.lista_copy || "";
  if (!d.liste.length) {
    el.innerHTML = `<div class="empty"><b>Nessun file lista da approvare</b>${lc ? `<div class="md" style="text-align:left;max-width:760px;margin:14px auto 0">${md(lc)}</div>` : ""}</div>`;
    return;
  }
  el.innerHTML = `<div class="skel" style="height:200px"></div>`;
  const L = await getLista(d);
  const cols = L.colonne, ix = Object.fromEntries(cols.map((c, i) => [c, i]));
  const pref = ["campagna", "company_name", "first_name", "last_name", "job_title", "email", "settore", "icp_colore", "email_status", "motivo"].filter(c => c in ix);
  const show = pref.length >= 4 ? pref : cols.slice(0, 8);
  const facets = ["campagna", "settore", "icp_colore", "email_status", "motivo"].filter(c => c in ix)
    .map(c => [c, count(L.righe.map(r => r[ix[c]]))]).filter(([, m]) => m.size > 1 && m.size <= 12);
  const st = S.ui["lista" + d.slug] ||= { f: {}, q: "", lim: 200, sort: null, all: false };
  const noted = new Set(d.note.filter(n => n.sezione === "lista").map(n => n.ancora));
  const label = c => ({ campagna: "Campagna", company_name: "Azienda", first_name: "Nome", last_name: "Cognome", job_title: "Ruolo", email: "Email", settore: "Settore", icp_colore: "ICP", email_status: "Email verificata", motivo: "Motivo" }[c] || c);
  const camp = facets.find(f => f[0] === "campagna");

  el.innerHTML = `${verdict(d, "lista")}
    <section class="blk">
      <div class="stats">
        <div class="stat"><b>${L.righe.length}</b><span>lead totali</span></div>
        ${camp ? [...camp[1]].sort().map(([v, n]) => `<div class="stat"><b>${n}</b><span>campagna ${esc(v)}</span></div>`).join("") : ""}
        ${"first_name" in ix ? `<div class="stat"><b>${L.righe.filter(r => r[ix.first_name]).length}</b><span>con nome e cognome</span></div>` : ""}
      </div>
      ${lc ? fold("Come è stata fatta la lista", md(lc)) : ""}
    </section>
    <section class="blk">
      <div class="filters">${facets.map(([c, m]) => `<div class="grp"><span>${label(c)}</span>${[...m].sort((a, b) => b[1] - a[1]).map(([v, n]) =>
        `<button class="fbtn ${st.f[c] === v ? "on" : ""}" data-c="${c}" data-v="${esc(v)}">${esc(v || "—")}<i>${n}</i></button>`).join("")}</div>`).join("")}</div>
      <div class="filters"><input class="search" placeholder="Cerca azienda, nome, email…" value="${esc(st.q)}">
        <button class="fbtn ${st.all ? "on" : ""}" id="allc">Tutte le colonne</button><span class="chip" id="cnt"></span></div>
      <div class="tblwrap"><table class="leads"><thead></thead><tbody></tbody></table></div>
      <button class="more" id="more" hidden></button>
      <p class="sub" style="margin-top:10px">Clic su una riga per vedere tutto e lasciare una nota sul lead · file: ${esc(L.file)}</p>
    </section>`;
  bindVerdict(el, d);
  const draw = () => {
    const vis = st.all ? cols : show;
    let rows = L.righe.filter(r => Object.entries(st.f).every(([c, v]) => r[ix[c]] === v));
    if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter(r => r.join(" ").toLowerCase().includes(q)); }
    if (st.sort) { const [c, dir] = st.sort; rows = [...rows].sort((a, b) => a[ix[c]].localeCompare(b[ix[c]], "it", { numeric: true }) * dir); }
    $("#cnt", el).textContent = `${rows.length} lead`;
    $("thead", el).innerHTML = "<tr>" + vis.map(c => `<th data-s="${c}">${esc(label(c))}${st.sort?.[0] === c ? (st.sort[1] > 0 ? " ↑" : " ↓") : ""}</th>`).join("") + "</tr>";
    $("tbody", el).innerHTML = rows.slice(0, st.lim).map(r => {
      const em = r[ix.email] || r[0];
      return `<tr data-i="${L.righe.indexOf(r)}" class="${noted.has("lead:" + em) ? "noted" : ""}">` + vis.map(c => `<td title="${esc(r[ix[c]])}">${cell(c, r[ix[c]])}</td>`).join("") + "</tr>";
    }).join("");
    const m = $("#more", el); m.hidden = rows.length <= st.lim; m.textContent = `Mostra tutti (${rows.length})`;
    $$("th", el).forEach(th => th.onclick = () => { const c = th.dataset.s; st.sort = st.sort?.[0] === c ? (st.sort[1] > 0 ? [c, -1] : null) : [c, 1]; draw(); });
    $$("tbody tr", el).forEach(tr => tr.onclick = () => leadDrawer(d, L, +tr.dataset.i));
  };
  $$(".fbtn[data-c]", el).forEach(b => b.onclick = () => {
    const c = b.dataset.c, v = b.dataset.v; st.f[c] === v ? delete st.f[c] : st.f[c] = v;
    $$(`.fbtn[data-c="${c}"]`, el).forEach(x => x.classList.toggle("on", st.f[c] === x.dataset.v)); draw();
  });
  $(".search", el).oninput = e => { st.q = e.target.value; draw(); };
  $("#allc", el).onclick = e => { st.all = !st.all; e.target.classList.toggle("on", st.all); draw(); };
  $("#more", el).onclick = () => { st.lim = 1e9; draw(); };
  draw();
}
function count(arr) { const m = new Map(); arr.forEach(v => m.set(v, (m.get(v) || 0) + 1)); return m; }
function cell(c, v) {
  if (!v) return `<span style="color:var(--ink3)">—</span>`;
  if (c === "campagna") return `<span class="tag c1">${esc(v)}</span>`;
  if (c === "icp_colore") return `<span class="tag ${v.toLowerCase()}">${esc(v)}</span>`;
  if (c === "email_status") return `<span class="tag ${/UNVERIFIED/.test(v) ? "warn" : "verde"}">${/UNVERIFIED/.test(v) ? "non verificabile" : "verificata"}</span>`;
  return esc(v);
}
function leadDrawer(d, L, i) {
  const r = L.righe[i], cols = L.colonne, ix = Object.fromEntries(cols.map((c, j) => [c, j]));
  const em = r[ix.email] || r[0], nome = [r[ix.first_name], r[ix.last_name]].filter(Boolean).join(" ");
  const dr = document.createElement("div"); dr.className = "drawer";
  dr.innerHTML = `<div class="pane" data-notebox>
    <button class="x" aria-label="Chiudi">✕</button>
    <h3>${esc(r[ix.company_name] || em)}</h3><p class="sub">${esc(nome || "casella aziendale")} · ${esc(em)}</p>
    <div style="margin:0 -12px">${notesHtml(d, "lista", "lead:" + em, (r[ix.company_name] || em))}</div>
    <button class="linkbtn" data-addnote>+ Nota su questo lead</button>
    <dl class="kv">${cols.map((c, j) => r[j] ? `<dt>${esc(c)}</dt><dd>${/^https?:/.test(r[j]) ? `<a href="${esc(r[j])}" target="_blank" rel="noopener">${esc(r[j])}</a>` : esc(r[j])}</dd>` : "").join("")}</dl>
  </div>`;
  document.body.appendChild(dr);
  const close = () => { dr.remove(); document.removeEventListener("keydown", k); };
  const k = e => e.key === "Escape" && close();
  document.addEventListener("keydown", k);
  dr.onclick = e => e.target === dr && close();
  $(".x", dr).onclick = close;
  bindNotes(dr, d);
}

/* ---- 3. copy */
async function tCopy(el, d) {
  if (!d.copy.length) {
    const lc = d.overview?.lista_copy || "";
    el.innerHTML = `<div class="empty"><b>Nessun copy da approvare</b>${lc ? `<div class="md" style="text-align:left;max-width:760px;margin:14px auto 0">${md(lc)}</div>` : ""}</div>`;
    return;
  }
  const st = S.ui["copy" + d.slug] ||= { doc: 0, camp: 0, mode: "testo" };
  const cp = d.copy[st.doc] || d.copy[0];
  if (cp.errore) { el.innerHTML = `<div class="empty"><b>Non riesco a leggere ${esc(cp.file)}</b>${esc(cp.errore)}</div>`; return; }
  const L = await getLista(d).catch(() => null);
  let perCamp = null;
  if (L && L.colonne[0] === "campagna") perCamp = count(L.righe.map(r => r[0]));
  st.camp = Math.min(st.camp, cp.campagne.length - 1);
  const camp = cp.campagne[st.camp];
  const ex = esempio(d, cp, camp);
  const firma = cp.firma || defaultFirma(d);

  el.innerHTML = `${verdict(d, "copy")}
  ${d.copy.length > 1 ? `<div class="camps">${d.copy.map((c, i) => `<button class="camp ${i === st.doc ? "on" : ""}" data-doc="${i}"><b>${esc(c.titolo || c.file)}</b></button>`).join("")}</div>` : ""}
  <div class="copylay">
    <div>
      <h2 class="h2">${esc(cp.titolo)}</h2>
      ${cp.intro ? `<div class="md sub" style="color:var(--ink2)">${md(cp.intro)}</div>` : ""}
      ${cp.campagne.length > 1 ? `<div class="camps">${cp.campagne.map((c, i) => `<button class="camp ${i === st.camp ? "on" : ""}" data-camp="${i}">
          <b>Campagna ${esc(c.nome)}</b><span>${perCamp?.get(c.nome) != null ? perCamp.get(c.nome) + " lead · " : ""}${c.passi.length} email${c.passi.some(p => p.varianti.length > 1) ? " · A/B" : ""}</span></button>`).join("")}</div>` : ""}
      ${camp.descr ? `<p class="cdesc">${esc(camp.descr)}</p>` : ""}
      ${camp.intro ? `<div class="md cdesc">${md(camp.intro)}</div>` : ""}
      <div class="mode"><button data-m="testo" class="${st.mode === "testo" ? "on" : ""}">Con le variabili</button><button data-m="esempio" class="${st.mode === "esempio" ? "on" : ""}">Esempio compilato</button></div>
      ${st.mode === "esempio" ? `<p class="mode-note">${ex.vero ? `Lead vero dalla lista: <b>${esc(ex.v.companyName)}</b>${ex.v.firstName ? " · " + esc(ex.v.firstName) : ""} (${esc(ex.v.email || "")})` : "Esempio illustrativo: nome e azienda inventati."} In giallo i dati inseriti, in rosso quelli che mancano.</p>` : ""}
      <div class="seq">${camp.passi.map((p, pi) => step(d, cp, camp, p, pi, st.mode === "esempio" ? ex.v : null, firma)).join("")}</div>
    </div>
    <aside class="aside">
      ${cp.perche.map(x => `<div class="box"><h4>Perché questo copy</h4><div class="md"><p><b>${inline(x.titolo)}</b></p>${md(x.md)}</div></div>`).join("")}
      ${cp.note ? `<div class="box"><h4>Note</h4><div class="md">${md(cp.note)}</div></div>` : ""}
      ${cp.variabili ? `<div class="box"><h4>Variabili</h4><div class="md">${inline(cp.variabili)}</div></div>` : ""}
    </aside>
  </div>`;
  bindVerdict(el, d); bindNotes(el, d);
  $$("[data-camp]", el).forEach(b => b.onclick = () => { st.camp = +b.dataset.camp; tCopy(el, d); });
  $$("[data-doc]", el).forEach(b => b.onclick = () => { st.doc = +b.dataset.doc; st.camp = 0; tCopy(el, d); });
  $$("[data-m]", el).forEach(b => b.onclick = () => { st.mode = b.dataset.m; tCopy(el, d); });
}
function defaultFirma(d) { return d.slug === "mirlo" ? "Miriana Lomartire · Mirlo's Company" : d.nome; }
function esempio(d, cp, camp) {
  const real = d.esempio && (d.esempio[camp.nome] || d.esempio.B);
  if (real) return { vero: true, v: real };
  // nessuna lista: esempio illustrativo, il settore preso dalla tabella del copy
  const rows = (cp.intro.match(/^\|.+\|$/gm) || []).map(r => r.replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
  const sett = rows.find(r => r.length >= 3 && !/^-+$/.test(r[0]) && !/campagna/i.test(r[0]));
  return { vero: false, v: { firstName: "Marco", companyName: "Rossi Costruzioni", settore: sett ? sett[2] : "aziende del settore" } };
}
function step(d, cp, camp, p, pi, ex, firma) {
  const n = p.varianti.length;
  const day = p.giorno ?? (pi === 0 ? 0 : null);
  const title = p.base.replace(/\s*\(giorno[^)]*\)/i, "").replace(/\s*·\s*giorno\s*\d+/i, "").replace(/\s*·\s*A\/B test/i, "");
  const sub = (p.varianti[0].titolo.match(/\(giorno\s*\d+,\s*([^)]+)\)/i) || p.base.match(/giorno\s*\d+\s*·\s*(.+)$/i) || [])[1] || "";
  return `<div class="step">
    <div class="day"><small>giorno</small>${day ?? "–"}</div>
    <h3>${esc(title)}${n > 1 ? `<span class="chip c1 ab">A/B · ${n} varianti</span>` : ""}${sub ? ` <span class="chip">${esc(sub)}</span>` : ""}</h3>
    <div class="vars n${Math.min(n, 3)}">${p.varianti.map(v => mail(d, camp, p, v, ex, firma)).join("")}</div>
  </div>`;
}
function mail(d, camp, p, v, ex, firma) {
  const ancora = `${camp.nome}|${p.base}|${v.variante || ""}`;
  const label = `Campagna ${camp.nome} · ${p.base}${v.variante ? " · " + v.variante : ""}`;
  const vm = (v.variante || "").match(/^(\S+)\s*(?:\((.+)\))?/);
  return `<div class="mail" data-notebox>
    ${v.variante ? `<div class="vh"><span class="tag c1">${esc(vm[1])}</span><span class="vn">${esc(vm[2] || "")}</span></div>` : ""}
    ${v.oggetti.length ? `<div class="subj">Oggetto${v.oggetti.length > 1 ? " (A/B)" : ""}: ${v.oggetti.map(o => `<span class="alt"><b>${fill(o, ex, firma)}</b></span>`).join(" / ")}</div>`
      : `<div class="subj"><i>stessa conversazione, senza oggetto</i></div>`}
    <div class="txt">${fill(v.corpo, ex, firma)}</div>
    ${v.note.length ? `<div class="mn">${v.note.map(x => `<p>${inline(x)}</p>`).join("")}</div>` : ""}
    ${notesHtml(d, "copy", ancora, label)}
    <div class="act"><button class="linkbtn" data-addnote>+ Nota su questa email</button>
      ${notesFor(d, "copy", ancora).length ? `<span class="chip">${notesFor(d, "copy", ancora).length} note</span>` : ""}</div>
  </div>`;
}
function fill(text, ex, firma) {
  let h = esc(text).replace(/\*\*(.+?)\*\*/g, "$1");
  h = h.replace(/\{\{(\w+)\}\}|\[(settore)\]/g, (m, a, b) => {
    const k = a || b;
    if (k === "accountSignature") return ex ? `<span class="v fill">${esc(firma)}</span>` : `<span class="v">{{accountSignature}}</span>`;
    if (!ex) return `<span class="v">${esc(m)}</span>`;
    const val = ex[k];
    return val ? `<span class="v fill">${esc(val)}</span>` : `<span class="v miss">${k === "firstName" ? "nome mancante" : "manca " + esc(k)}</span>`;
  });
  return h;
}

/* ---- altri file */
function tFile(el, d) {
  el.innerHTML = `<div class="files">${d.altri.map(f => {
    const u = `api/clienti/${d.slug}/file?f=${encodeURIComponent(f)}`;
    return `<a class="file" href="${u}" target="_blank" rel="noopener">${/\.(png|jpe?g|webp|gif)$/i.test(f) ? `<img src="${u}" alt="">` : ""}<b>${esc(f)}</b></a>`;
  }).join("")}</div>`;
}

/* ---------------- router */
async function route() {
  try {
    if (!S.me) S.me = await api("api/me");
    if (!S.clienti) S.clienti = await api("api/clienti");
    const h = location.hash.replace(/^#\/?/, "").split("/");
    const y = scrollY;
    if (h[0] === "c" && h[1]) await pCliente(h[1], h[2]);
    else await pHome();
    if (route.keep) scrollTo(0, y); route.keep = false;
  } catch (e) {
    if (e.message === "accesso") { setBrand(null); root.innerHTML = `<div class="login"><h1>Vendorius Cockpit</h1><p>Apri il link personale che ti ha mandato Whiz.</p></div>`; return; }
    root.innerHTML = `<div class="login"><h1>Qualcosa non va</h1><p>${esc(e.message)}</p></div>`;
  }
}
// dopo un salvataggio restiamo nello stesso punto della pagina
const _api = api;
window.addEventListener("hashchange", () => { route.keep = false; route(); scrollTo(0, 0); });
document.addEventListener("click", e => { if (e.target.closest("button")) route.keep = true; }, true);
route();
