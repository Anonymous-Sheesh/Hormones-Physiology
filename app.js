/* Hormone Rush: drill the hormone MCQs solo or with your partner on a call.
   Solo: one phone. On call: you answer on your phone, she sees the right answers,
   the reason and a line to say, and presses Next. Wrong answers come back a few
   questions later; a question is mastered after 2 correct answers in a row. */
(() => {
  "use strict";
  const QS = window.QS, TOPICS = window.TOPICS, HOOKS = window.HOOKS;
  const BYID = Object.fromEntries(QS.map((q) => [q.id, q]));
  const API = String(window.HR_API || "");
  const ONLINE = /^https:\/\//.test(API);
  const app = document.getElementById("app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const sess = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const clock = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const L = (i) => "ABCDEFGH"[i];

  // ---------- progress ----------
  let prog = store.get("hr:prog", {});
  let prefs = Object.assign({ style: "clean", topics: Object.keys(TOPICS), quick: true, extras: false }, store.get("hr:prefs", {}));
  const inPlay = (q) => prefs.extras || q.src !== "extra";
  const saveProg = () => store.set("hr:prog", prog);
  const savePrefs = () => store.set("hr:prefs", prefs);
  const rec = (id) => prog[id] || { seen: 0, right: 0, streak: 0 };
  const mastered = (id) => rec(id).streak >= 2;
  const record = (id, ok) => {
    const r = rec(id); r.seen++; if (ok) { r.right++; r.streak++; } else r.streak = 0;
    prog[id] = r; saveProg();
  };
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

  // ---------- session (queue) ----------
  const buildQueue = (topics, onlyWeak) => {
    const pool = QS.filter((q) => topics.includes(q.t) && inPlay(q) && (!onlyWeak || !mastered(q.id)));
    const unseen = shuffle(pool.filter((q) => !rec(q.id).seen)), weak = shuffle(pool.filter((q) => rec(q.id).seen && !mastered(q.id))), done = shuffle(pool.filter((q) => mastered(q.id)));
    return [...weak, ...unseen, ...done].map((q) => q.id);
  };
  // after an answer: wrong → back in 3 and again in 8; first correct (not yet mastered) → once more near the end
  const requeue = (S, id, ok) => {
    const at = (n) => Math.min(S.i + 1 + n, S.queue.length);
    if (!ok) { S.queue.splice(at(3), 0, id); S.queue.splice(at(8), 0, id); }
    else if (!mastered(id) && !S.again[id]) { S.again[id] = 1; S.queue.splice(at(Math.max(10, Math.floor((S.queue.length - S.i) / 2))), 0, id); }
  };

  // ---------- nudges ----------
  const NUDGES = {
    clean: ["Phones down, brains on 📚", "Read the WHOLE question. 'NOT' is hiding in there.", "Say the reason out loud, not just the letter.", "Less chat, more hormones.", "Exam is tomorrow. Lock in.", "Two in a row = mastered. Go."],
    spicy: ["Stop e-sexing and study 📚", "Horny later. Hormones now.", "The only hormone you need tonight is the one on the screen.", "Pants on. Aldosterone first.", "Sexting detected. Back to the pituitary.", "Get it right twice, then you can get it on twice 😏", "Prolactin kills your sex drive. So does failing tomorrow."]
  };
  const ROASTS = {
    clean: ["{m} minutes gone and only {n} mastered. Speed up, legend.", "{m} minutes. The exam won't wait. Next question, now.", "{m} minutes. Even the pituitary is bored. Lock in."],
    spicy: ["{m} minutes gone and only {n} mastered. Don't tell me you still haven't learnt shit.", "{m} minutes. She could've finished twice by now. Answer the damn question.", "{m} minutes. Pathetic. Hormones in, phone down."]
  };
  const toast = (text, cls) => {
    const t = document.createElement("div");
    t.className = "toast" + (cls ? " " + cls : ""); t.textContent = text;
    document.body.appendChild(t); setTimeout(() => t.remove(), cls === "nudge" ? 6000 : 3800);
  };

  // ---------- question card ----------
  const qCard = (S, opts) => {
    const q = BYID[S.queue[S.i]], picks = S.picks || [], done = S.submitted;
    const ok = done && sameSet(picks, q.a);
    const multi = q.a.length > 1;
    const optCls = (i) => {
      if (opts.her && !done) return (q.a.includes(i) ? " right-key" : "") + (picks.includes(i) ? " picked" : "");
      if (!done) return picks.includes(i) ? " picked" : "";
      return q.a.includes(i) ? (picks.includes(i) ? " right" : " missed") : picks.includes(i) ? " wrong" : " dim";
    };
    const hook = (HOOKS[q.t] || {})[(S.style || prefs.style) === "spicy" ? "spicy" : "clean"];
    const quick = S.quick !== undefined ? S.quick : prefs.quick;
    return `
      <div class="qhead"><span class="tag">${esc(TOPICS[q.t])}</span>${q.src === "extra" ? `<span class="tag soft">extra</span>` : ""}${opts.her ? "" : `<span class="tag soft">${mastered(q.id) ? "mastered ✓" : rec(q.id).seen ? `${rec(q.id).right}/${rec(q.id).seen} right` : "new"}</span>`}</div>
      <h2 class="q">${esc(q.q)}</h2>
      <p class="hint">${opts.her && !done ? `The right answer${multi ? "s are" : " is"} marked ✓. Don’t tell him (yet).` : multi ? "Choose all that apply." : "Choose all that apply (this one has one answer)."}</p>
      <div class="opts">${q.o.map((o, i) => `<button type="button" class="opt${optCls(i)}" data-opt="${i}" ${done || opts.her ? "disabled" : ""}><span class="ol">${L(i)}</span><span>${esc(o)}</span>${opts.her && !done && q.a.includes(i) ? `<span class="ok">✓</span>` : ""}</button>`).join("")}</div>
      ${done ? `
        <div class="verdict ${ok ? "good" : "bad"}">${ok ? "Correct ✓" : `Not quite. Answer: ${q.a.map(L).join(" + ")}`}</div>
        ${quick ? `<p class="answer">✓ ${q.a.map((i) => `<b>${L(i)}</b> ${esc(q.o[i])}`).join("<br>✓ ")}</p>` : `<p class="why">${esc(q.why)}</p>`}
        ${q.key ? `<p class="keynote">📋 ${esc(q.key)}</p>` : ""}
        ${hook && !quick ? `<p class="hook">${opts.her ? "Say this: " : "💡 "}${esc(hook)}</p>` : ""}` : opts.her && hook && !quick ? `<p class="hook">After he answers, say: ${esc(hook)}</p>` : ""}`;
  };
  const statsBar = (S) => {
    const tot = QS.filter((q) => S.topics.includes(q.t) && (S.extras || q.src !== "extra")).length;
    const m = S.mcount !== undefined && S.her ? S.mcount : QS.filter((q) => S.topics.includes(q.t) && (S.extras || q.src !== "extra") && mastered(q.id)).length;
    return `<div class="stats"><span>⏱ <b class="st-time">${clock((Date.now() - S.t0) / 1000)}</b></span><span>answered <b>${S.answered}</b></span><span>right <b>${S.right}</b></span><span>mastered <b>${m}/${tot}</b></span></div>
      <div class="bar"><i style="width:${(100 * m) / Math.max(1, tot)}%"></i></div>`;
  };

  // ---------- timers ----------
  let timer = null;
  const startTick = (fn) => { clearInterval(timer); timer = setInterval(fn, 1000); };

  // ---------- home ----------
  const home = () => {
    clearInterval(timer);
    const all = QS.filter(inPlay), tot = all.length, m = all.filter((q) => mastered(q.id)).length, seen = all.filter((q) => rec(q.id).seen).length;
    app.innerHTML = `
      <main class="wrap">
        <p class="meta">Physiology · hormones · MCQ</p>
        <h1>Hormone Rush</h1>
        <p class="lede">All the hormone MCQs from your question banks, answers checked. Get each one right twice in a row and it’s mastered. Wrong ones come back a few questions later until they stick.</p>
        <div class="kpis"><div><b>${m}/${tot}</b><span>mastered</span></div><div><b>${seen}/${tot}</b><span>seen</span></div></div>
        <div class="seg" role="group" aria-label="Style">
          <button type="button" data-style="clean" aria-pressed="${prefs.style === "clean"}">Clean</button>
          <button type="button" data-style="spicy" aria-pressed="${prefs.style === "spicy"}">Spicy 18+</button>
        </div>
        <label class="sw"><input type="checkbox" data-pref="quick" ${prefs.quick ? "checked" : ""}> <span><b>Answers only</b>: no explanations, just the question and the right answer</span></label>
        <label class="sw"><input type="checkbox" data-pref="extras" ${prefs.extras ? "checked" : ""}> <span>Include my 16 extra questions (not from your banks)</span></label>
        <h3>Topics</h3>
        <div class="topics">${Object.entries(TOPICS).map(([k, name]) => {
          const qs = QS.filter((q) => q.t === k && inPlay(q)), mm = qs.filter((q) => mastered(q.id)).length;
          return `<button type="button" class="topic${prefs.topics.includes(k) ? " on" : ""}" data-topic="${k}"><span>${esc(name)}</span><small>${mm}/${qs.length}</small></button>`;
        }).join("")}</div>
        <div class="row"><button class="btn small ghost" data-all>All</button><button class="btn small ghost" data-none>None</button></div>
        <div class="actions">
          <button class="btn" data-go="cram" ${prefs.topics.length ? "" : "disabled"}>⚡ Cram: flashcards (fastest)</button>
          <button class="btn" data-go="solo" ${prefs.topics.length ? "" : "disabled"}>Quiz solo</button>
          <button class="btn" data-go="call" ${prefs.topics.length ? "" : "disabled"}>Study on call</button>
          <button class="btn ghost" data-go="weak" ${prefs.topics.length ? "" : "disabled"}>Only what I haven’t mastered</button>
        </div>
        <p class="hint">Tonight: ⚡ Cram once through (≈ 25 min), then Quiz or Study on call until it’s all ✓. The app tells you to sleep after 60 minutes.</p>
        <p class="hint">“extra” questions cover hormones your banks barely ask about (PTH, vitamin D, sex hormones). 📋 notes show where the shared answer sheet disagrees with the textbook.</p>
        <p class="hint"><button class="linkbtn" data-reset>Reset my progress</button></p>
      </main>`;
    app.onclick = (ev) => {
      const t = ev.target.closest("[data-topic]");
      if (t) { const k = t.dataset.topic; prefs.topics = prefs.topics.includes(k) ? prefs.topics.filter((x) => x !== k) : [...prefs.topics, k]; savePrefs(); return home(); }
      const pf = ev.target.closest("[data-pref]"); if (pf) { prefs[pf.dataset.pref] = pf.checked; savePrefs(); return home(); }
      const st = ev.target.closest("[data-style]"); if (st) { prefs.style = st.dataset.style; savePrefs(); return home(); }
      if (ev.target.closest("[data-all]")) { prefs.topics = Object.keys(TOPICS); savePrefs(); return home(); }
      if (ev.target.closest("[data-none]")) { prefs.topics = []; savePrefs(); return home(); }
      if (ev.target.closest("[data-reset]")) { if (confirm("Reset all your progress?")) { prog = {}; saveProg(); home(); } return; }
      const g = ev.target.closest("[data-go]"); if (!g) return;
      if (g.dataset.go === "call") return openRoom();
      if (g.dataset.go === "cram") return cram();
      solo(g.dataset.go === "weak");
    };
  };

  // ---------- solo ----------
  const solo = (onlyWeak) => {
    const S = { queue: buildQueue(prefs.topics, onlyWeak), i: 0, picks: [], submitted: false, again: {}, t0: Date.now(), answered: 0, right: 0, topics: prefs.topics.slice(), style: prefs.style, quick: prefs.quick, extras: prefs.extras };
    let lastNudge = Date.now(), roasts = 0;
    const draw = () => {
      if (S.i >= S.queue.length) return finish();
      app.innerHTML = `<main class="wrap">${statsBar(S)}${qCard(S, {})}
        <div class="actions">${S.submitted ? `<button class="btn" data-next>Next</button>` : `<button class="btn" data-submit ${S.picks.length ? "" : "disabled"}>Check</button>`}<button class="btn ghost" data-home>Stop</button></div></main>`;
    };
    const finish = () => {
      clearInterval(timer);
      app.innerHTML = `<main class="wrap">${statsBar(S)}<h1>Done 🔥</h1><p class="lede">${S.right} of ${S.answered} right in ${clock((Date.now() - S.t0) / 1000)}. Go again with “Only what I haven’t mastered” until everything is ✓.</p><div class="actions"><button class="btn" data-home>Home</button></div></main>`;
    };
    app.onclick = (ev) => {
      if (ev.target.closest("[data-home]")) return home();
      const o = ev.target.closest("[data-opt]");
      if (o && !S.submitted) { const i = Number(o.dataset.opt); S.picks = S.picks.includes(i) ? S.picks.filter((x) => x !== i) : [...S.picks, i]; return draw(); }
      if (ev.target.closest("[data-submit]")) {
        const id = S.queue[S.i], ok = sameSet(S.picks, BYID[id].a);
        S.submitted = true; S.answered++; if (ok) S.right++;
        requeue(S, id, ok); record(id, ok); return draw();
      }
      if (ev.target.closest("[data-next]")) { S.i++; S.picks = []; S.submitted = false; return draw(); }
    };
    startTick(() => {
      const t = app.querySelector(".st-time"); if (t) t.textContent = clock((Date.now() - S.t0) / 1000);
      sleepGuard(S.t0);
      const mins = Math.floor((Date.now() - S.t0) / 600000);
      if (mins > roasts) { roasts = mins; lastNudge = Date.now(); const r = ROASTS[S.style]; toast("⏰ " + r[Math.min(mins - 1, r.length - 1)].replace("{m}", mins * 10).replace("{n}", QS.filter((q) => mastered(q.id)).length), "nudge"); }
      else if (Date.now() - lastNudge > 180000) { lastNudge = Date.now(); const n = NUDGES[S.style]; toast(n[Math.floor(Math.random() * n.length)], "nudge"); }
    });
    draw();
  };

  // ---------- sleep guard: after 60 minutes, tell him to go to bed ----------
  let sleepShown = 0;
  const sleepGuard = (t0) => {
    const mins = (Date.now() - t0) / 60000;
    if (mins < 60 + sleepShown * 10 || document.getElementById("sleep")) return;
    const el = document.createElement("div"); el.id = "sleep";
    el.innerHTML = `<div class="sleepcard"><p class="big">😴 ${Math.round(mins)} minutes. Go to sleep.</p><p>Sleep is when tonight’s answers get saved in your brain. Staying up now makes tomorrow worse, not better. Your progress is saved.</p><div class="actions"><button class="btn" data-sleep>Done, going to bed</button><button class="btn ghost" data-more>10 more minutes</button></div></div>`;
    document.body.appendChild(el);
    el.onclick = (ev) => {
      if (ev.target.closest("[data-sleep]")) { el.remove(); location.hash = ""; home(); }
      if (ev.target.closest("[data-more]")) { sleepShown++; el.remove(); }
    };
  };

  // ---------- cram: flashcards. Question + options, tap to see the answer, then Knew it / Again ----------
  const cram = () => {
    const ids = buildQueue(prefs.topics, false);
    const S = { queue: ids, i: 0, shown: false, t0: Date.now(), knew: 0, again: 0, done: new Set(), topics: prefs.topics.slice(), extras: prefs.extras };
    const total = ids.length;
    const draw = () => {
      if (S.i >= S.queue.length) {
        clearInterval(timer);
        app.innerHTML = `<main class="wrap"><h1>Cram done 🔥</h1><p class="lede">${total} questions in ${clock((Date.now() - S.t0) / 1000)}. Now test yourself: Quiz solo or Study on call. Stop by the time it says sleep.</p><div class="actions"><button class="btn" data-quiz>Quiz now</button><button class="btn ghost" data-home>Home</button></div></main>`;
        return;
      }
      const q = BYID[S.queue[S.i]];
      app.innerHTML = `<main class="wrap">
        <div class="stats"><span>⏱ <b class="st-time">${clock((Date.now() - S.t0) / 1000)}</b></span><span>learned <b>${S.done.size}/${total}</b></span><span>left <b>${S.queue.length - S.i}</b></span></div>
        <div class="bar"><i style="width:${(100 * S.done.size) / Math.max(1, total)}%"></i></div>
        <div class="qhead"><span class="tag">${esc(TOPICS[q.t])}</span></div>
        <h2 class="q">${esc(q.q)}</h2>
        <div class="opts">${q.o.map((o, i) => `<div class="opt${S.shown ? (q.a.includes(i) ? " right" : " dim") : ""}"><span class="ol">${L(i)}</span><span>${esc(o)}</span></div>`).join("")}</div>
        ${S.shown && q.key ? `<p class="keynote">📋 ${esc(q.key)}</p>` : ""}
        <div class="actions">${S.shown
          ? `<button class="btn" data-knew>Knew it ✓</button><button class="btn ghost" data-again>Again ↺</button>`
          : `<button class="btn" data-show>Show answer</button><span class="hint">Guess first in your head.</span>`}<button class="btn ghost" data-home>Stop</button></div>
      </main>`;
    };
    app.onclick = (ev) => {
      if (ev.target.closest("[data-home]")) return home();
      if (ev.target.closest("[data-quiz]")) return solo(true);
      if (ev.target.closest("[data-show]")) { S.shown = true; return draw(); }
      const id = S.queue[S.i];
      if (ev.target.closest("[data-knew]")) { S.done.add(id); S.knew++; S.i++; S.shown = false; return draw(); }
      if (ev.target.closest("[data-again]")) { S.again++; S.queue.splice(Math.min(S.i + 4, S.queue.length), 0, id); S.i++; S.shown = false; return draw(); }
    };
    startTick(() => { const t = app.querySelector(".st-time"); if (t) t.textContent = clock((Date.now() - S.t0) / 1000); sleepGuard(S.t0); });
    draw();
  };

  // ---------- on call (needs the Essay Jar account on this phone for the room) ----------
  const apiCall = (action, body) => fetch(API, { method: "POST", body: JSON.stringify({ action, ...body }) }).then((r) => r.json());
  const acct = () => { try { return JSON.parse(localStorage.getItem("essayjar:acct") || "null"); } catch (e) { return null; } };
  const openRoom = () => {
    const a = acct();
    if (!ONLINE || !a || !a.token) {
      app.innerHTML = `<main class="wrap"><h1>Study on call</h1><p class="lede">${ONLINE ? "To open a room, log in to Essay Jar once on this phone (same browser). Then come back here." : "On call isn’t set up on this site yet (config.js needs the server link)."}</p>
        <div class="actions">${ONLINE ? `<a class="btn" href="${esc(window.HR_LOGIN || "../BiochemEssayJar/#/login")}">Log in to Essay Jar</a>` : ""}<button class="btn ghost" data-solo>Study solo instead</button><button class="btn ghost" data-home>Home</button></div></main>`;
      app.onclick = (ev) => { if (ev.target.closest("[data-home]")) home(); if (ev.target.closest("[data-solo]")) solo(false); };
      return;
    }
    const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = [...Array(6)].map(() => ABC[Math.floor(Math.random() * ABC.length)]).join("");
    const H = { v: 1, app: "hr", name: a.name || "He", style: prefs.style, quick: prefs.quick, extras: prefs.extras, topics: prefs.topics.slice(), queue: buildQueue(prefs.topics, false), i: 0, picks: [], submitted: false, again: {}, t0: Date.now(), answered: 0, right: 0, msgs: [], seenNext: 0 };
    app.innerHTML = `<main class="wrap"><p class="hint">Opening the room…</p></main>`;
    apiCall("roomPut", { token: a.token, code, side: "h", data: H }).then((r) => {
      if (!r || !r.ok) { app.innerHTML = `<main class="wrap"><p class="callout">${esc((r && r.error) || "Couldn’t open the room.")}</p><button class="btn" data-home>Home</button></main>`; app.onclick = (ev) => { if (ev.target.closest("[data-home]")) home(); }; return; }
      sess.set("hr:host:" + code, "1"); sess.set("hr:room:" + code, JSON.stringify(H));
      location.hash = "#/call/" + code;
    }).catch(() => { app.innerHTML = `<main class="wrap"><p class="callout">Can’t reach the server.</p><button class="btn" data-home>Home</button></main>`; app.onclick = (ev) => { if (ev.target.closest("[data-home]")) home(); }; });
  };

  const room = (code) => {
    code = String(code).toUpperCase();
    const host = sess.get("hr:host:" + code) === "1";
    let H = host ? JSON.parse(sess.get("hr:room:" + code) || "null") : null, P = null, err = "", joined = false, seen = new Set(), first = true, lastSnap = "";
    let putting = false, dirty = false;
    const link = `${location.origin}${location.pathname}#/call/${code}`;
    const put = () => {
      if (putting) { dirty = true; return; }
      putting = true; dirty = false;
      const body = host ? { token: (acct() || {}).token, code, side: "h", data: H } : { code, side: "p", data: P };
      if (host) { H.mcount = QS.filter((q) => H.topics.includes(q.t) && (H.extras || q.src !== "extra") && mastered(q.id)).length; sess.set("hr:room:" + code, JSON.stringify(H)); }
      apiCall("roomPut", body).catch(() => {}).finally(() => { putting = false; if (dirty) put(); });
    };
    const say = (text) => {
      const mine = host ? H : P; if (!mine) return;
      const m = { id: Date.now() + ":" + Math.random().toString(36).slice(2, 6), text: String(text).slice(0, 120) };
      mine.msgs = [...(mine.msgs || []), m].slice(-12); seen.add(m.id); put(); toast("You: " + text, "mine");
    };
    const next = () => { if (!H) return; H.i++; H.picks = []; H.submitted = false; put(); draw(); };
    const reactions = host ? ["❤️", "😘", "🥵", "Hint please", "Got it", "Explain"] : ["😏", "🔥", "💋", "🙄", "Good boy", "Read it again", "Think!"];

    const draw = () => {
      const keep = document.activeElement && document.activeElement.id === "msg" ? document.activeElement.value : null;
      let inner = "";
      if (err) inner = `<p class="callout">${esc(err)}</p><div class="actions"><button class="btn" data-home>Home</button></div>`;
      else if (!H) inner = `<p class="hint">Opening the room…</p>`;
      else if (!host && !joined) inner = `<h1>Quiz him on hormones</h1>
        <p class="lede">He answers on his phone. You see the right answers (✓) and his picks live. After he checks, read him the reason and the memory line, then press <b>Next</b>. Wrong ones come back later.${H.style === "spicy" ? " Spicy mode, 18+." : ""}</p>
        <form class="join" autocomplete="off"><input id="nm" maxlength="20" placeholder="Your name"><button class="btn" type="submit">Join</button></form>`;
      else if (host && !(P && P.name)) inner = `<h1>Room ${code}</h1><p class="lede">Send her this link. You start when she joins.</p>
        <div class="linkrow"><input readonly value="${esc(link)}"><button class="btn" data-share>${navigator.share ? "Send link" : "Copy"}</button></div>
        <p class="hint">Waiting for her…</p><div class="actions"><button class="btn ghost" data-home>Cancel</button></div>`;
      else if (H.i >= H.queue.length) inner = `${statsBar(H)}<h1>Done 🔥</h1><p class="lede">${H.right} of ${H.answered} right in ${clock((Date.now() - H.t0) / 1000)}.</p>${host ? `<div class="actions"><button class="btn" data-home>Home</button></div>` : ""}`;
      else {
        const who = host ? `${esc(P.name)} is in` : `${esc(H.name || "He")} is answering`;
        inner = `<p class="who">${who} · Room ${code}</p>${statsBar(H)}${qCard(H, { her: !host })}
          <div class="actions">${host
            ? H.submitted ? `<button class="btn" data-next>Next</button>` : `<button class="btn" data-submit ${H.picks.length ? "" : "disabled"}>Check</button>`
            : H.submitted ? `<button class="btn" data-next>Next question</button>` : `<span class="hint">Waiting for his answer… picks so far: ${H.picks.length ? H.picks.map(L).join(", ") : "none"}</span>`}</div>`;
      }
      const chat = H && (host ? P && P.name : joined) && !err;
      app.innerHTML = `<main class="wrap room">${inner}</main>${chat ? `<div class="chat"><div class="react">${reactions.map((r) => `<button type="button" data-say="${esc(r)}">${esc(r)}</button>`).join("")}</div><form class="msgf" autocomplete="off"><input id="msg" maxlength="120" placeholder="Say something…"><button class="btn small" type="submit">Send</button></form></div>` : ""}`;
      if (keep !== null) { const i = document.getElementById("msg"); if (i) { i.value = keep; i.focus(); } }
    };

    const poll = () => apiCall("roomGet", { code }).then((r) => {
      if (!r || !r.ok) { if (first) { err = (r && r.error) || "Couldn’t open the room."; draw(); } return; }
      first = false;
      if (!host) { H = r.h; if (H) H.her = true; if (r.p && !P) { P = r.p; joined = !!P.name; } }
      else P = r.p;
      const other = host ? r.p : r.h;
      ((other && other.msgs) || []).forEach((m) => { if (!seen.has(m.id)) { seen.add(m.id); if (lastSnap) toast((host ? (P && P.name) || "Her" : "Him") + ": " + m.text); } });
      if (host && P && (P.next || 0) > (H.seenNext || 0)) { H.seenNext = P.next; if (H.submitted) next(); }
      const snap = JSON.stringify(host ? [P && P.name] : [H && H.i, H && H.picks, H && H.submitted, H && H.answered]);
      if (snap !== lastSnap) { lastSnap = snap || "x"; draw(); }
    }).catch(() => {});

    app.onclick = (ev) => {
      if (ev.target.closest("[data-home]")) { location.hash = ""; return; }
      const s = ev.target.closest("[data-say]"); if (s) return say(s.dataset.say);
      if (ev.target.closest("[data-share]")) { if (navigator.share) navigator.share({ title: "Quiz me", url: link }).catch(() => {}); else { try { navigator.clipboard.writeText(link); } catch (e) { /* ignore */ } } return; }
      if (host) {
        const o = ev.target.closest("[data-opt]");
        if (o && !H.submitted) { const i = Number(o.dataset.opt); H.picks = H.picks.includes(i) ? H.picks.filter((x) => x !== i) : [...H.picks, i]; put(); return draw(); }
        if (ev.target.closest("[data-submit]")) {
          const id = H.queue[H.i], ok = sameSet(H.picks, BYID[id].a);
          H.submitted = true; H.answered++; if (ok) H.right++;
          requeue(H, id, ok); record(id, ok); put(); return draw();
        }
        if (ev.target.closest("[data-next]")) return next();
      } else if (ev.target.closest("[data-next]")) {
        P.next = (P.next || 0) + 1; put();
        const b = ev.target.closest("[data-next]"); b.disabled = true; b.textContent = "Next…";
      }
    };
    app.onsubmit = (ev) => {
      ev.preventDefault();
      if (ev.target.closest(".join")) { P = { v: 1, name: document.getElementById("nm").value.trim() || "Her", msgs: [], next: 0 }; joined = true; put(); draw(); return; }
      if (ev.target.closest(".msgf")) { const i = document.getElementById("msg"); if (i.value.trim()) { say(i.value.trim()); i.value = ""; } }
    };
    let tick = 0, lastNudge = Date.now(), roasts = 0;
    startTick(() => {
      tick++;
      const t = app.querySelector(".st-time"); if (t && H) t.textContent = clock((Date.now() - H.t0) / 1000);
      if (H) sleepGuard(H.t0);
      if (H && P && P.name && H.i < H.queue.length) {
        const mins = Math.floor((Date.now() - H.t0) / 600000), st = H.style || "clean";
        if (mins > roasts) { roasts = mins; lastNudge = Date.now(); const r = ROASTS[st]; toast("⏰ " + r[Math.min(mins - 1, r.length - 1)].replace("{m}", mins * 10).replace("{n}", QS.filter((q) => mastered(q.id)).length), "nudge"); }
        else if (Date.now() - lastNudge > 180000) { lastNudge = Date.now(); const n = NUDGES[st]; toast(n[Math.floor(Math.random() * n.length)], "nudge"); }
      }
      if (tick % 2 === 0 && document.visibilityState === "visible") poll();
    });
    draw(); poll();
  };

  // ---------- router ----------
  const route = () => {
    clearInterval(timer); app.onsubmit = null;
    const m = location.hash.match(/^#\/call\/([A-Za-z0-9]{6})$/);
    if (m) return room(m[1]);
    home();
  };
  window.addEventListener("hashchange", route);
  route();
})();
