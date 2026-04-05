import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const GOAL_MIN = 150;
const GOAL_SEC = GOAL_MIN * 60;
const SK = "zone2_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wb() {
  const now = new Date(), d = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() + (d === 0 ? -6 : 1 - d));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return [mon, sun];
}
function inWeek(iso) {
  const [a, b] = wb();
  const d = new Date(iso);
  return d >= a && d <= b;
}
function weekLabel() {
  const [a, b] = wb();
  const f = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(a)} – ${f(b)}`;
}
function pad(n) { return String(n).padStart(2, "0"); }
function fmtSec(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${pad(m)}:${pad(sec)}`;
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
function nowInput() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const mem = {};
const stor = (typeof window !== "undefined" && window.storage) ? window.storage : {
  get: async k => mem[k] ? { value: mem[k] } : null,
  set: async (k, v) => { mem[k] = v; return { key: k, value: v }; },
};
async function load() {
  try { const r = await stor.get(SK); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function save(arr) {
  try { await stor.set(SK, JSON.stringify(arr)); } catch { }
}

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #05050C; -webkit-tap-highlight-color: transparent; overscroll-behavior: none; }
  input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.6); opacity: 0.7; cursor: pointer; }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes fabGlow {
    0%, 100% { box-shadow: 0 0 22px rgba(62,255,160,0.5), 0 6px 24px rgba(0,0,0,0.6); }
    50% { box-shadow: 0 0 44px rgba(62,255,160,0.85), 0 8px 30px rgba(0,0,0,0.6); }
  }
  @keyframes goalPulse {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.55; }
  }
  @keyframes checkPop {
    0% { transform: scale(0.4); opacity: 0; }
    60% { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .session-card { animation: cardIn 0.25s ease forwards; }
  .check-pop { animation: checkPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
`;

// ─── Activity Rings ───────────────────────────────────────────────────────────
function capPos(cx, cy, r, p) {
  const a = (-90 + Math.min(p, 1) * 360) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function ActivityRings({ p1, p2, p3, goalMet }) {
  const S = 292, C = S / 2;
  const rings = [
    { r: 122, p: p1, c1: "#3EFFA0", c2: "#00CFFF", w: 23, id: "ra" },
    { r: 91, p: p2, c1: "#FF9F4A", c2: "#FF55A8", w: 18, id: "rb" },
    { r: 63, p: p3, c1: "#B06CFF", c2: "#5B9EFF", w: 14, id: "rc" },
  ];

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ overflow: "visible" }}>
      <defs>
        {rings.map(r => (
          <linearGradient key={r.id} id={r.id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={r.c1} />
            <stop offset="100%" stopColor={r.c2} />
          </linearGradient>
        ))}
        <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(62,255,160,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Subtle center glow */}
      <circle cx={C} cy={C} r={C} fill="url(#bgGrad)" />

      {rings.map((ring, i) => {
        const circ = 2 * Math.PI * ring.r;
        const offset = circ * (1 - Math.min(ring.p, 1));
        const [ex, ey] = capPos(C, C, ring.r, ring.p);
        const hasP = ring.p > 0.015;
        const done = ring.p >= 0.99;

        return (
          <g key={ring.id}>
            {/* Track ring */}
            <circle cx={C} cy={C} r={ring.r} fill="none"
              stroke="rgba(255,255,255,0.07)" strokeWidth={ring.w} />

            {/* Glow bloom layer */}
            {hasP && (
              <circle cx={C} cy={C} r={ring.r} fill="none"
                stroke={ring.c1}
                strokeWidth={ring.w + 14}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${C} ${C})`}
                style={{
                  opacity: (goalMet && i === 0) ? 0.38 : 0.16,
                  filter: "blur(9px)",
                  transition: "stroke-dashoffset 1.35s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              />
            )}

            {/* Main arc */}
            <circle cx={C} cy={C} r={ring.r} fill="none"
              stroke={`url(#${ring.id})`}
              strokeWidth={ring.w}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${C} ${C})`}
              style={{ transition: "stroke-dashoffset 1.35s cubic-bezier(0.34,1.56,0.64,1)" }}
            />

            {/* Leading-edge cap dot */}
            {hasP && !done && (
              <circle cx={ex} cy={ey} r={ring.w / 2 - 1} fill={ring.c2}
                style={{ filter: `drop-shadow(0 0 7px ${ring.c2})` }} />
            )}

            {/* Completion: shadow cap at 12 o'clock */}
            {done && (
              <circle cx={C} cy={C - ring.r} r={ring.w / 2}
                fill={ring.c1}
                style={{ filter: `drop-shadow(0 0 10px ${ring.c1}BB)` }} />
            )}
          </g>
        );
      })}

      {/* Goal-met pulse ring */}
      {goalMet && (
        <circle cx={C} cy={C} r={rings[0].r} fill="none"
          stroke="#3EFFA0" strokeWidth={rings[0].w + 18}
          style={{ opacity: 0.28, filter: "blur(10px)", animation: "goalPulse 2.2s ease-in-out infinite" }} />
      )}
    </svg>
  );
}

// ─── Add Session Modal ────────────────────────────────────────────────────────
function Modal({ onAdd, onClose }) {
  const [mins, setMins] = useState("");
  const [secs, setSecs] = useState("");
  const [when, setWhen] = useState(nowInput);
  const mRef = useRef();

  useEffect(() => { setTimeout(() => mRef.current?.focus(), 120); }, []);

  const durSec = (parseInt(mins) || 0) * 60 + Math.min(parseInt(secs) || 0, 59);
  const valid = durSec >= 60;
  const pctOfGoal = Math.round((durSec / GOAL_SEC) * 100);

  function submit() {
    if (!valid) return;
    onAdd({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: new Date(when).toISOString(),
      duration: durSec,
    });
    onClose();
  }

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.sheet} onClick={e => e.stopPropagation()}>
        <div style={M.handle} />
        <p style={M.title}>Log Zone 2 Session</p>
        <p style={M.sub}>Heart Rate 136–147 BPM · Enter duration in MM:SS</p>

        {/* Time pickers */}
        <div style={M.timeRow}>
          <div style={M.timeField}>
            <input ref={mRef} type="text" inputMode="numeric"
              placeholder="45" maxLength={3} value={mins}
              onChange={e => setMins(e.target.value.replace(/\D/g, "").slice(0, 3))}
              onKeyDown={e => e.key === "Enter" && submit()}
              style={M.timeIn}
            />
            <span style={M.unit}>MIN</span>
          </div>
          <span style={M.colon}>:</span>
          <div style={M.timeField}>
            <input type="text" inputMode="numeric"
              placeholder="00" maxLength={2} value={secs}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                setSecs(Math.min(parseInt(v) || 0, 59) === parseInt(v) ? v : "59");
              }}
              onKeyDown={e => e.key === "Enter" && submit()}
              style={M.timeIn}
            />
            <span style={M.unit}>SEC</span>
          </div>
        </div>

        {/* Preview */}
        <div style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
          {valid && (
            <p style={M.preview}>
              {Math.floor(durSec / 60)}m {durSec % 60 > 0 ? `${durSec % 60}s` : ""}
              <span style={{ color: "#505070", fontWeight: 400 }}> · {pctOfGoal}% of weekly goal</span>
            </p>
          )}
          {!valid && mins && (
            <p style={{ ...M.preview, color: "#FF5555" }}>At least 1 minute required</p>
          )}
        </div>

        {/* When row */}
        <div style={M.whenRow}>
          <span style={M.whenLbl}>📅 When</span>
          <input type="datetime-local" value={when}
            onChange={e => setWhen(e.target.value)}
            style={M.whenIn}
          />
        </div>

        <button onClick={submit} disabled={!valid}
          style={{ ...M.btn, opacity: valid ? 1 : 0.35, cursor: valid ? "pointer" : "not-allowed" }}>
          Log Session
        </button>
        <button onClick={onClose} style={M.cancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ s, onDel }) {
  const [press, setPress] = useState(false);
  return (
    <div className="session-card"
      style={{
        ...C_.card,
        transform: press ? "scale(0.975)" : "scale(1)",
        background: press ? "rgba(62,255,160,0.04)" : "rgba(255,255,255,0.033)",
      }}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
    >
      <div style={C_.left}>
        <div style={C_.dot} />
        <div>
          <span style={C_.dur}>{fmtSec(s.duration)}</span>
          <span style={C_.time}>{fmtTime(s.date)}</span>
        </div>
      </div>
      <button onClick={() => onDel(s.id)} style={C_.del}>×</button>
    </div>
  );
}

// ─── Session Log ──────────────────────────────────────────────────────────────
function SessionLog({ sessions, onDel }) {
  const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const map = {}, order = [];
  sorted.forEach(s => {
    const L = dayLabel(s.date);
    if (!map[L]) { map[L] = []; order.push(L); }
    map[L].push(s);
  });

  if (!sorted.length) return (
    <div style={L_.empty}>
      <div style={{ fontSize: 46, opacity: 0.5, marginBottom: 14 }}>🫀</div>
      <p style={L_.emptyT}>No sessions this week yet</p>
      <p style={L_.emptyS}>Tap the + button to log your first session</p>
    </div>
  );

  return (
    <div>
      {order.map(L => (
        <div key={L} style={{ marginBottom: 24 }}>
          <p style={L_.day}>{L}</p>
          {map[L].map(s => <SessionCard key={s.id} s={s} onDel={onDel} />)}
        </div>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [all, setAll] = useState([]);
  const [modal, setModal] = useState(false);
  const [anim, setAnim] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available, notify user
                if (confirm('New version available! Would you like to update?')) {
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch(error => console.log('Service worker registration failed:', error));
    }
  }, []);

  // Inject fonts + global styles
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Mulish:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = GCSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    load().then(d => { setAll(d); setTimeout(() => setAnim(true), 220); });
  }, []);

  const week = all.filter(s => inWeek(s.date));
  const totalSec = week.reduce((a, s) => a + s.duration, 0);
  const days = new Set(week.map(s => new Date(s.date).toDateString())).size;
  const goalMet = totalSec >= GOAL_SEC;
  const pct = Math.min(Math.round(totalSec / GOAL_SEC * 100), 999);
  const rem = Math.max(GOAL_SEC - totalSec, 0);

  const p1 = anim ? Math.min(totalSec / GOAL_SEC, 1) : 0;
  const p2 = anim ? Math.min(days / 5, 1) : 0;
  const p3 = anim ? Math.min(week.length / 7, 1) : 0;

  async function add(s) { const n = [...all, s]; setAll(n); await save(n); }
  async function del(id) { const n = all.filter(s => s.id !== id); setAll(n); await save(n); }

  return (
    <div style={A.root}>
      {/* Top ambient glow */}
      <div style={A.ambGlow} />

      {/* ── Header ── */}
      <div style={A.hdr}>
        <div>
          <p style={A.sup}>136–147 BPM · Weekly Tracker</p>
          <h1 style={A.h1}>ZONE 2</h1>
        </div>
        <div style={A.pill}>
          <p style={A.pillT}>{weekLabel()}</p>
        </div>
      </div>

      {/* ── Rings Section ── */}
      <div style={A.ringSec}>
        <div style={A.ringBox}>
          <ActivityRings p1={p1} p2={p2} p3={p3} goalMet={goalMet} />

          {/* Center overlay */}
          <div style={A.center}>
            {goalMet ? (
              <>
                <div className="check-pop" style={A.checkIcon}>✓</div>
                <p style={A.goalTxt}>GOAL REACHED</p>
                <p style={A.goalSub}>{fmtSec(totalSec)} logged</p>
              </>
            ) : (
              <>
                <p style={A.pct}>
                  {pct}<span style={{ fontSize: 22, fontWeight: 400, letterSpacing: 0 }}>%</span>
                </p>
                <p style={A.elapsed}>{fmtSec(totalSec)}</p>
                <p style={A.ofGoal}>of {GOAL_MIN} min</p>
              </>
            )}
          </div>
        </div>

        {/* Ring legend */}
        <div style={A.legend}>
          {[
            { dot: "#3EFFA0", label: "Minutes", val: `${Math.floor(totalSec / 60)}/${GOAL_MIN}` },
            { dot: "#FF9F4A", label: "Days", val: `${days}/5` },
            { dot: "#B06CFF", label: "Sessions", val: `${week.length}/7` },
          ].map(x => (
            <div key={x.label} style={A.lgItem}>
              <div style={{ ...A.lgDot, background: x.dot, boxShadow: `0 0 9px ${x.dot}70` }} />
              <div>
                <p style={A.lgLbl}>{x.label}</p>
                <p style={A.lgVal}>{x.val}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Status Banner ── */}
      <div style={{ ...A.banner, ...(goalMet ? A.bannerWin : {}) }}>
        <span style={{ fontSize: 17 }}>{goalMet ? "🏆" : "⚡"}</span>
        <span style={A.bannerTxt}>
          {goalMet
            ? (totalSec > GOAL_SEC
              ? `Crushed it! +${fmtSec(totalSec - GOAL_SEC)} over target`
              : "Goal reached — perfect week!")
            : `${fmtSec(rem)} remaining to hit your weekly goal`}
        </span>
      </div>

      {/* ── Session Log ── */}
      <div style={A.logWrap}>
        <div style={A.logHdr}>
          <h2 style={A.logTitle}>This Week's Log</h2>
          {week.length > 0 && (
            <span style={A.logCount}>{week.length} session{week.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <SessionLog sessions={week} onDel={del} />
      </div>

      {/* ── FAB ── */}
      <button style={A.fab} onClick={() => setModal(true)} aria-label="Log session">
        <span style={A.fabPlus}>+</span>
      </button>

      {modal && <Modal onAdd={add} onClose={() => setModal(false)} />}
    </div>
  );
}

// ─── Style Objects ─────────────────────────────────────────────────────────────
const A = {
  root: {
    minHeight: "100vh",
    background: "#05050C",
    fontFamily: "'Mulish', sans-serif",
    color: "#E4E4F4",
    maxWidth: 430,
    margin: "0 auto",
    paddingBottom: 120,
    position: "relative",
    overflowX: "hidden",
  },
  ambGlow: {
    position: "fixed",
    top: 0, left: "50%",
    transform: "translateX(-50%)",
    width: 520, height: 360,
    background: "radial-gradient(ellipse at 50% 0%, rgba(62,255,160,0.065) 0%, transparent 65%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  hdr: {
    position: "relative", zIndex: 1,
    padding: "54px 22px 14px",
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
  },
  sup: {
    fontSize: 10, letterSpacing: 2, color: "#3EFFA0",
    textTransform: "uppercase", fontWeight: 700, marginBottom: 6,
  },
  h1: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 42, fontWeight: 700, letterSpacing: 7,
    color: "#FFFFFF", lineHeight: 1,
  },
  pill: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "7px 12px",
  },
  pillT: { fontSize: 11, color: "#6868A0", fontWeight: 600 },

  ringSec: {
    position: "relative", zIndex: 1,
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "8px 22px 6px",
  },
  ringBox: {
    position: "relative",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  },
  center: {
    position: "absolute",
    display: "flex", flexDirection: "column", alignItems: "center",
    textAlign: "center", pointerEvents: "none",
  },
  pct: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 60, fontWeight: 700, color: "#FFFFFF",
    lineHeight: 1, letterSpacing: -2,
  },
  elapsed: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 19, fontWeight: 500, color: "#3EFFA0",
    marginTop: 4, letterSpacing: 1,
  },
  ofGoal: {
    fontSize: 10, color: "#353555",
    marginTop: 3, textTransform: "uppercase", letterSpacing: 1.5,
  },
  checkIcon: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 50, color: "#3EFFA0", lineHeight: 1,
    filter: "drop-shadow(0 0 14px rgba(62,255,160,0.8))",
  },
  goalTxt: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 11, fontWeight: 700, color: "#3EFFA0",
    letterSpacing: 3, marginTop: 5,
  },
  goalSub: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 16, color: "#6060A0", marginTop: 4,
  },

  legend: {
    display: "flex", gap: 18, marginTop: 16, justifyContent: "center",
  },
  lgItem: { display: "flex", alignItems: "center", gap: 8 },
  lgDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  lgLbl: {
    fontSize: 9, color: "#353555", textTransform: "uppercase",
    letterSpacing: 1.2, fontWeight: 800, lineHeight: 1.3,
  },
  lgVal: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 14, fontWeight: 600, color: "#9090B8", lineHeight: 1.3,
  },

  banner: {
    position: "relative", zIndex: 1,
    margin: "10px 20px",
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, padding: "12px 16px",
    display: "flex", alignItems: "center", gap: 10,
  },
  bannerWin: {
    background: "rgba(62,255,160,0.07)",
    borderColor: "rgba(62,255,160,0.24)",
  },
  bannerTxt: { fontSize: 13, fontWeight: 600, color: "#9090C0", lineHeight: 1.4 },

  logWrap: { position: "relative", zIndex: 1, padding: "18px 20px 0" },
  logHdr: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  logTitle: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 10, fontWeight: 700, letterSpacing: 3,
    textTransform: "uppercase", color: "#2C2C4C",
  },
  logCount: {
    fontSize: 11, fontWeight: 700, color: "#3C3C60",
    letterSpacing: 0.5, textTransform: "uppercase",
  },

  fab: {
    position: "fixed", bottom: 38, left: "50%",
    transform: "translateX(-50%)",
    width: 70, height: 70, borderRadius: 35,
    background: "linear-gradient(135deg, #3EFFA0 0%, #00CFFF 100%)",
    border: "none", cursor: "pointer", zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: "fabGlow 3s ease-in-out infinite",
  },
  fabPlus: {
    fontSize: 40, color: "#05050C",
    fontWeight: 200, lineHeight: 1,
    fontFamily: "'Mulish', sans-serif",
    marginTop: -3,
  },
};

const C_ = {
  card: {
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16, padding: "14px 14px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 9,
    transition: "transform 0.14s ease, background 0.14s ease",
    cursor: "default",
  },
  left: { display: "flex", alignItems: "center", gap: 14 },
  dot: {
    width: 13, height: 13, borderRadius: "50%",
    background: "linear-gradient(135deg, #3EFFA0, #00CFFF)",
    flexShrink: 0,
    boxShadow: "0 0 10px rgba(62,255,160,0.55)",
  },
  dur: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 23, fontWeight: 600, color: "#FFFFFF",
    display: "block", lineHeight: 1.2, letterSpacing: 0.5,
  },
  time: {
    fontSize: 11, color: "#3C3C60",
    display: "block", marginTop: 3, fontWeight: 700, letterSpacing: 0.5,
  },
  del: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8, width: 30, height: 30,
    color: "#383858", cursor: "pointer", fontSize: 20,
    display: "flex", alignItems: "center", justifyContent: "center",
    lineHeight: 1, flexShrink: 0, paddingBottom: 1,
  },
};

const L_ = {
  empty: { textAlign: "center", padding: "44px 0 20px" },
  emptyT: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 15, fontWeight: 600, color: "#282840", marginBottom: 8,
  },
  emptyS: { fontSize: 13, color: "#1E1E38", lineHeight: 1.5 },
  day: {
    fontSize: 10, fontWeight: 800, color: "#3C3C62",
    textTransform: "uppercase", letterSpacing: 2.2, marginBottom: 10,
  },
};

const M = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.82)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    zIndex: 100, display: "flex",
    alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    background: "#09091A",
    borderRadius: "24px 24px 0 0",
    padding: "0 22px 52px",
    width: "100%", maxWidth: 430,
    borderTop: "1px solid rgba(255,255,255,0.09)",
    animation: "slideUp 0.38s cubic-bezier(0.34,1.56,0.64,1)",
  },
  handle: {
    width: 40, height: 4,
    background: "rgba(255,255,255,0.13)",
    borderRadius: 2, margin: "16px auto 22px",
  },
  title: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 17, fontWeight: 600, color: "#FFFFFF", marginBottom: 4,
  },
  sub: {
    fontSize: 11, color: "#3EFFA0",
    letterSpacing: 0.3, fontWeight: 600, marginBottom: 24,
  },
  timeRow: {
    display: "flex", alignItems: "flex-end",
    justifyContent: "center", gap: 6, marginBottom: 4,
  },
  timeField: {
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  timeIn: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 68, fontWeight: 600, color: "#FFFFFF",
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 14, outline: "none",
    textAlign: "center", width: 128,
    caretColor: "#3EFFA0", padding: "6px 4px",
    lineHeight: 1,
  },
  unit: {
    fontSize: 9, color: "#303050",
    textTransform: "uppercase", letterSpacing: 1.5,
    marginTop: 7, fontWeight: 800,
  },
  colon: {
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 68, fontWeight: 700, color: "#3EFFA0",
    lineHeight: 1, paddingBottom: 26,
    textShadow: "0 0 20px rgba(62,255,160,0.5)",
  },
  preview: {
    fontSize: 13, fontWeight: 700, color: "#3EFFA0", letterSpacing: 0.3,
  },
  whenRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, padding: "13px 16px",
    marginBottom: 16, marginTop: 8,
  },
  whenLbl: { fontSize: 13, color: "#444466", fontWeight: 700 },
  whenIn: {
    background: "transparent", border: "none",
    color: "#8080A8", fontSize: 13,
    fontFamily: "'Mulish', sans-serif",
    fontWeight: 600, outline: "none",
  },
  btn: {
    width: "100%", padding: "18px",
    background: "linear-gradient(135deg, #3EFFA0 0%, #00CFFF 100%)",
    border: "none", borderRadius: 18,
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 15, fontWeight: 700,
    letterSpacing: 3, textTransform: "uppercase",
    color: "#05050C", marginBottom: 8,
    transition: "opacity 0.2s",
  },
  cancel: {
    width: "100%", padding: "12px",
    background: "transparent", border: "none",
    color: "#2C2C4A", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "'Mulish', sans-serif",
  },
};