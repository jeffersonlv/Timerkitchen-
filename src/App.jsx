import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const KEY = 'cron-sincronizado:v3';

async function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}
async function saveState(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {}
}

const uid = () => Math.random().toString(36).slice(2, 9);

const fmt = (totalSec) => {
  const s = Math.max(0, Math.round(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const STRINGS = {
  pt: {
    appTitle: 'Cronômetro', appTitleSpan: 'Sincronizado',
    soundLabel: 'Som', soundOn: 'ligado', soundOff: 'mudo', langBtn: 'EN',
    activeBatch: 'leva ativa', activeBatches: 'levas ativas',
    noActive: 'Nenhuma leva em andamento.',
    nextAction: 'Próxima ação ·', inLabel: 'em',
    sec1Title: 'Cadastro de item',
    namePlaceholder: 'Nome do item (ex: Arroz)',
    minPlaceholder: 'min', secPlaceholder: 'seg',
    flipLabel: 'Flip (bipe na metade)',
    flipDesc: 'Toca um som ao passar metade do tempo do item',
    flipBadge: 'flip', flippedBadge: 'flipado ✓',
    addBtn: '+ Adicionar ao catálogo',
    sec2Title: 'Lista de itens',
    emptyList: 'Nenhum item cadastrado ainda.',
    stageBtn: '+ preparo', stagedBtn: '✓ no preparo',
    sec3Title: 'Board de preparo',
    emptyBoard: 'Marque itens na lista (+ preparo) para montar a próxima leva.',
    startsIn: 'começa +',
    startBatch: '▶ Iniciar leva · termina em',
    clearPrep: 'Limpar preparo',
    sec4Title: 'Em execução',
    emptyRunning: 'As levas iniciadas aparecem aqui, cada uma com seu cronômetro.',
    stateRunning: 'em andamento', statePaused: 'pausada',
    nextLabel: 'Próxima:',
    pauseBtn: 'Pausar', resumeBtn: 'Retomar', zeroBtn: 'Zerar', discardBtn: 'Descartar',
    sec5Title: 'Done',
    emptyDone: 'Levas concluídas aparecem aqui.',
    stateDone: 'concluída', clearBtn: 'Limpar',
    cardStartsIn: 'inicia em', cardLeft: 'restam', cardDone: '✓ pronto',
    toastNow: 'Agora', toastHalf: 'Metade', toastDone: 'Fim',
    evStart: (name) => `Iniciar "${name}"`,
    evSplit: (name) => `Metade de "${name}"`,
    evDone: 'Tudo pronto!',
    confirm: 'Confirmar?',
    batchLabel: 'Leva',
  },
  en: {
    appTitle: 'Sync', appTitleSpan: 'Timer',
    soundLabel: 'Sound', soundOn: 'on', soundOff: 'off', langBtn: 'PT',
    activeBatch: 'active batch', activeBatches: 'active batches',
    noActive: 'No active batches.',
    nextAction: 'Next action ·', inLabel: 'in',
    sec1Title: 'Add item',
    namePlaceholder: 'Item name (e.g. Rice)',
    minPlaceholder: 'min', secPlaceholder: 'sec',
    flipLabel: 'Flip (beep at halfway)',
    flipDesc: 'Plays a sound at the halfway point of this item',
    flipBadge: 'flip', flippedBadge: 'flipped ✓',
    addBtn: '+ Add to catalog',
    sec2Title: 'Item list',
    emptyList: 'No items added yet.',
    stageBtn: '+ prep', stagedBtn: '✓ in prep',
    sec3Title: 'Prep board',
    emptyBoard: 'Select items from the list (+ prep) to set up the next batch.',
    startsIn: 'starts +',
    startBatch: '▶ Start batch · done in',
    clearPrep: 'Clear prep',
    sec4Title: 'Running',
    emptyRunning: 'Started batches appear here, each with its own timer.',
    stateRunning: 'running', statePaused: 'paused',
    nextLabel: 'Next:',
    pauseBtn: 'Pause', resumeBtn: 'Resume', zeroBtn: 'Reset', discardBtn: 'Discard',
    sec5Title: 'Done',
    emptyDone: 'Completed batches appear here.',
    stateDone: 'completed', clearBtn: 'Clear',
    cardStartsIn: 'starts in', cardLeft: 'left', cardDone: '✓ done',
    toastNow: 'Now', toastHalf: 'Half', toastDone: 'Done',
    evStart: (name) => `Start "${name}"`,
    evSplit: (name) => `Halfway "${name}"`,
    evDone: 'All done!',
    confirm: 'Confirm?',
    batchLabel: 'Batch',
  },
};

function scheduleOf(items) {
  const valid = items.filter((it) => (it.totalSec || 0) > 0);
  if (!valid.length) return { totalSec: 0, events: [] };
  const totalSec = Math.max(...valid.map((it) => it.totalSec));
  const events = [];
  valid.forEach((it) => {
    events.push({ id: 's-' + it.id, at: totalSec - it.totalSec, type: 'start', name: it.name });
    if (it.split) events.push({ id: 'h-' + it.id, at: totalSec - it.totalSec / 2, type: 'split', name: it.name });
  });
  events.push({ id: 'done', at: totalSec, type: 'done' });
  events.sort((a, b) => a.at - b.at || (a.type === 'start' ? -1 : 1));
  return { totalSec, events };
}

function useAudio(enabledRef) {
  const ctxRef = useRef(null);
  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    if (ctxRef.current && ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);
  const tone = useCallback((freq, start, dur, peak = 0.25, type = 'sine') => {
    const ctx = ctxRef.current; if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }, []);
  const play = useCallback((kind) => {
    if (!enabledRef.current || !ensure()) return;
    const V = 0.85;
    if (kind === 'start') {
      for (let i = 0; i < 3; i++) {
        tone(659.25, i * 0.8, 0.30, V, 'square');
        tone(880.00, i * 0.8 + 0.35, 0.38, V, 'square');
      }
    } else if (kind === 'split') {
      for (let i = 0; i < 4; i++) tone(1046.5, i * 0.5, 0.32, V, 'triangle');
    } else if (kind === 'done') {
      for (let i = 0; i < 2; i++) {
        const o = i * 1.5;
        tone(523.25, o, 0.30, V);
        tone(659.25, o + 0.30, 0.30, V);
        tone(783.99, o + 0.60, 0.30, V);
        tone(1046.5, o + 0.90, 0.55, V);
      }
    } else { tone(700, 0, 0.25, V); }
  }, [ensure, tone, enabledRef]);
  return { play, ensure };
}

export default function App() {
  const [catalog, setCatalog] = useState([]);
  const [staged, setStaged] = useState([]);
  const [batches, setBatches] = useState([]);
  const [seq, setSeq] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [name, setName] = useState('');
  const [min, setMin] = useState('');
  const [sec, setSec] = useState('');
  const [split, setSplit] = useState(false);

  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(soundOn);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  const { play, ensure } = useAudio(soundRef);

  const [lang, setLang] = useState('pt');
  const t = useCallback((key, arg) => {
    const val = STRINGS[lang][key];
    return typeof val === 'function' ? val(arg) : val;
  }, [lang]);

  const [collapsed, setCollapsed] = useState({ cadastro: false, lista: false, board: false, running: false, done: false });
  const toggleCollapse = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  const [confirmPending, setConfirmPending] = useState(null);
  useEffect(() => {
    if (!confirmPending) return;
    const timer = setTimeout(() => setConfirmPending(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmPending]);

  const firedRef = useRef({});
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadState();
      if (alive && s) {
        setCatalog(Array.isArray(s.catalog) ? s.catalog : []);
        setStaged(Array.isArray(s.staged) ? s.staged : []);
        const bs = Array.isArray(s.batches) ? s.batches : [];
        const ts = Date.now();
        bs.forEach((b) => {
          const sch = scheduleOf(b.items);
          const el = (b.status === 'running' ? b.accMs + (ts - b.startTs) : b.accMs) / 1000;
          firedRef.current[b.id] = new Set(sch.events.filter((e) => e.at <= el).map((e) => e.id));
        });
        setBatches(bs);
        setSeq(s.seq || (bs.length + 1));
        if (s.lang) setLang(s.lang);
        if (s.collapsed) setCollapsed(s.collapsed);
      }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (loaded) saveState({ catalog, staged, batches, seq, lang, collapsed });
  }, [catalog, staged, batches, seq, loaded, lang, collapsed]);

  useEffect(() => {
    if (!batches.some((b) => b.status === 'running')) return;
    const id = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      const doneIds = [];
      batches.forEach((b) => {
        if (b.status !== 'running') return;
        const sch = scheduleOf(b.items);
        const el = (b.accMs + (ts - b.startTs)) / 1000;
        const fired = firedRef.current[b.id] || (firedRef.current[b.id] = new Set());
        sch.events.forEach((ev) => {
          if (el >= ev.at && !fired.has(ev.id)) {
            fired.add(ev.id); play(ev.type);
            setFlash({ ...ev, leva: b.label, ts });
          }
        });
        if (el >= sch.totalSec) doneIds.push(b.id);
      });
      if (doneIds.length) setBatches((prev) => prev.map((b) => doneIds.includes(b.id) ? { ...b, status: 'done' } : b));
    }, 250);
    return () => clearInterval(id);
  }, [batches, play]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4200);
    return () => clearTimeout(timer);
  }, [flash]);

  const addItem = () => {
    const total = (parseInt(min || '0', 10) || 0) * 60 + (parseInt(sec || '0', 10) || 0);
    if (!name.trim() || total <= 0) return;
    setCatalog((p) => [...p, { id: uid(), name: name.trim(), totalSec: total, split }]);
    setName(''); setMin(''); setSec(''); setSplit(false);
  };
  const removeCatalog = (id) => { setCatalog((p) => p.filter((c) => c.id !== id)); setStaged((s) => s.filter((x) => x !== id)); };
  const toggleStage = (id) => setStaged((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const onFormKey = (e) => { if (e.key === 'Enter') addItem(); };

  const stagedItems = useMemo(
    () => staged.map((id) => catalog.find((c) => c.id === id)).filter(Boolean),
    [staged, catalog]
  );
  const stagedSchedule = useMemo(() => scheduleOf(stagedItems), [stagedItems]);

  const startLeva = () => {
    const its = stagedItems.filter((c) => c.totalSec > 0);
    if (!its.length) return;
    ensure();
    const id = uid();
    const items = its.map((c) => ({ id: uid(), name: c.name, totalSec: c.totalSec, split: c.split }));
    firedRef.current[id] = new Set();
    setBatches((p) => [...p, { id, label: t('batchLabel') + ' ' + seq, items, status: 'running', startTs: Date.now(), accMs: 0 }]);
    setSeq((s) => s + 1);
    setStaged([]);
  };
  const pauseLeva = (id) => setBatches((p) => p.map((b) =>
    b.id === id && b.status === 'running' ? { ...b, status: 'paused', accMs: b.accMs + (Date.now() - b.startTs), startTs: null } : b));
  const resumeLeva = (id) => { ensure(); setBatches((p) => p.map((b) =>
    b.id === id && b.status === 'paused' ? { ...b, status: 'running', startTs: Date.now() } : b)); };
  const zeroLeva = (id) => { firedRef.current[id] = new Set(); setBatches((p) => p.map((b) =>
    b.id === id ? { ...b, accMs: 0, startTs: b.status === 'running' ? Date.now() : null } : b)); };
  const removeLeva = (id) => { delete firedRef.current[id]; setBatches((p) => p.filter((b) => b.id !== id)); };

  const elapsedOf = (b) => (b.status === 'running' ? b.accMs + (now - b.startTs) : b.accMs) / 1000;

  const active = batches.filter((b) => b.status !== 'done');
  const done = batches.filter((b) => b.status === 'done');

  const summary = useMemo(() => {
    let best = null;
    batches.forEach((b) => {
      if (b.status !== 'running') return;
      const sch = scheduleOf(b.items);
      const el = elapsedOf(b);
      const nx = sch.events.find((e) => e.at > el + 0.05);
      if (nx) {
        const inSec = nx.at - el;
        if (!best || inSec < best.inSec) best = { inSec, ev: nx, leva: b.label };
      }
    });
    return best;
  }, [batches, now]);

  const evLabel = (ev) =>
    ev.type === 'start' ? t('evStart', ev.name)
    : ev.type === 'split' ? t('evSplit', ev.name)
    : t('evDone');

  const confirmKey = (key) => confirmPending === key;
  const handleConfirm = (key, action) => {
    if (confirmPending === key) { action(); setConfirmPending(null); }
    else setConfirmPending(key);
  };

  const secHead = (colorVar, title, count, colKey) => (
    <div className="cs-sechead">
      <span className="tag" style={{ background: `var(${colorVar})` }} />
      <h2>{title}</h2>
      {count !== undefined && <span className="num">{count}</span>}
      <button
        className={'cs-chevron' + (!collapsed[colKey] ? ' open' : '')}
        onClick={() => toggleCollapse(colKey)}
        aria-label="toggle section"
      >▾</button>
    </div>
  );

  const renderLevaItems = (b, finished) => {
    const sch = scheduleOf(b.items);
    const el = finished ? sch.totalSec : elapsedOf(b);
    const rem = Math.max(0, sch.totalSec - el);
    const nextStartId = (() => {
      if (finished) return null;
      const waiting = b.items
        .filter((it) => el < sch.totalSec - it.totalSec)
        .sort((a, c) => (sch.totalSec - a.totalSec) - (sch.totalSec - c.totalSec));
      return waiting.length ? waiting[0].id : null;
    })();
    return (
      <div className="cs-board">
        {b.items.map((it) => {
          const startAt = sch.totalSec - it.totalSec;
          let cls = 'wait', stat, progress = 0;
          if (finished || el >= sch.totalSec) {
            cls = 'dn'; stat = t('cardDone'); progress = 1;
          } else if (el < startAt) {
            cls = it.id === nextStartId ? 'next' : 'wait';
            stat = `${t('cardStartsIn')} ${fmt(startAt - el)}`;
            progress = 0;
          } else {
            cls = 'run';
            stat = `${fmt(rem)} ${t('cardLeft')}`;
            progress = Math.min(1, (el - startAt) / it.totalSec);
          }
          const flipped = it.split && cls === 'run' && progress >= 0.5;
          return (
            <div className={'cs-card ' + cls} key={it.id}>
              <div className="cnm">{it.name}</div>
              <div className="cb">
                <span className="ctime">{fmt(it.totalSec)}</span>
                {it.split && (
                  <span className={'cs-badge' + (flipped ? ' flipped' : '')}>
                    {flipped ? t('flippedBadge') : t('flipBadge')}
                  </span>
                )}
              </div>
              <div className="cstat">{stat}</div>
              <div className="cs-card-progress">
                <div className="fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Sora:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
    .cs-wrap{ --bg:#0b0d13; --surf:#13161f; --surf2:#191d28; --bd:#272c3a; --tx:#e9ebf2; --mut:#8b91a4;
      --amber:#f3a431; --mint:#42d9a4; --blue:#7aa2ff; --green:#62e08c; --danger:#ef5a6f;
      min-height:100vh; box-sizing:border-box; color:var(--tx); font-family:'Sora',sans-serif;
      background:
        radial-gradient(900px 500px at 12% -8%, rgba(243,164,49,.10), transparent 60%),
        radial-gradient(800px 500px at 100% 0%, rgba(122,162,255,.08), transparent 55%),
        var(--bg);
      padding:24px 16px 90px; }
    .cs-wrap *{ box-sizing:border-box; }
    .cs-shell{ max-width:860px; margin:0 auto; }

    .cs-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
    .cs-title{ font-family:'Syne'; font-weight:800; font-size:clamp(22px,4.4vw,34px); line-height:.95; letter-spacing:-.02em; margin:0; }
    .cs-title span{ color:var(--amber); }
    .cs-head-btns{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .cs-soundbtn{ background:var(--surf2); border:1px solid var(--bd); color:var(--tx); border-radius:999px; padding:8px 15px; font-size:13px; cursor:pointer; font-family:'Sora'; }
    .cs-soundbtn b{ color:var(--amber); font-weight:600; }
    .cs-langbtn{ background:var(--surf2); border:1px solid var(--bd); color:var(--tx); border-radius:999px; padding:8px 15px; font-size:13px; cursor:pointer; font-family:'Sora'; }
    .cs-langbtn b{ color:var(--blue); font-weight:700; }

    .cs-summary{ border:1px solid var(--bd); border-radius:14px; background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.16)), var(--surf);
      padding:13px 16px; margin-bottom:22px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .cs-summary .pill{ font-family:'JetBrains Mono'; font-size:12px; color:var(--mut); border:1px solid var(--bd); border-radius:999px; padding:4px 10px; }
    .cs-summary .pill b{ color:var(--mint); }
    .cs-summary .nxt{ font-size:13px; color:var(--mut); }
    .cs-summary .nxt b{ color:var(--tx); font-family:'Syne'; }
    .cs-summary .nxt .cd{ color:var(--amber); font-family:'JetBrains Mono'; font-weight:700; }

    .cs-sec{ margin-bottom:18px; }
    .cs-sechead{ display:flex; align-items:center; gap:10px; margin:0 4px 10px; }
    .cs-sechead .tag{ width:8px; height:18px; border-radius:3px; flex:0 0 auto; }
    .cs-sechead h2{ font-family:'Syne'; font-weight:700; font-size:16px; margin:0; }
    .cs-sechead .num{ font-family:'JetBrains Mono'; font-size:12px; color:var(--mut); margin-left:auto; }
    .cs-chevron{ background:transparent; border:none; color:var(--mut); font-size:16px; cursor:pointer; padding:0 4px; display:inline-flex; align-items:center; transform:rotate(0deg); transition:transform .2s; line-height:1; }
    .cs-chevron.open{ transform:rotate(180deg); }
    .cs-sechead .num + .cs-chevron{ margin-left:4px; }
    .cs-sechead h2 + .cs-chevron{ margin-left:auto; }
    .cs-panel{ border:1px solid var(--bd); border-radius:16px; background:var(--surf); padding:16px; }

    .cs-form{ display:flex; flex-direction:column; gap:10px; }
    .cs-inp{ background:var(--surf2); border:1px solid var(--bd); border-radius:10px; color:var(--tx); padding:11px 13px; font-size:14px; font-family:'Sora'; width:100%; outline:none; }
    .cs-inp:focus{ border-color:var(--amber); } .cs-inp::placeholder{ color:#5d6273; }
    .cs-row2{ display:flex; gap:10px; } .cs-row2 .cs-inp{ font-family:'JetBrains Mono'; text-align:center; }
    .cs-splitrow{ display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--surf2); border:1px solid var(--bd); border-radius:10px; padding:10px 13px; }
    .cs-splitrow .t{ font-size:13px; } .cs-splitrow .t small{ color:var(--mut); display:block; }
    .cs-switch{ width:46px; height:26px; border-radius:999px; border:1px solid var(--bd); background:#2a2f3d; position:relative; cursor:pointer; flex:0 0 auto; transition:background .15s; }
    .cs-switch.on{ background:var(--blue); }
    .cs-switch .knob{ position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; transition:left .15s; }
    .cs-switch.on .knob{ left:22px; }
    .cs-add{ background:var(--amber); color:#2a1c02; border:none; border-radius:10px; padding:12px; font-family:'Syne'; font-weight:700; font-size:15px; cursor:pointer; }
    .cs-add:disabled{ opacity:.4; cursor:not-allowed; }

    .cs-empty{ color:var(--mut); font-size:13px; text-align:center; padding:18px 8px; }

    .cs-hscroll{ display:flex; gap:10px; overflow-x:auto; padding-bottom:8px; }
    .cs-hscroll::-webkit-scrollbar{ height:4px; }
    .cs-hscroll::-webkit-scrollbar-thumb{ background:var(--bd); border-radius:2px; }
    .cs-litem{ display:flex; align-items:center; gap:12px; padding:11px 12px; border:1px solid var(--bd); border-radius:11px; margin-bottom:9px; background:var(--surf2); }
    .cs-litem:last-child{ margin-bottom:0; }
    .cs-litem.staged{ border-color:var(--amber); }
    .cs-hscroll .cs-litem{ flex-direction:column; align-items:flex-start; min-width:160px; flex-shrink:0; margin-bottom:0; }
    .cs-litem .nm{ font-weight:600; font-size:14px; }
    .cs-litem .meta{ display:flex; gap:8px; align-items:center; margin-top:3px; flex-wrap:wrap; }
    .cs-row-btns{ display:flex; gap:6px; margin-top:8px; width:100%; }
    .cs-time{ font-family:'JetBrains Mono'; font-weight:700; font-size:12px; color:var(--amber); }
    .cs-badge{ font-size:10px; letter-spacing:.06em; text-transform:uppercase; padding:2px 7px; border-radius:6px; border:1px solid var(--blue); color:var(--blue); }
    .cs-spacer{ flex:1; }
    .cs-stagebtn{ border:1px solid var(--bd); background:var(--surf); color:var(--tx); border-radius:8px; padding:7px 11px; font-size:12px; cursor:pointer; font-family:'Sora'; white-space:nowrap; flex:1; }
    .cs-stagebtn.on{ background:var(--amber); color:#2a1c02; border-color:var(--amber); font-weight:600; }
    .cs-del{ background:transparent; border:1px solid var(--bd); color:var(--mut); width:30px; height:30px; border-radius:8px; cursor:pointer; font-size:16px; line-height:1; flex:0 0 auto; }
    .cs-del:hover{ color:var(--danger); border-color:var(--danger); }
    .cs-del.confirm{ color:var(--danger); border-color:var(--danger); }

    .cs-pair{ display:grid; grid-template-columns:1fr; gap:0; }
    @media(min-width:600px){ .cs-pair{ grid-template-columns:1fr 1fr; gap:16px; } }

    .cs-board{ display:grid; grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:10px; }
    .cs-card{ border:1px solid var(--bd); border-radius:12px; padding:12px; background:var(--surf2); }
    .cs-card .cnm{ font-weight:600; font-size:14px; }
    .cs-card .cb{ display:flex; align-items:center; gap:6px; margin-top:6px; }
    .cs-card .ctime{ font-family:'JetBrains Mono'; font-weight:700; font-size:12px; color:var(--mut); }
    .cs-card .cstat{ font-family:'JetBrains Mono'; font-size:12px; margin-top:6px; color:var(--mut); }
    .cs-card.run{ border-color:var(--mint); } .cs-card.run .cstat{ color:var(--mint); }
    .cs-card.next{ border-color:var(--amber); } .cs-card.next .cstat{ color:var(--amber); }
    .cs-card.dn{ opacity:.8; border-color:rgba(98,224,140,.4); } .cs-card.dn .cstat{ color:var(--green); }

    .cs-startbtn{ margin-top:14px; width:100%; background:var(--mint); color:#04231a; border:none; border-radius:11px; padding:13px; font-family:'Syne'; font-weight:700; font-size:15px; cursor:pointer; }
    .cs-startbtn:disabled{ opacity:.4; cursor:not-allowed; }
    .cs-clearbtn{ margin-top:8px; width:100%; background:transparent; border:1px solid var(--bd); color:var(--mut); border-radius:9px; padding:8px; font-size:12px; cursor:pointer; }
    .cs-clearbtn:hover{ color:var(--danger); border-color:var(--danger); }
    .cs-clearbtn.danger{ color:var(--danger); border-color:var(--danger); }

    .cs-leva{ border:1px solid var(--bd); border-radius:14px; background:var(--surf2); padding:14px; margin-bottom:12px; }
    .cs-leva:last-child{ margin-bottom:0; }
    .cs-leva.running{ border-color:var(--mint); }
    .cs-leva.paused{ border-color:var(--amber); }
    .cs-leva.dn{ border-color:rgba(98,224,140,.45); }
    .cs-leva-top{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .cs-leva-label{ font-family:'Syne'; font-weight:700; font-size:15px; }
    .cs-leva-state{ font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--mut); }
    .cs-leva-time{ font-family:'JetBrains Mono'; font-weight:700; font-size:30px; margin-left:auto; letter-spacing:.02em; }
    .cs-leva.running .cs-leva-time{ color:var(--mint); }
    .cs-leva.paused .cs-leva-time{ color:var(--amber); }
    .cs-leva.dn .cs-leva-time{ color:var(--green); font-size:20px; }
    .cs-leva-ctrl{ display:flex; gap:6px; width:100%; }
    .cs-mini{ background:transparent; border:1px solid var(--bd); color:var(--tx); border-radius:8px; padding:7px 12px; font-size:12px; cursor:pointer; font-family:'Sora'; }
    .cs-mini:hover{ border-color:var(--amber); }
    .cs-mini.danger:hover{ border-color:var(--danger); color:var(--danger); }
    .cs-mini.danger.confirm{ border-color:var(--danger); color:var(--danger); background:rgba(239,90,111,.10); }
    .cs-leva-next{ font-size:12px; color:var(--mut); margin:10px 0 4px; }
    .cs-leva-next b{ color:var(--amber); font-family:'JetBrains Mono'; }

    .cs-toast{ position:fixed; left:50%; bottom:24px; transform:translateX(-50%); z-index:50; border:1px solid var(--bd); border-radius:14px; padding:13px 22px; min-width:240px; text-align:center; background:var(--surf2); box-shadow:0 18px 50px rgba(0,0,0,.5); animation:rise .25s ease; }
    @keyframes rise{ from{ transform:translate(-50%,14px); opacity:0 } to{ transform:translate(-50%,0); opacity:1 } }
    .cs-toast .k{ font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--mut); }
    .cs-toast .m{ font-family:'Syne'; font-weight:800; font-size:19px; margin-top:3px; }
    .cs-toast.start .m{ color:var(--mint); } .cs-toast.split .m{ color:var(--blue); } .cs-toast.done .m{ color:var(--green); }

    .cs-badge.flipped{ border-color:var(--amber); color:var(--amber); }

    .cs-leva-progress{ height:5px; border-radius:3px; background:var(--bd); margin:8px 0 10px; overflow:hidden; }
    .cs-leva-progress .fill{ height:100%; border-radius:3px; transition:width .25s linear; }
    .cs-leva.running .cs-leva-progress .fill{ background:var(--mint); }
    .cs-leva.paused .cs-leva-progress .fill{ background:var(--amber); }

    .cs-card-progress{ height:4px; border-radius:2px; background:var(--bd); margin-top:8px; overflow:hidden; }
    .cs-card-progress .fill{ height:100%; border-radius:2px; transition:width .25s linear; }
    .cs-card.run .cs-card-progress .fill{ background:var(--mint); }
    .cs-card.next .cs-card-progress .fill{ background:var(--amber); opacity:.5; }
    .cs-card.dn .cs-card-progress .fill{ background:var(--green); }
  `;

  return (
    <div className="cs-wrap">
      <style>{css}</style>
      <div className="cs-shell">
        <div className="cs-head">
          <h1 className="cs-title">{t('appTitle')} <span>{t('appTitleSpan')}</span></h1>
          <div className="cs-head-btns">
            <button className="cs-langbtn" onClick={() => setLang((l) => l === 'pt' ? 'en' : 'pt')}><b>{t('langBtn')}</b></button>
            <button className="cs-soundbtn" onClick={() => setSoundOn((s) => !s)}>🔊 {t('soundLabel')} <b>{soundOn ? t('soundOn') : t('soundOff')}</b></button>
          </div>
        </div>

        <div className="cs-summary">
          <span className="pill"><b>{active.length}</b> {active.length === 1 ? t('activeBatch') : t('activeBatches')}</span>
          {summary ? (
            <span className="nxt">
              {t('nextAction')} <b>{evLabel(summary.ev)}</b> ({summary.leva}) {t('inLabel')} <span className="cd">{fmt(summary.inSec)}</span>
            </span>
          ) : (
            <span className="nxt">{t('noActive')}</span>
          )}
        </div>

        {/* 1. CADASTRO */}
        <div className="cs-sec">
          {secHead('--amber', t('sec1Title'), undefined, 'cadastro')}
          {!collapsed.cadastro && (
            <div className="cs-panel">
              <div className="cs-form">
                <input className="cs-inp" placeholder={t('namePlaceholder')} value={name} onKeyDown={onFormKey} onChange={(e) => setName(e.target.value)} />
                <div className="cs-row2">
                  <input className="cs-inp" placeholder={t('minPlaceholder')} inputMode="numeric" value={min} onKeyDown={onFormKey} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} />
                  <input className="cs-inp" placeholder={t('secPlaceholder')} inputMode="numeric" value={sec} onKeyDown={onFormKey} onChange={(e) => setSec(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="cs-splitrow">
                  <div className="t">{t('flipLabel')}<small>{t('flipDesc')}</small></div>
                  <div className={'cs-switch' + (split ? ' on' : '')} onClick={() => setSplit((s) => !s)} role="switch" aria-checked={split}><span className="knob" /></div>
                </div>
                <button className="cs-add" onClick={addItem} disabled={!name.trim()}>{t('addBtn')}</button>
              </div>
            </div>
          )}
        </div>

        {/* 2. LISTA */}
        <div className="cs-sec">
          {secHead('--blue', t('sec2Title'), catalog.length, 'lista')}
          {!collapsed.lista && (
            <div className="cs-panel">
              {catalog.length === 0
                ? <div className="cs-empty">{t('emptyList')}</div>
                : (
                  <div className="cs-hscroll">
                    {catalog.map((c) => {
                      const on = staged.includes(c.id);
                      const delKey = 'cat-' + c.id;
                      return (
                        <div className={'cs-litem' + (on ? ' staged' : '')} key={c.id}>
                          <div>
                            <div className="nm">{c.name}</div>
                            <div className="meta"><span className="cs-time">{fmt(c.totalSec)}</span>{c.split && <span className="cs-badge">{t('flipBadge')}</span>}</div>
                          </div>
                          <div className="cs-row-btns">
                            <button className={'cs-stagebtn' + (on ? ' on' : '')} onClick={() => toggleStage(c.id)}>
                              {on ? t('stagedBtn') : t('stageBtn')}
                            </button>
                            <button
                              className={'cs-del' + (confirmKey(delKey) ? ' confirm' : '')}
                              onClick={() => handleConfirm(delKey, () => removeCatalog(c.id))}
                              title={confirmKey(delKey) ? t('confirm') : ''}
                            >{confirmKey(delKey) ? '?' : '×'}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* 3 + 4 SIDE-BY-SIDE */}
        <div className="cs-pair">
          {/* 3. BOARD */}
          <div className="cs-sec">
            {secHead('--amber', t('sec3Title'), stagedItems.length, 'board')}
            {!collapsed.board && (
              <div className="cs-panel">
                {stagedItems.length === 0
                  ? <div className="cs-empty">{t('emptyBoard')}</div>
                  : (
                    <>
                      <div className="cs-board">
                        {stagedItems.map((c) => (
                          <div className="cs-card" key={c.id}>
                            <div className="cnm">{c.name}</div>
                            <div className="cb"><span className="ctime">{fmt(c.totalSec)}</span>{c.split && <span className="cs-badge">{t('flipBadge')}</span>}</div>
                            <div className="cstat">{t('startsIn')}{fmt(stagedSchedule.totalSec - c.totalSec)}</div>
                          </div>
                        ))}
                      </div>
                      <button className="cs-startbtn" onClick={startLeva}>
                        {t('startBatch')} {fmt(stagedSchedule.totalSec)}
                      </button>
                      <button
                        className={'cs-clearbtn' + (confirmKey('staged') ? ' danger' : '')}
                        onClick={() => handleConfirm('staged', () => setStaged([]))}
                      >{confirmKey('staged') ? t('confirm') : t('clearPrep')}</button>
                    </>
                  )}
              </div>
            )}
          </div>

          {/* 4. RUNNING */}
          <div className="cs-sec">
            {secHead('--mint', t('sec4Title'), active.length, 'running')}
            {!collapsed.running && (
              <div className="cs-panel">
                {active.length === 0
                  ? <div className="cs-empty">{t('emptyRunning')}</div>
                  : active.map((b) => {
                    const sch = scheduleOf(b.items);
                    const el = elapsedOf(b);
                    const rem = Math.max(0, sch.totalSec - el);
                    const nx = sch.events.find((e) => e.at > el + 0.05);
                    const discardKey = 'leva-' + b.id;
                    return (
                      <div className={'cs-leva ' + b.status} key={b.id}>
                        <div className="cs-leva-top">
                          <div>
                            <div className="cs-leva-label">{b.label}</div>
                            <div className="cs-leva-state">{b.status === 'running' ? t('stateRunning') : t('statePaused')}</div>
                          </div>
                          <div className="cs-leva-time">{fmt(rem)}</div>
                        </div>
                        <div className="cs-leva-progress">
                          <div className="fill" style={{ width: `${Math.min(100, (el / sch.totalSec) * 100)}%` }} />
                        </div>
                        {nx && b.status === 'running' && (
                          <div className="cs-leva-next">{t('nextLabel')} {evLabel(nx)} {t('inLabel')} <b>{fmt(nx.at - el)}</b></div>
                        )}
                        {renderLevaItems(b, false)}
                        <div className="cs-leva-ctrl" style={{ marginTop: 12 }}>
                          {b.status === 'running'
                            ? <button className="cs-mini" onClick={() => pauseLeva(b.id)}>{t('pauseBtn')}</button>
                            : <button className="cs-mini" onClick={() => resumeLeva(b.id)}>{t('resumeBtn')}</button>}
                          <button className="cs-mini" onClick={() => zeroLeva(b.id)}>{t('zeroBtn')}</button>
                          <span className="cs-spacer" />
                          <button
                            className={'cs-mini danger' + (confirmKey(discardKey) ? ' confirm' : '')}
                            onClick={() => handleConfirm(discardKey, () => removeLeva(b.id))}
                          >{confirmKey(discardKey) ? t('confirm') : t('discardBtn')}</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* 5. DONE */}
        <div className="cs-sec">
          {secHead('--green', t('sec5Title'), done.length, 'done')}
          {!collapsed.done && (
            <div className="cs-panel">
              {done.length === 0
                ? <div className="cs-empty">{t('emptyDone')}</div>
                : done.map((b) => {
                  const clearKey = 'leva-' + b.id;
                  return (
                    <div className="cs-leva dn" key={b.id}>
                      <div className="cs-leva-top">
                        <div><div className="cs-leva-label">{b.label}</div><div className="cs-leva-state">{t('stateDone')}</div></div>
                        <div className="cs-leva-time">✓ 00:00</div>
                      </div>
                      {renderLevaItems(b, true)}
                      <div className="cs-leva-ctrl" style={{ marginTop: 12 }}>
                        <span className="cs-spacer" />
                        <button
                          className={'cs-mini danger' + (confirmKey(clearKey) ? ' confirm' : '')}
                          onClick={() => handleConfirm(clearKey, () => removeLeva(b.id))}
                        >{confirmKey(clearKey) ? t('confirm') : t('clearBtn')}</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {flash && (
        <div className={`cs-toast ${flash.type}`}>
          <div className="k">{flash.leva} · {flash.type === 'start' ? t('toastNow') : flash.type === 'split' ? t('toastHalf') : t('toastDone')}</div>
          <div className="m">{evLabel(flash)}</div>
        </div>
      )}
    </div>
  );
}
