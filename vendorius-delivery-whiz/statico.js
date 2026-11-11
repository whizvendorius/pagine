/* Versione pubblicata (GitHub Pages): niente server. Le risposte restano nel browser di Matteo
   e partono verso Whiz col tasto "Manda a Whiz" (WhatsApp). Va caricato DOPO dati.js e PRIMA di app.js. */
(() => {
  const D = window.DATI, KEY = "vc-risposte-v1";
  let st; try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { st = {}; }
  st.risposte ||= {}; st.esiti ||= {}; st.note ||= {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  const ora = () => { const d = new Date(), p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

  function det(slug) {
    const d = JSON.parse(JSON.stringify(D.clienti[slug]));
    const R = st.risposte[slug] || {}, E = st.esiti[slug] || {}, N = st.note[slug] || [];
    if (d.overview) d.overview.domande.forEach(q => q.risposta = R[q.chiave] || null);
    d.esiti = E; d.note = N;
    d.domande_fatte = d.overview ? d.overview.domande.filter(q => R[q.chiave]).length : 0;
    d.valutate = d.da_valutare.filter(s => E[s]).length;
    d.note_aperte = N.filter(n => !n.risolta).length;
    return d;
  }
  const ok = j => new Response(JSON.stringify(j), { status: 200, headers: { "Content-Type": "application/json" } });
  const _fetch = window.fetch.bind(window);
  window.fetch = async (url, opt = {}) => {
    const u = new URL(url, location.href);
    const m = u.pathname.match(/\/api\/(.*)$/);
    if (!m) return _fetch(url, opt);
    const p = m[1].split("/"), body = opt.body ? JSON.parse(opt.body) : null;
    if (p[0] === "me") return ok({ chi: "matteo", nome: "Matteo" });
    if (p[0] === "clienti" && !p[1]) return ok(D.ordine.map(s => { const d = det(s);
      for (const k of ["overview", "copy", "note", "liste", "esempio"]) delete d[k]; d.altri = 0; return d; }));
    const slug = p[1];
    if (!D.clienti[slug]) return new Response("{}", { status: 404 });
    if (!p[2]) return ok(det(slug));
    if (p[2] === "lista") return ok(D.liste[slug]);
    if (p[2] === "risposta") { const R = st.risposte[slug] ||= {};
      if (body.risposta) R[body.chiave] = { chiave: body.chiave, domanda: body.domanda, risposta: body.risposta, chi: "matteo", quando: ora() };
      else delete R[body.chiave]; save(); bump(); return ok({ ok: true }); }
    if (p[2] === "esito") { const E = st.esiti[slug] ||= {};
      if (body.esito) E[body.sezione] = { sezione: body.sezione, esito: body.esito, nota: body.nota || "", chi: "matteo", quando: ora() };
      else delete E[body.sezione]; save(); bump(); return ok({ ok: true }); }
    if (p[2] === "nota") { const N = st.note[slug] ||= [];
      N.push({ id: Date.now(), sezione: body.sezione, ancora: body.ancora, ancora_label: body.ancora_label, testo: body.testo, autore: "matteo", creato: ora(), risolta: 0 });
      save(); bump(); return ok({ ok: true }); }
    return ok({ ok: true });
  };

  /* ---- tasto "Manda a Whiz" */
  function testo() {
    const out = ["Ciao Whiz, ecco le mie risposte dal cockpit:", ""];
    for (const s of D.ordine) {
      const d = det(s), righe = [];
      (d.overview?.domande || []).forEach((q, i) => q.risposta && righe.push(`${i + 1}. ${q.domanda.replace(/\*\*/g, "")} → ${q.risposta.risposta === "si" ? "SÌ" : "NO"}`));
      for (const [sez, e] of Object.entries(d.esiti)) righe.push(`${sez === "lista" ? "Lista" : "Copy"}: ${e.esito === "approvata" ? "APPROVATO ✓" : "DA RIVEDERE ✗"}${e.nota ? ` (nota: ${e.nota})` : ""}`);
      d.note.forEach(n => righe.push(`Nota su ${n.ancora_label}: ${n.testo}`));
      if (righe.length) out.push(`*${d.nome}*`, ...righe, "");
    }
    return out.length > 2 ? out.join("\n") : "";
  }
  function quante() { return D.ordine.reduce((n, s) => { const d = det(s); return n + d.domande_fatte + d.valutate + d.note.length; }, 0); }
  const btn = document.createElement("button");
  btn.className = "sendwa";
  btn.onclick = async () => {
    const t = testo();
    if (!t) { alertSoft("Ancora nessuna risposta da mandare."); return; }
    try { await navigator.clipboard.writeText(t); } catch {}
    window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank");
  };
  function alertSoft(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2000); }
  function bump() { const n = quante(); btn.innerHTML = `Manda le risposte a Whiz <i>${n}</i>`; btn.classList.toggle("on", n > 0); }
  /* tasto tolto su richiesta di Whiz (10/11) */
})();
