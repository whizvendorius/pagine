/* Versione pubblicata (GitHub Pages). Risposte, esiti e note vivono su Supabase (progetto Vendorius)
   e arrivano in diretta a tutti quelli che hanno la pagina aperta.
   Ordine script: supabase.js → dati.js → statico.js → app.js.  Chi sei: ?chi=whiz|matteo|monica */
(() => {
  const D = window.DATI, C = window.SUPA, KEY = "vc-risposte-v1";
  const NOMI = { whiz: "Whiz", matteo: "Matteo", monica: "Monica" };
  const qs = new URLSearchParams(location.search);
  let chi = (qs.get("chi") || "").toLowerCase();
  try { if (NOMI[chi]) localStorage.setItem("vc-chi", chi); else chi = localStorage.getItem("vc-chi") || C.chi_default || ""; } catch {}
  if (!NOMI[chi]) chi = C.chi_default || "matteo";
  const sb = window.supabase.createClient(C.url, C.anon);
  const st = { risposte: {}, esiti: {}, note: {} };
  const ora = () => { const d = new Date(), p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

  const put = {
    risposte: r => (st.risposte[r.slug] ||= {})[r.chiave] = r,
    esiti: r => (st.esiti[r.slug] ||= {})[r.sezione] = r,
    note: r => { const N = st.note[r.slug] ||= []; const i = N.findIndex(n => n.id == r.id); i < 0 ? N.push(r) : N[i] = r; N.sort((a, b) => a.id - b.id); },
  };
  const del = {
    risposte: r => { delete (st.risposte[r.slug] || {})[r.chiave]; },
    esiti: r => { delete (st.esiti[r.slug] || {})[r.sezione]; },
    note: r => { for (const s in st.note) st.note[s] = st.note[s].filter(n => n.id != r.id); },
  };

  async function carica() {
    for (const t of ["risposte", "esiti", "note"]) {
      const { data, error } = await sb.from(t).select("*");
      if (error) throw new Error("database: " + error.message);
      data.forEach(put[t]);
    }
  }
  /* risposte rimaste solo nel browser (versione vecchia) → nel database, una volta sola */
  async function svuotaVecchie() {
    let old; try { old = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
    if (!old) return;
    const R = [], E = [], N = [];
    for (const s in old.risposte || {}) for (const k in old.risposte[s]) if (!st.risposte[s]?.[k]) R.push({ slug: s, ...old.risposte[s][k] });
    for (const s in old.esiti || {}) for (const k in old.esiti[s]) if (!st.esiti[s]?.[k]) E.push({ slug: s, ...old.esiti[s][k] });
    for (const s in old.note || {}) for (const n of old.note[s]) if (!(st.note[s] || []).some(x => x.id == n.id)) N.push({ slug: s, ...n });
    if (R.length) await sb.from("risposte").upsert(R, { ignoreDuplicates: true });
    if (E.length) await sb.from("esiti").upsert(E, { ignoreDuplicates: true });
    if (N.length) await sb.from("note").upsert(N, { ignoreDuplicates: true });
    R.forEach(put.risposte); E.forEach(put.esiti); N.forEach(put.note);
    try { localStorage.setItem(KEY + "-inviate", localStorage.getItem(KEY)); localStorage.removeItem(KEY); } catch {}
  }
  const pronto = carica().then(svuotaVecchie);

  /* ---- diretta: ogni modifica di chiunque arriva qui */
  let attesa = null;
  function ridisegna() {
    clearTimeout(attesa);
    const a = document.activeElement;
    if (a && /TEXTAREA|INPUT/.test(a.tagName) && a.value) { attesa = setTimeout(ridisegna, 1500); return; }
    attesa = setTimeout(() => { if (window.route) { route.keep = true; route(); } }, 120);
  }
  sb.channel("cockpit").on("postgres_changes", { event: "*", schema: "public" }, p => {
    const t = p.table, prima = JSON.stringify(st);
    if (!put[t]) return;
    if (p.eventType === "DELETE") del[t](p.old); else put[t](p.new);
    if (JSON.stringify(st) === prima) return;
    const da = p.new?.chi || p.new?.autore;
    if (da && da !== chi && window.toast) toast(`${NOMI[da] || da} ha aggiornato ${D.clienti[p.new.slug]?.nome || ""}`);
    ridisegna();
  }).subscribe();

  async function scrivi(t, riga, cancella) {
    const q = cancella ? sb.from(t).delete().match(cancella) : sb.from(t).upsert(riga);
    const { error } = await q;
    if (error) throw new Error("salvataggio non riuscito: " + error.message);
  }

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
  const ko = e => new Response(JSON.stringify({ errore: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  const _fetch = window.fetch.bind(window);
  window.fetch = async (url, opt = {}) => {
    const u = new URL(url, location.href);
    const m = u.pathname.match(/\/api\/(.*)$/);
    if (!m) return _fetch(url, opt);
    try { await pronto; } catch (e) { return ko(e); }
    const p = m[1].split("/"), body = opt.body ? JSON.parse(opt.body) : null;
    if (p[0] === "me") return ok({ chi, nome: NOMI[chi] });
    if (p[0] === "clienti" && !p[1]) return ok(D.ordine.map(s => { const d = det(s);
      for (const k of ["overview", "copy", "note", "liste", "esempio"]) delete d[k]; d.altri = 0; return d; }));
    const slug = p[1];
    if (!D.clienti[slug]) return new Response("{}", { status: 404 });
    if (!p[2]) return ok(det(slug));
    if (p[2] === "lista") return ok(D.liste[slug]);
    try {
      if (p[2] === "risposta") {
        if (body.risposta) { const r = { slug, chiave: body.chiave, domanda: body.domanda, risposta: body.risposta, chi, quando: ora() };
          await scrivi("risposte", r); put.risposte(r); }
        else { await scrivi("risposte", null, { slug, chiave: body.chiave }); del.risposte({ slug, chiave: body.chiave }); }
      } else if (p[2] === "esito") {
        if (body.esito) { const r = { slug, sezione: body.sezione, esito: body.esito, nota: body.nota || "", chi, quando: ora() };
          await scrivi("esiti", r); put.esiti(r); }
        else { await scrivi("esiti", null, { slug, sezione: body.sezione }); del.esiti({ slug, sezione: body.sezione }); }
      } else if (p[2] === "nota") {
        const r = { id: Date.now(), slug, sezione: body.sezione, ancora: body.ancora, ancora_label: body.ancora_label, testo: body.testo, autore: chi, creato: ora(), risolta: 0 };
        await scrivi("note", r); put.note(r);
      } else if (p[2] === "nota_risolvi") {
        const n = (st.note[slug] || []).find(x => x.id == body.id);
        if (n) { const r = { ...n, risolta: body.risolta ? 1 : 0 }; await scrivi("note", r); put.note(r); }
      }
    } catch (e) { return ko(e); }
    return ok({ ok: true });
  };
})();
