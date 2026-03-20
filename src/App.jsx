import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase.js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, LabelList,
} from "recharts";

const STAT_TYPES = ["DMG", "KILL", "HEAL", "REVIVE", "NAT 20", "NAT 1"];
const STAT_ICONS = { DMG: "⚔", KILL: "💀", HEAL: "❤", REVIVE: "✦", "NAT 20": "★", "NAT 1": "✗" };
const STAT_COLORS = {
  DMG: "#d4442a", KILL: "#8b1a1a", HEAL: "#2e8b57", REVIVE: "#4682b4",
  "NAT 20": "#daa520", "NAT 1": "#5c5550",
};
const PLAYER_COLORS = ["#d4442a","#4682b4","#2e8b57","#daa520","#9b59b6","#e67e22","#1abc9c","#e74c6c","#8bc34a","#cd853f"];
const MAX_ROUNDS = 20;
const DMG_TYPES = ["Slashing","Piercing","Bludgeoning","Fire","Cold","Lightning","Thunder","Poison","Acid","Necrotic","Radiant","Force","Psychic"];
const DMG_TYPE_COLORS = { Slashing:"#d4442a", Piercing:"#c17f3a", Bludgeoning:"#8b7355", Fire:"#e85d04", Cold:"#4fc3f7", Lightning:"#ffd54f", Thunder:"#9575cd", Poison:"#66bb6a", Acid:"#aed581", Necrotic:"#7e57c2", Radiant:"#fff176", Force:"#80deea", Psychic:"#f48fb1" };
const DEFAULT_PLAYERS = ["King Gizzard", "Lucien", "Shio", "Kazzak", "Fazula"];

const TROPHY_PLACEHOLDERS = [
  "No artist dared capture its likeness",
  "The bards refuse to describe this one",
  "Its visage has been lost to the ages",
  "Even the court painter fled in terror",
  "Some horrors are best left unillustrated",
  "The sketch artist fainted mid-drawing",
  "This portrait was consumed by dragonfire",
  "Witnesses could only describe the smell",
  "The illustrator demanded hazard pay and quit",
  "Legend says the mirror cracked when it looked",
  "A thousand gold bounty and no portrait to show",
  "The Royal Chronicler simply wrote: 'no'",
  "Its form defies parchment and ink alike",
  "Three painters attempted. None returned",
  "The guild of artists unanimously declined",
];

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Unique ID for this browser tab. Used to suppress realtime echoes of our own saves.
const CLIENT_ID = generateId();

function createEmptyBattle(name, players) {
  const data = {};
  const dmgEntries = {};
  const dmgBase = {};
  const namedKills = {};
  players.forEach((p) => {
    data[p] = {};
    STAT_TYPES.forEach((s) => { data[p][s] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) data[p][s][r] = 0; });
    dmgEntries[p] = {};
    dmgBase[p] = {};
    namedKills[p] = {};
    for (let r = 1; r <= MAX_ROUNDS; r++) { dmgEntries[p][r] = []; dmgBase[p][r] = 0; namedKills[p][r] = []; }
  });
  return { id: generateId(), name, rounds: 1, data, dmgEntries, dmgBase, namedKills };
}

/* ─── Persistence (Supabase when configured, localStorage otherwise) ─── */
const STORAGE_KEY = "wrencoria-dnd-v4";
const CAMPAIGN_ID = "default";
let _saveTimer = null;
let _onSyncChange = null; // set by the App component to update sync status

async function loadState() {
  if (supabase) {
    try {
      const { data } = await supabase
        .from("campaigns")
        .select("state")
        .eq("id", CAMPAIGN_ID)
        .single();
      if (data?.state && Object.keys(data.state).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.state));
        return data.state;
      }
    } catch {}
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

async function saveState(state) {
  // Always write localStorage immediately as an offline backup.
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}

  if (!supabase) return;

  // Debounce Supabase writes so rapid typing doesn't hammer the API.
  _onSyncChange?.("saving");
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      await supabase.from("campaigns").upsert({
        id: CAMPAIGN_ID,
        state,
        client_id: CLIENT_ID,
        updated_at: new Date().toISOString(),
      });
      _onSyncChange?.("saved");
    } catch {
      _onSyncChange?.("error");
    }
  }, 1200);
}

/* ─── Ornament SVG elements ─── */
const Divider = () => (
  <div style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0 12px", opacity:0.5 }}>
    <div style={{ flex:1, height:1, background:"linear-gradient(90deg, transparent, #8b7355, transparent)" }}/>
    <svg width="18" height="18" viewBox="0 0 20 20"><path d="M10 2l2.5 5.5L18 8.5l-4 4 1 5.5-5-3-5 3 1-5.5-4-4 5.5-1z" fill="none" stroke="#8b7355" strokeWidth="1.2"/></svg>
    <div style={{ flex:1, height:1, background:"linear-gradient(90deg, transparent, #8b7355, transparent)" }}/>
  </div>
);

const D20Icon = ({ size = 28, color = "#daa520" }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{ verticalAlign: "middle" }}>
    <polygon points="20,2 37,14 32,35 8,35 3,14" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/>
    <polygon points="20,2 8,35 32,35" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5"/>
    <line x1="20" y1="2" x2="37" y2="14" stroke={color} strokeWidth="0.5" opacity="0.3"/>
    <line x1="20" y1="2" x2="3" y2="14" stroke={color} strokeWidth="0.5" opacity="0.3"/>
    <line x1="3" y1="14" x2="32" y2="35" stroke={color} strokeWidth="0.5" opacity="0.3"/>
    <line x1="37" y1="14" x2="8" y2="35" stroke={color} strokeWidth="0.5" opacity="0.3"/>
    <text x="20" y="23" textAnchor="middle" fill={color} fontSize="11" fontFamily="MedievalSharp, serif" fontWeight="bold">20</text>
  </svg>
);

/* ─── Tooltip ─── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1a1510", border:"1px solid #5c4a32", borderRadius:4, padding:"8px 12px", fontSize:11, fontFamily:"'Spectral', serif", boxShadow:"0 4px 20px rgba(0,0,0,0.6)" }}>
      <div style={{ color:"#daa520", marginBottom:4, fontWeight:700, fontFamily:"'MedievalSharp', cursive" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill, display:"flex", justifyContent:"space-between", gap:14 }}>
          <span>{p.name || p.dataKey}</span>
          <span style={{ fontWeight:700 }}>{typeof p.value === "number" ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(1)) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── UI Atoms ─── */
function StatBadge({ stat, value, small }) {
  return (
    <span style={{
      background: STAT_COLORS[stat] + "1a", color: STAT_COLORS[stat],
      fontWeight:700, fontSize: small ? 11 : 13, padding: small ? "2px 7px" : "3px 9px",
      borderRadius:3, fontFamily:"'Spectral', serif", letterSpacing:0,
      border:`1px solid ${STAT_COLORS[stat]}30`, display:"inline-flex", alignItems:"center", gap:3,
    }}>
      {small ? null : <span style={{ fontSize: small ? 9 : 11 }}>{STAT_ICONS[stat]}</span>}
      {value}
    </span>
  );
}

function Pill({ children, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "linear-gradient(180deg, #3a2a18, #2a1e10)" : "transparent",
      color: active ? "#daa520" : "#8b7355",
      border: active ? "1px solid #5c4a32" : "1px solid #3a3020",
      borderRadius:4, padding:"5px 14px", fontSize:12, fontWeight:600,
      cursor:"pointer", transition:"all .15s",
      fontFamily:"'Spectral', serif", whiteSpace:"nowrap",
      boxShadow: active ? "inset 0 1px 0 rgba(218,165,32,0.15), 0 2px 8px rgba(0,0,0,0.3)" : "none",
      textShadow: active ? "0 0 8px rgba(218,165,32,0.3)" : "none",
    }}>{children}</button>
  );
}

function SectionTitle({ children, icon }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, marginTop:4 }}>
      {icon && <span style={{ fontSize:14 }}>{icon}</span>}
      <div style={{ fontSize:13, fontWeight:700, fontFamily:"'MedievalSharp', cursive", letterSpacing:1.5, color:"#daa520", textTransform:"uppercase" }}>{children}</div>
      <div style={{ flex:1, height:1, background:"linear-gradient(90deg, #5c4a32, transparent)" }}/>
    </div>
  );
}

function KpiCard({ label, value, color, sub, icon }) {
  return (
    <div style={{
      background:"linear-gradient(160deg, #1e1810 0%, #16120e 100%)",
      borderRadius:6, padding:"14px 16px", border:"1px solid #3a3020",
      boxShadow:"inset 0 1px 0 rgba(218,165,32,0.06), 0 2px 12px rgba(0,0,0,0.3)",
      position:"relative", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", top:8, right:10, fontSize:22, opacity:0.08 }}>{icon}</div>
      <div style={{ fontSize:9, color:"#8b7355", textTransform:"uppercase", letterSpacing:1.2, marginBottom:6, fontFamily:"'Spectral', serif" }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color, fontFamily:"'MedievalSharp', cursive", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"#5c4a32", marginTop:4, fontFamily:"'Spectral', serif" }}>{sub}</div>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={{ display:"flex", alignItems:"center", gap:6 }}>
      <span style={{ fontSize:10, color:"#8b7355", textTransform:"uppercase", letterSpacing:1, fontFamily:"'Spectral', serif" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        background:"#1a1510", color:"#c4a97d", border:"1px solid #3a3020",
        borderRadius:4, padding:"4px 8px", fontSize:12,
        fontFamily:"'Spectral', serif", cursor:"pointer",
      }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function ChartCard({ title, children, height, icon }) {
  return (
    <div style={{
      background:"linear-gradient(160deg, #1e1810, #16120e)",
      borderRadius:6, border:"1px solid #3a3020", padding:"14px 14px 6px", marginBottom:14,
      boxShadow:"0 2px 12px rgba(0,0,0,0.3)",
    }}>
      {title && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
          {icon && <span style={{ fontSize:12 }}>{icon}</span>}
          <span style={{ fontSize:11, fontWeight:700, fontFamily:"'MedievalSharp', cursive", letterSpacing:1, color:"#8b7355", textTransform:"uppercase" }}>{title}</span>
        </div>
      )}
      <div style={{ width:"100%", height: height || 220 }}>{children}</div>
    </div>
  );
}

/* ─── Parchment Panel ─── */
function ParchmentPanel({ children, style: extraStyle }) {
  return (
    <div style={{
      background: "linear-gradient(170deg, #1e1810 0%, #16120e 40%, #1a1510 100%)",
      border: "1px solid #3a3020",
      borderRadius: 6,
      padding: 16,
      boxShadow: "inset 0 1px 0 rgba(218,165,32,0.05), 0 4px 24px rgba(0,0,0,0.4)",
      ...extraStyle,
    }}>{children}</div>
  );
}

/* ─── Stepper ─── */
function Stepper({ value, min = 0, onChange }) {
  const canDec = value > min;
  const btn = {
    background: "#16120c", border: "1px solid #3a3020", borderRadius: 3,
    fontSize: 14, fontWeight: 700, width: 18, height: 20, padding: 0,
    lineHeight: "18px", textAlign: "center",
    fontFamily: "'Spectral', serif", flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    userSelect: "none",
  };
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:2 }}>
      <button onClick={() => canDec && onChange(value - 1)}
        style={{ ...btn, color: canDec ? "#c4a97d" : "#2a2018", cursor: canDec ? "pointer" : "default" }}>−</button>
      <span style={{ minWidth:20, textAlign:"center", fontSize:12, fontWeight:700,
        color: value > 0 ? "#c4a97d" : "#3a3020", fontFamily:"'Spectral', serif",
        userSelect:"none", display:"inline-block" }}>{value > 0 ? value : "–"}</span>
      <button onClick={() => onChange(value + 1)}
        style={{ ...btn, color:"#c4a97d", cursor:"pointer" }}>+</button>
    </div>
  );
}

/* ─── Kill Cell ─── */
function KillCell({ value, namedKills, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [newKillName, setNewKillName] = useState("");
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const namedCount = namedKills.length;

  useEffect(() => {
    if (!open) return;
    const handler = (ev) => {
      const inTrigger = ref.current && ref.current.contains(ev.target);
      const inPanel = panelRef.current && panelRef.current.contains(ev.target);
      if (!inTrigger && !inPanel) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const getRect = () => {
    const r = ref.current.getBoundingClientRect();
    return { top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 224) };
  };

  const openPanel = () => { setPos(getRect()); setTooltipVisible(false); setOpen(true); };
  const addNamedKill = () => {
    const n = newKillName.trim();
    if (!n) return;
    const kills = [...namedKills, { id: generateId(), name: n }];
    onUpdate(value + 1, kills);
    setNewKillName("");
  };
  const removeNamedKill = (id) => {
    const kills = namedKills.filter((k) => k.id !== id);
    onUpdate(Math.max(0, value - 1), kills);
  };

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", gap:3, justifyContent:"center" }}>
      <Stepper value={value} min={namedCount} onChange={(v) => onUpdate(v, namedKills)} />

      {/* Gold badge showing named kill count */}
      {namedCount > 0 && (
        <span
          onMouseEnter={() => { if (!open) { setPos(getRect()); setTooltipVisible(true); } }}
          onMouseLeave={() => setTooltipVisible(false)}
          onClick={openPanel}
          style={{ fontSize:9, color:"#daa520", fontWeight:700, cursor:"pointer", padding:"1px 4px", background:"#1a1200", border:"1px solid #4a3800", borderRadius:3, letterSpacing:0.5, userSelect:"none" }}
        >☠ {namedCount}</span>
      )}

      {/* Skull toggle button */}
      <button onClick={openPanel} title="Name a kill"
        style={{ background: namedCount > 0 ? "#1a1208" : "#2a1e10", border:`1px solid ${namedCount > 0 ? "#4a3800" : "#3a3020"}`, borderRadius:3, color: namedCount > 0 ? "#daa520" : "#5c4a32", cursor:"pointer", fontSize:10, padding:"0px 4px", lineHeight:"14px" }}>☠</button>

      {/* Hover breakdown tooltip */}
      {tooltipVisible && !open && namedCount > 0 && (
        <div style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:200, background:"#1a1510", border:"1px solid #5c4a32", borderRadius:4, padding:"6px 10px", fontSize:11, fontFamily:"'Spectral', serif", pointerEvents:"none", whiteSpace:"nowrap", boxShadow:"0 4px 16px rgba(0,0,0,0.6)" }}>
          <div style={{ fontSize:9, color:"#8b7355", marginBottom:4, letterSpacing:1 }}>NAMED KILLS</div>
          {namedKills.map((k) => (
            <div key={k.id} style={{ color:"#daa520", display:"flex", gap:6, alignItems:"center" }}>
              <span>☠</span><span style={{ fontStyle:"italic" }}>{k.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Entry panel */}
      {open && (
        <div ref={panelRef} style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:300, background:"#1a1510", border:"1px solid #5c4a32", borderRadius:6, padding:"10px 12px", minWidth:218, boxShadow:"0 8px 32px rgba(0,0,0,0.7)", fontFamily:"'Spectral', serif" }}>
          <div style={{ fontSize:10, color:"#daa520", fontFamily:"'MedievalSharp', cursive", marginBottom:8, letterSpacing:1 }}>Named Kills</div>
          {namedKills.length > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
              {namedKills.map((k) => (
                <div key={k.id} style={{ display:"flex", alignItems:"center", gap:6, background:"#110e00", borderRadius:3, padding:"4px 8px", border:"1px solid #2a2000" }}>
                  <span style={{ color:"#daa520", fontSize:12, flexShrink:0 }}>☠</span>
                  <span style={{ color:"#daa520", fontSize:12, fontStyle:"italic", flex:1 }}>{k.name}</span>
                  <button onClick={() => removeNamedKill(k.id)} style={{ background:"transparent", border:"none", color:"#5c3030", cursor:"pointer", fontSize:13, fontWeight:700, padding:"0 2px", lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:11, color:"#3a3020", fontStyle:"italic", marginBottom:8 }}>No named kills yet</div>
          )}
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <input value={newKillName} onChange={(e) => setNewKillName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNamedKill()}
              placeholder="Name the fallen…"
              style={{ background:"#0d0b09", border:"1px solid #3a3020", borderRadius:3, color:"#daa520", fontFamily:"'Spectral', serif", fontSize:11, fontWeight:600, padding:"4px 6px", flex:1, outline:"none", fontStyle:"italic" }} />
            <button onClick={addNamedKill} style={{ background:"#1a1208", border:"1px solid #5c4a32", borderRadius:3, color:"#daa520", cursor:"pointer", fontSize:11, padding:"4px 8px" }}>Add</button>
          </div>
          <div style={{ fontSize:9, color:"#3a3020", marginTop:6, fontStyle:"italic" }}>Each named kill also counts toward the total.</div>
        </div>
      )}
    </div>
  );
}

/* ─── Damage Cell ─── */
function DmgCell({ base, typedEntries, defaultType, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [newAmt, setNewAmt] = useState(1);
  const [newType, setNewType] = useState(defaultType || DMG_TYPES[0]);
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const typedTotal = typedEntries.reduce((a, e) => a + (e.amount || 0), 0);
  const total = base + typedTotal;
  const hasTyped = typedEntries.length > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (ev) => {
      const inTrigger = ref.current && ref.current.contains(ev.target);
      const inPanel = panelRef.current && panelRef.current.contains(ev.target);
      if (!inTrigger && !inPanel) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const getRect = () => {
    const r = ref.current.getBoundingClientRect();
    return { top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 248) };
  };

  const openPanel = () => { setPos(getRect()); setNewType(defaultType || DMG_TYPES[0]); setTooltipVisible(false); setOpen(true); };
  const updTyped = (next) => onUpdate(base, next);
  const addTyped = () => { if (newAmt <= 0) return; updTyped([...typedEntries, { amount: newAmt, type: newType }]); setNewAmt(1); };
  const removeTyped = (i) => updTyped(typedEntries.filter((_, j) => j !== i));
  const updateTypedAmt = (i, v) => updTyped(typedEntries.map((e, j) => j === i ? { ...e, amount: v } : e));

  const dmgRed = "#d4442a";
  const stepBtn = { background:"#16120c", border:"1px solid #3a3020", borderRadius:3, fontSize:14, fontWeight:700, width:18, height:20, padding:0, lineHeight:"18px", textAlign:"center", fontFamily:"'Spectral', serif", flexShrink:0, display:"inline-flex", alignItems:"center", justifyContent:"center", userSelect:"none" };

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", gap:2 }}>
      {/* Stepper — shows total, ± controls base untyped damage */}
      <button onClick={() => base > 0 && onUpdate(base - 1, typedEntries)}
        style={{ ...stepBtn, color: base > 0 ? dmgRed : "#2a2018", cursor: base > 0 ? "pointer" : "default" }}>−</button>
      <span style={{ minWidth:20, textAlign:"center", fontSize:12, fontWeight:700, color: total > 0 ? dmgRed : "#3a3020", fontFamily:"'Spectral', serif", userSelect:"none", display:"inline-block" }}>
        {total > 0 ? total : "–"}
      </span>
      <button onClick={() => onUpdate(base + 1, typedEntries)}
        style={{ ...stepBtn, color: dmgRed, cursor:"pointer" }}>+</button>

      {/* Flame button — opens typed breakdown panel */}
      <button onClick={openPanel}
        onMouseEnter={() => { if (!open && (hasTyped || base > 0)) { setPos(getRect()); setTooltipVisible(true); } }}
        onMouseLeave={() => setTooltipVisible(false)}
        title="Typed damage breakdown"
        style={{ background: hasTyped ? "#140e00" : "#16120c", border:`1px solid ${hasTyped ? "#4a3200" : "#2a2018"}`, borderRadius:3, color: hasTyped ? "#daa520" : "#3a3020", cursor:"pointer", fontSize:11, width:17, height:20, padding:0, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>🔥</button>

      {/* Hover breakdown tooltip */}
      {tooltipVisible && !open && (hasTyped || base > 0) && (
        <div style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:200, background:"#1a1510", border:"1px solid #5c4a32", borderRadius:4, padding:"6px 10px", fontSize:11, fontFamily:"'Spectral', serif", pointerEvents:"none", whiteSpace:"nowrap", boxShadow:"0 4px 16px rgba(0,0,0,0.6)" }}>
          {base > 0 && <div style={{ color:"#8b7355", display:"flex", gap:8 }}><span style={{ fontWeight:700 }}>{base}</span><span>Untyped</span></div>}
          {typedEntries.map((e, i) => (
            <div key={i} style={{ color: DMG_TYPE_COLORS[e.type] || "#c4a97d", display:"flex", gap:8 }}>
              <span style={{ fontWeight:700 }}>{e.amount}</span><span>{e.type || "—"}</span>
            </div>
          ))}
          {hasTyped && <div style={{ borderTop:"1px solid #2a2018", marginTop:4, paddingTop:3, color:dmgRed, fontWeight:700, fontSize:10 }}>Total: {total}</div>}
        </div>
      )}

      {/* Typed entries panel */}
      {open && (
        <div ref={panelRef} style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:300, background:"#1a1510", border:"1px solid #5c4a32", borderRadius:6, padding:"10px 12px", minWidth:248, boxShadow:"0 8px 32px rgba(0,0,0,0.7)", fontFamily:"'Spectral', serif" }}>
          <div style={{ fontSize:10, color:"#daa520", fontFamily:"'MedievalSharp', cursive", marginBottom:8, letterSpacing:1 }}>Typed Damage Breakdown</div>

          {/* Base (read-only info row) */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, padding:"3px 8px", background:"#0d0b09", borderRadius:3 }}>
            <span style={{ fontSize:11, color:"#5c4a32", flex:1 }}>Base (untyped)</span>
            <span style={{ fontSize:12, fontWeight:700, color: base > 0 ? "#8b7355" : "#3a3020" }}>{base || "—"}</span>
          </div>

          {/* Existing typed entries */}
          {typedEntries.length > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
              {typedEntries.map((e, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:5, background:"#0d0b09", borderRadius:3, padding:"3px 6px" }}>
                  <Stepper value={e.amount} min={1} onChange={(v) => updateTypedAmt(i, v)} />
                  <span style={{ color: DMG_TYPE_COLORS[e.type] || "#c4a97d", fontSize:11, flex:1, paddingLeft:2 }}>{e.type || "—"}</span>
                  <button onClick={() => removeTyped(i)} style={{ background:"transparent", border:"none", color:"#5c3030", cursor:"pointer", fontSize:13, fontWeight:700, padding:"0 2px", lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:11, color:"#3a3020", fontStyle:"italic", marginBottom:8 }}>No typed entries yet</div>
          )}

          {/* Add new typed entry */}
          <div style={{ display:"flex", gap:4, alignItems:"center", marginBottom:8 }}>
            <Stepper value={newAmt} min={1} onChange={setNewAmt} />
            <select value={newType} onChange={(e) => setNewType(e.target.value)}
              style={{ background:"#1a1510", color:"#c4a97d", border:"1px solid #3a3020", borderRadius:4, padding:"3px 4px", fontSize:10, fontFamily:"'Spectral', serif", flex:1 }}>
              {DMG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={addTyped} style={{ background:"#1a1208", border:"1px solid #5c4a32", borderRadius:3, color:"#daa520", cursor:"pointer", fontSize:10, padding:"3px 7px" }}>Add</button>
          </div>

          {/* Summary footer */}
          <div style={{ borderTop:"1px solid #2a2018", paddingTop:6, display:"flex", gap:8, fontSize:10, color:"#5c4a32" }}>
            <span>Base: <b style={{ color:"#8b7355" }}>{base}</b></span>
            <span style={{ color:"#2a2018" }}>·</span>
            <span>Typed: <b style={{ color:"#c4a97d" }}>{typedTotal}</b></span>
            <span style={{ color:"#2a2018" }}>·</span>
            <span>Total: <b style={{ color:dmgRed }}>{total}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Data Entry ─── */
function DataEntry({ battle, players, onChange, onRoundsChange, onDmgChange, onKillChange, playerDefaults }) {
  const d = battle.data;
  const dmgEntries = battle.dmgEntries || {};
  const dmgBase = battle.dmgBase || {};
  const namedKillsData = battle.namedKills || {};
  const setCellValue = (stat, player, round, val) => {
    const next = JSON.parse(JSON.stringify(d));
    next[player][stat][round] = Math.max(0, parseInt(val) || 0);
    onChange(next);
  };
  const roundNums = Array.from({ length: battle.rounds }, (_, i) => i + 1);

  return (
    <ParchmentPanel>
      {STAT_TYPES.map((stat) => (
        <div key={stat} style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, paddingBottom:6, borderBottom:`1px solid ${STAT_COLORS[stat]}33` }}>
            <span style={{ fontSize:15 }}>{STAT_ICONS[stat]}</span>
            <span style={{ fontSize:12, fontWeight:700, fontFamily:"'MedievalSharp', cursive", letterSpacing:1.5, color:STAT_COLORS[stat], textTransform:"uppercase" }}>{stat}</span>
          </div>
          <div style={{ overflowX:"auto", paddingBottom:4 }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Adventurer</th>
                  {roundNums.map((r) => <th key={r} style={{ ...thStyle, textAlign:"center", minWidth:64 }}>R{r}</th>)}
                  <th style={{ ...thStyle, textAlign:"center", color:STAT_COLORS[stat] }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const total = roundNums.reduce((acc, r) => acc + (d[p]?.[stat]?.[r] || 0), 0);
                  return (
                    <tr key={p} style={{ borderBottom:"1px solid #2a2018" }}>
                      <td style={tdNameStyle}>{p}</td>
                      {roundNums.map((r) => (
                        <td key={r} style={{ ...tdStyle, textAlign:"center" }}>
                          {stat === "DMG" ? (
                            <DmgCell base={dmgBase[p]?.[r] || 0} typedEntries={dmgEntries[p]?.[r] || []} defaultType={playerDefaults?.[p] || DMG_TYPES[0]} onUpdate={(b, t) => onDmgChange(p, r, b, t)} />
                          ) : stat === "KILL" ? (
                            <KillCell value={d[p]?.["KILL"]?.[r] || 0} namedKills={namedKillsData[p]?.[r] || []} onUpdate={(val, kills) => onKillChange(p, r, val, kills)} />
                          ) : (
                            <Stepper value={d[p]?.[stat]?.[r] || 0} onChange={(v) => setCellValue(stat, p, r, v)} />
                          )}
                        </td>
                      ))}
                      <td style={{ ...tdStyle, textAlign:"center" }}><StatBadge stat={stat} value={total} /></td>
                    </tr>
                  );
                })}
                <tr>
                  <td style={{ ...tdNameStyle, color:"#8b7355", fontStyle:"italic" }}>Party</td>
                  {roundNums.map((r) => {
                    const ct = players.reduce((a, p) => a + (d[p]?.[stat]?.[r] || 0), 0);
                    return <td key={r} style={{ ...tdStyle, textAlign:"center", color:"#8b7355" }}>{ct || "–"}</td>;
                  })}
                  <td style={{ ...tdStyle, textAlign:"center" }}>
                    <StatBadge stat={stat} value={players.reduce((a, p) => a + roundNums.reduce((a2, r) => a2 + (d[p]?.[stat]?.[r] || 0), 0), 0)} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div style={{ display:"flex", gap:8, marginTop:4, alignItems:"center" }}>
        <span style={{ fontSize:12, color:"#8b7355", fontFamily:"'Spectral', serif" }}>Rounds of Combat:</span>
        <button onClick={() => onRoundsChange(Math.max(1, battle.rounds - 1))} style={roundBtnStyle}>−</button>
        <span style={{ fontFamily:"'MedievalSharp', cursive", fontSize:16, fontWeight:700, color:"#daa520", minWidth:20, textAlign:"center" }}>{battle.rounds}</span>
        <button onClick={() => onRoundsChange(Math.min(MAX_ROUNDS, battle.rounds + 1))} style={roundBtnStyle}>+</button>
      </div>
    </ParchmentPanel>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ battles, players, filterPlayer, filterBattle, filterRound, setFilterPlayer, setFilterBattle, setFilterRound }) {
  const stats = useMemo(() => {
    const out = {};
    players.forEach((p) => { out[p] = {}; STAT_TYPES.forEach((s) => (out[p][s] = 0)); });
    const fb = filterBattle === "All" ? battles : battles.filter((b) => b.id === filterBattle);
    fb.forEach((b) => { players.forEach((p) => { if (!b.data[p]) return; STAT_TYPES.forEach((s) => { for (let r = 1; r <= b.rounds; r++) { if (filterRound !== "All" && r !== filterRound) continue; out[p][s] += b.data[p]?.[s]?.[r] || 0; } }); }); });
    return out;
  }, [battles, players, filterBattle, filterRound]);

  const fp = filterPlayer === "All" ? players : players.filter((p) => p === filterPlayer);
  const totals = {}; STAT_TYPES.forEach((s) => { totals[s] = fp.reduce((a, p) => a + stats[p][s], 0); });
  const totalDMG = totals.DMG, totalKILL = totals.KILL, totalREVIVE = totals.REVIVE;
  const totalNAT20 = totals["NAT 20"], totalNAT1 = totals["NAT 1"];
  const fb2 = filterBattle === "All" ? battles : battles.filter((b) => b.id === filterBattle);
  const totalRoundsCount = fb2.reduce((a, b) => filterRound !== "All" ? a + 1 : a + b.rounds, 0);

  const kpi = {
    killReviveRatio: totalREVIVE > 0 ? (totalKILL / totalREVIVE).toFixed(2) : totalKILL > 0 ? "∞" : "–",
    nat20to1Ratio: totalNAT1 > 0 ? (totalNAT20 / totalNAT1).toFixed(2) : totalNAT20 > 0 ? "∞" : "–",
    avgDmgPerRound: totalRoundsCount > 0 ? (totalDMG / totalRoundsCount).toFixed(1) : "–",
    dmgPerKill: totalKILL > 0 ? (totalDMG / totalKILL).toFixed(1) : "–",
  };

  const leaderOf = (stat) => { let best = null, bv = -1; players.forEach((p) => { if (stats[p][stat] > bv) { bv = stats[p][stat]; best = p; } }); return bv > 0 ? best : "–"; };

  const playerBarData = fp.map((p) => ({ name: p.length > 10 ? p.slice(0,9)+"…" : p, DMG:stats[p].DMG, KILL:stats[p].KILL, HEAL:stats[p].HEAL, REVIVE:stats[p].REVIVE, "NAT 20":stats[p]["NAT 20"], "NAT 1":stats[p]["NAT 1"] }));

  const roundLineData = useMemo(() => {
    const out = [];
    for (let r = 1; r <= MAX_ROUNDS; r++) { const row = { name:`R${r}` }; let has = false; fp.forEach((p) => { let v = 0; fb2.forEach((b) => { if (r <= b.rounds && b.data[p]) v += b.data[p].DMG?.[r] || 0; }); row[p] = v; if (v > 0) has = true; }); if (has) out.push(row); }
    return out;
  }, [fb2, fp]);

  const killPieData = players.filter((p) => stats[p].KILL > 0).map((p) => ({ name:p, value:stats[p].KILL, color:PLAYER_COLORS[players.indexOf(p) % PLAYER_COLORS.length] }));
  const healPieData = players.filter((p) => stats[p].HEAL > 0).map((p) => ({ name:p, value:stats[p].HEAL, color:PLAYER_COLORS[players.indexOf(p) % PLAYER_COLORS.length] }));

  const radarData = useMemo(() => {
    const maxes = {}; STAT_TYPES.forEach((s) => { maxes[s] = Math.max(1, ...players.map((p) => stats[p][s])); });
    return STAT_TYPES.map((s) => { const row = { stat: `${STAT_ICONS[s]} ${s}` }; fp.forEach((p) => { row[p] = Math.round((stats[p][s] / maxes[s]) * 100); }); return row; });
  }, [stats, fp, players]);

  const battleAreaData = useMemo(() => {
    return battles.map((b) => { const row = { name: b.name.length > 14 ? b.name.slice(0,13)+"…" : b.name }; STAT_TYPES.forEach((s) => { row[s] = 0; fp.forEach((p) => { if (!b.data[p]) return; for (let r = 1; r <= b.rounds; r++) { if (filterRound !== "All" && r !== filterRound) continue; row[s] += b.data[p]?.[s]?.[r] || 0; } }); }); return row; });
  }, [battles, fp, filterRound]);

  const roundBreakdown = useMemo(() => {
    const out = {}; for (let r = 1; r <= MAX_ROUNDS; r++) { out[r] = {}; STAT_TYPES.forEach((s) => (out[r][s] = 0)); }
    fb2.forEach((b) => { fp.forEach((p) => { if (!b.data[p]) return; STAT_TYPES.forEach((s) => { for (let r = 1; r <= b.rounds; r++) out[r][s] += b.data[p]?.[s]?.[r] || 0; }); }); });
    return out;
  }, [fb2, fp]);

  const battleBreakdown = useMemo(() => {
    return battles.map((b) => { const row = { name:b.name, id:b.id }; STAT_TYPES.forEach((s) => { row[s] = 0; fp.forEach((p) => { if (!b.data[p]) return; for (let r = 1; r <= b.rounds; r++) { if (filterRound !== "All" && r !== filterRound) continue; row[s] += b.data[p]?.[s]?.[r] || 0; } }); }); return row; });
  }, [battles, fp, filterRound]);

  const dmgTypeBreakdown = useMemo(() => {
    const out = {};
    const fb = filterBattle === "All" ? battles : battles.filter((b) => b.id === filterBattle);
    fb.forEach((b) => {
      fp.forEach((p) => {
        for (let r = 1; r <= b.rounds; r++) {
          if (filterRound !== "All" && r !== filterRound) continue;
          const base = b.dmgBase?.[p]?.[r] || 0;
          if (base > 0) out["Untyped"] = (out["Untyped"] || 0) + base;
          (b.dmgEntries?.[p]?.[r] || []).forEach((e) => {
            const key = e.type || "Untyped";
            out[key] = (out[key] || 0) + (e.amount || 0);
          });
        }
      });
    });
    const order = [...DMG_TYPES, "Untyped"];
    const colors = { ...DMG_TYPE_COLORS, Untyped:"#5c5550" };
    return order.filter((t) => out[t] > 0).map((t) => ({ name: t, value: out[t], color: colors[t] || "#8b7355" }));
  }, [battles, fp, filterBattle, filterRound]);

  const trophyWall = useMemo(() => {
    const kills = [];
    const fb = filterBattle === "All" ? battles : battles.filter((b) => b.id === filterBattle);
    fb.forEach((b) => {
      fp.forEach((p) => {
        for (let r = 1; r <= b.rounds; r++) {
          if (filterRound !== "All" && r !== filterRound) continue;
          (b.namedKills?.[p]?.[r] || []).forEach((k) => {
            kills.push({ name: k.name, player: p, encounter: b.name, round: r, battleOrder: battles.indexOf(b) });
          });
        }
      });
    });
    kills.sort((a, b) => a.battleOrder - b.battleOrder || a.round - b.round);
    return kills;
  }, [battles, fp, filterBattle, filterRound]);

  // Stacked horizontal bar: DMG per round by player (Image 2)
  const stackedDmgData = useMemo(() => {
    if (fb2.length === 0) return [];
    const maxRound = Math.max(...fb2.map((b) => b.rounds));
    const rows = [];
    for (let r = 1; r <= maxRound; r++) {
      if (filterRound !== "All" && r !== filterRound) continue;
      const row = { name: `Round ${r}` };
      fp.forEach((p) => { row[p] = fb2.reduce((a, b) => r <= b.rounds ? a + (b.data[p]?.DMG?.[r] || 0) : a, 0); });
      rows.push(row);
    }
    while (rows.length > 0 && fp.every((p) => !rows[rows.length - 1][p])) rows.pop();
    return rows;
  }, [fb2, fp, filterRound]);

  // Per-battle DMG line: total party DMG per round for each encounter (Image 3)
  const perBattleDmgData = useMemo(() => {
    if (fb2.length <= 1) return [];
    const maxRound = Math.max(...fb2.map((b) => b.rounds));
    return Array.from({ length: maxRound }, (_, i) => i + 1).map((r) => {
      const row = { name: `Round ${r}` };
      fb2.forEach((b) => { if (r <= b.rounds) row[b.name] = fp.reduce((a, p) => a + (b.data[p]?.DMG?.[r] || 0), 0); });
      return row;
    });
  }, [fb2, fp]);

  const roundNums = Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).filter(
    (r) => filterRound !== "All" ? r === filterRound : Object.values(roundBreakdown[r]).some((v) => v > 0)
  );

  const hasAnyData = totalDMG > 0 || totalKILL > 0 || totals.HEAL > 0;

  return (
    <div>
      {/* Filters */}
      <ParchmentPanel style={{ marginBottom:16, padding:12 }}>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"#daa520", fontFamily:"'MedievalSharp', cursive" }}>Scrying Filters</span>
          <FilterSelect label="Hero" value={filterPlayer} onChange={setFilterPlayer}
            options={[{ value:"All", label:"All" }, ...players.map((p) => ({ value:p, label:p }))]} />
          <FilterSelect label="Encounter" value={filterBattle} onChange={setFilterBattle}
            options={[{ value:"All", label:"All" }, ...battles.map((b) => ({ value:b.id, label:b.name }))]} />
          <FilterSelect label="Round" value={filterRound} onChange={(v) => setFilterRound(v === "All" ? "All" : parseInt(v))}
            options={[{ value:"All", label:"All" }, ...Array.from({ length:MAX_ROUNDS }, (_, i) => ({ value:i + 1, label:`Round ${i + 1}` }))]} />
        </div>
      </ParchmentPanel>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:10, marginBottom:16 }}>
        <KpiCard label="Kill / Revive Ratio" value={kpi.killReviveRatio} color="#d4442a" sub={`${totalKILL} kills · ${totalREVIVE} revives`} icon="💀" />
        <KpiCard label="NAT 20 / NAT 1" value={kpi.nat20to1Ratio} color="#daa520" sub={`${totalNAT20} crits · ${totalNAT1} fumbles`} icon="★" />
        <KpiCard label="Avg DMG / Round" value={kpi.avgDmgPerRound} color="#d4442a" sub={`${totalDMG} total damage`} icon="⚔" />
        <KpiCard label="DMG per Kill" value={kpi.dmgPerKill} color="#8b1a1a" icon="🗡" />
      </div>

      {/* Leaderboard */}
      <SectionTitle icon="🏆">Champions of the Field</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10, marginBottom:16 }}>
        {STAT_TYPES.map((s) => (
          <div key={s} style={{ background:"linear-gradient(160deg, #1e1810, #16120e)", borderRadius:6, padding:"10px 14px", border:"1px solid #3a3020", textAlign:"center" }}>
            <div style={{ fontSize:18, marginBottom:2 }}>{STAT_ICONS[s]}</div>
            <div style={{ fontSize:9, color:"#5c4a32", textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontFamily:"'Spectral', serif" }}>{s}</div>
            <div style={{ fontSize:14, fontWeight:700, color:STAT_COLORS[s], fontFamily:"'MedievalSharp', cursive" }}>{leaderOf(s)}</div>
          </div>
        ))}
      </div>

      {/* CHARTS */}
      {hasAnyData && (
        <>
          {/* ── 3 grouped bar charts: stat pairs by adventurer ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14, marginBottom:14 }}>
            {[["DMG","HEAL","⚔"],["KILL","REVIVE","💀"],["NAT 20","NAT 1","★"]].map(([a, b, icon]) => {
              const data = fp.map((p) => ({ name: p.length > 9 ? p.slice(0,8)+"…" : p, [a]: stats[p][a], [b]: stats[p][b] }));
              return (
                <ChartCard key={a} title={`${a} & ${b}`} height={210} icon={icon}>
                  <ResponsiveContainer>
                    <BarChart data={data} barGap={3} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2018" />
                      <XAxis dataKey="name" tick={{ fill:"#8b7355", fontSize:9 }} axisLine={{ stroke:"#3a3020" }} />
                      <YAxis tick={{ fill:"#5c4a32", fontSize:9 }} axisLine={{ stroke:"#3a3020" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey={a} fill={STAT_COLORS[a]} radius={[3,3,0,0]}>
                        <LabelList dataKey={a} position="top" fill="#c4a97d" fontSize={9} formatter={(v) => v > 0 ? v : "·"} />
                      </Bar>
                      <Bar dataKey={b} fill={STAT_COLORS[b]} radius={[3,3,0,0]}>
                        <LabelList dataKey={b} position="top" fill="#c4a97d" fontSize={9} formatter={(v) => v > 0 ? v : "·"} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              );
            })}
          </div>

          {/* ── Per-round party totals: 3×2 grid (line for DMG/HEAL, bars for rest) ── */}
          {roundNums.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14, marginBottom:14 }}>
              {[["DMG","line"],["KILL","bar"],["NAT 20","bar"],["HEAL","line"],["REVIVE","bar"],["NAT 1","bar"]].map(([stat, type]) => {
                const color = STAT_COLORS[stat];
                const data = roundNums.map((r) => ({ name: `Round ${r}`, value: roundBreakdown[r][stat] }));
                return (
                  <ChartCard key={stat} title={stat} height={190} icon={STAT_ICONS[stat]}>
                    <ResponsiveContainer>
                      {type === "line" ? (
                        <LineChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2018" />
                          <XAxis dataKey="name" tick={{ fill:"#8b7355", fontSize:8 }} axisLine={{ stroke:"#3a3020" }} />
                          <YAxis tick={{ fill:"#5c4a32", fontSize:8 }} axisLine={{ stroke:"#3a3020" }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Line type="monotone" dataKey="value" name={stat} stroke={color} strokeWidth={2.5}
                            dot={{ r:4, fill:color, stroke:"#0d0b09", strokeWidth:1 }}>
                            <LabelList dataKey="value" position="top" fill={color} fontSize={9} formatter={(v) => v > 0 ? v : "·"} />
                          </Line>
                        </LineChart>
                      ) : (
                        <BarChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2018" />
                          <XAxis dataKey="name" tick={{ fill:"#8b7355", fontSize:8 }} axisLine={{ stroke:"#3a3020" }} />
                          <YAxis tick={{ fill:"#5c4a32", fontSize:8 }} axisLine={{ stroke:"#3a3020" }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="value" name={stat} fill={color} radius={[3,3,0,0]}>
                            <LabelList dataKey="value" position="top" fill={color} fontSize={9} formatter={(v) => v > 0 ? v : "·"} />
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </ChartCard>
                );
              })}
            </div>
          )}

          {/* ── Stacked horizontal bar: DMG per round broken down by player ── */}
          {stackedDmgData.length > 0 && fp.length > 1 && (
            <ChartCard title="Damage by Player per Round" height={Math.max(220, stackedDmgData.length * 34 + 80)} icon="⚔">
              <ResponsiveContainer>
                <BarChart layout="vertical" data={stackedDmgData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2018" />
                  <XAxis type="number" tick={{ fill:"#5c4a32", fontSize:9 }} axisLine={{ stroke:"#3a3020" }} />
                  <YAxis type="category" dataKey="name" tick={{ fill:"#8b7355", fontSize:9 }} axisLine={{ stroke:"#3a3020" }} width={58} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:"#8b7355", fontFamily:"'Spectral', serif" }} />
                  {fp.map((p) => (
                    <Bar key={p} dataKey={p} stackId="dmg" fill={PLAYER_COLORS[players.indexOf(p) % PLAYER_COLORS.length]}>
                      <LabelList dataKey={p} position="inside" fill="#fff" fontSize={8} formatter={(v) => v > 0 ? v : ""} />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* ── Multi-line: party DMG per round compared across encounters ── */}
          {perBattleDmgData.length > 0 && fb2.length > 1 && (
            <ChartCard title="Damage per Round by Encounter" height={220} icon="📜">
              <ResponsiveContainer>
                <LineChart data={perBattleDmgData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2018" />
                  <XAxis dataKey="name" tick={{ fill:"#8b7355", fontSize:9 }} axisLine={{ stroke:"#3a3020" }} />
                  <YAxis tick={{ fill:"#5c4a32", fontSize:9 }} axisLine={{ stroke:"#3a3020" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:"#8b7355", fontFamily:"'Spectral', serif" }} />
                  {fb2.map((b, i) => (
                    <Line key={b.id} type="monotone" dataKey={b.name}
                      stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]} strokeWidth={2.5}
                      dot={{ r:4, fill:PLAYER_COLORS[i % PLAYER_COLORS.length], stroke:"#0d0b09", strokeWidth:1 }}>
                      <LabelList dataKey={b.name} position="top" fill={PLAYER_COLORS[i % PLAYER_COLORS.length]} fontSize={9}
                        formatter={(v) => v != null && v > 0 ? v : ""} />
                    </Line>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          <div style={{ display:"grid", gridTemplateColumns: fp.length > 1 ? "1fr 1fr" : "1fr", gap:14, marginBottom:14 }}>
            {fp.length > 1 && (
              <ChartCard title="Hero Radar" height={270} icon="🛡">
                <ResponsiveContainer>
                  <RadarChart data={radarData} outerRadius="68%">
                    <PolarGrid stroke="#3a3020" />
                    <PolarAngleAxis dataKey="stat" tick={{ fill:"#8b7355", fontSize:9, fontFamily:"'Spectral', serif" }} />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    {fp.map((p) => (
                      <Radar key={p} name={p} dataKey={p}
                        stroke={PLAYER_COLORS[players.indexOf(p) % PLAYER_COLORS.length]}
                        fill={PLAYER_COLORS[players.indexOf(p) % PLAYER_COLORS.length]}
                        fillOpacity={0.12} strokeWidth={2} />
                    ))}
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {killPieData.length > 0 && (() => {
                const solo = fp.length > 1 && healPieData.length === 0;
                const h = fp.length > 1 ? (solo ? 270 : 123) : 190;
                const or = fp.length > 1 ? (solo ? 88 : 42) : 65;
                const ir = fp.length > 1 ? (solo ? 44 : 20) : 32;
                return (
                  <ChartCard title="Kill Tally" height={h} icon="💀">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={killPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={or} innerRadius={ir} strokeWidth={0}>
                          {killPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:"#8b7355", fontFamily:"'Spectral', serif" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                );
              })()}
              {healPieData.length > 0 && (() => {
                const solo = fp.length > 1 && killPieData.length === 0;
                const h = fp.length > 1 ? (solo ? 270 : 123) : 190;
                const or = fp.length > 1 ? (solo ? 88 : 42) : 65;
                const ir = fp.length > 1 ? (solo ? 44 : 20) : 32;
                return (
                  <ChartCard title="Healing Shared" height={h} icon="❤">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={healPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={or} innerRadius={ir} strokeWidth={0}>
                          {healPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:"#8b7355", fontFamily:"'Spectral', serif" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                );
              })()}
            </div>
          </div>

          {/* ── Damage by type horizontal bar ── */}
          {dmgTypeBreakdown.length > 0 && (
            <ChartCard title="Damage by Type" height={Math.max(200, dmgTypeBreakdown.length * 30 + 80)} icon="🔥">
              <ResponsiveContainer>
                <BarChart layout="vertical" data={dmgTypeBreakdown} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2018" />
                  <XAxis type="number" tick={{ fill:"#5c4a32", fontSize:9 }} axisLine={{ stroke:"#3a3020" }} />
                  <YAxis type="category" dataKey="name" tick={{ fill:"#8b7355", fontSize:9 }} axisLine={{ stroke:"#3a3020" }} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Damage" radius={[0,3,3,0]}>
                    {dmgTypeBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                    <LabelList dataKey="value" position="right" fill="#c4a97d" fontSize={9} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {battles.length > 1 && (
            <ChartCard title="Campaign Arc — Stats Across Encounters" height={220} icon="📜">
              <ResponsiveContainer>
                <AreaChart data={battleAreaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2018" />
                  <XAxis dataKey="name" tick={{ fill:"#8b7355", fontSize:10 }} axisLine={{ stroke:"#3a3020" }} />
                  <YAxis tick={{ fill:"#5c4a32", fontSize:10 }} axisLine={{ stroke:"#3a3020" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="DMG" stroke={STAT_COLORS.DMG} fill={STAT_COLORS.DMG} fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="HEAL" stroke={STAT_COLORS.HEAL} fill={STAT_COLORS.HEAL} fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="KILL" stroke={STAT_COLORS.KILL} fill={STAT_COLORS.KILL} fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}

      {/* TABLES */}
      <Divider />
      <SectionTitle icon="👥">By Adventurer</SectionTitle>
      <ParchmentPanel style={{ marginBottom:16 }}>
        <div style={{ overflowX:"auto" }}>
          <table style={summaryTableStyle}>
            <thead><tr><th style={{ ...thStyle, width:"220px" }}>Hero</th>{STAT_TYPES.map((s) => <th key={s} style={{ ...thStyle, textAlign:"center", color:STAT_COLORS[s] }}>{STAT_ICONS[s]} {s}</th>)}</tr></thead>
            <tbody>
              {fp.map((p) => (<tr key={p}><td style={{ ...tdNameStyle, overflow:"hidden", textOverflow:"ellipsis" }}>{p}</td>{STAT_TYPES.map((s) => <td key={s} style={{ ...tdStyle, textAlign:"center" }}><StatBadge stat={s} value={stats[p][s]} small /></td>)}</tr>))}
              {fp.length > 1 && (<tr><td style={{ ...tdNameStyle, color:"#8b7355", fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis" }}>Party</td>{STAT_TYPES.map((s) => <td key={s} style={{ ...tdStyle, textAlign:"center" }}><StatBadge stat={s} value={totals[s]} small /></td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </ParchmentPanel>

      {roundNums.length > 0 && (
        <>
          <SectionTitle icon="⏱">By Round of Combat</SectionTitle>
          <ParchmentPanel style={{ marginBottom:16 }}>
            <div style={{ overflowX:"auto" }}>
              <table style={summaryTableStyle}>
                <thead><tr><th style={{ ...thStyle, width:"220px" }}>Round</th>{STAT_TYPES.map((s) => <th key={s} style={{ ...thStyle, textAlign:"center", color:STAT_COLORS[s] }}>{STAT_ICONS[s]}</th>)}</tr></thead>
                <tbody>
                  {roundNums.map((r) => (<tr key={r}><td style={tdNameStyle}>Round {r}</td>{STAT_TYPES.map((s) => <td key={s} style={{ ...tdStyle, textAlign:"center" }}><StatBadge stat={s} value={roundBreakdown[r][s]} small /></td>)}</tr>))}
                </tbody>
              </table>
            </div>
          </ParchmentPanel>
        </>
      )}

      {battles.length > 0 && (
        <>
          <SectionTitle icon="⚔">By Encounter</SectionTitle>
          <ParchmentPanel>
            <div style={{ overflowX:"auto" }}>
              <table style={summaryTableStyle}>
                <thead><tr><th style={{ ...thStyle, width:"220px" }}>Encounter</th>{STAT_TYPES.map((s) => <th key={s} style={{ ...thStyle, textAlign:"center", color:STAT_COLORS[s] }}>{STAT_ICONS[s]}</th>)}</tr></thead>
                <tbody>
                  {battleBreakdown.map((row) => (<tr key={row.id}><td style={{ ...tdNameStyle, overflow:"hidden", textOverflow:"ellipsis" }}>{row.name}</td>{STAT_TYPES.map((s) => <td key={s} style={{ ...tdStyle, textAlign:"center" }}><StatBadge stat={s} value={row[s]} small /></td>)}</tr>))}
                </tbody>
              </table>
            </div>
          </ParchmentPanel>
        </>
      )}

    </div>
  );
}

/* ─── Trophy Room ─── */
// Deterministic pseudo-random seeded from a string key + numeric offset.
function seededRand(key, offset) {
  let h = offset >>> 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}

// 6 distinct frame materials. Each controls all visual aspects of the frame + plaque.
const FRAME_VARIANTS = [
  {
    id: "gold",
    frameBg: "linear-gradient(135deg, #c8960a 0%, #e8b830 18%, #c09010 36%, #f0c840 54%, #b88010 72%, #d4a020 100%)",
    framePad: 11, outerBorder: "2px solid #7a5c10",
    innerLine: "1px solid rgba(255,215,0,0.28)", innerInset: 5,
    shadow: "0 0 0 1px #a07010, 0 0 0 3px rgba(218,165,32,0.22), 0 8px 24px rgba(218,165,32,0.42), 0 18px 50px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,215,0,0.38), inset 0 -1px 0 rgba(100,70,0,0.55)",
    glow: "rgba(218,165,32,0.38)", cornerBg:"#ffd700", cornerBorder:"#906000", cornerShape:"50%", cornerSize:9,
    imageBg: "radial-gradient(ellipse at 35% 25%, #1e180a, #0d0b05)",
    plaqueBg: "linear-gradient(180deg, #2a1e05, #1a1208)", plaqueBorder:"#c9a84c",
    plaqueText:"#e8c050", chainColor:"#c9a84c", nameColor:"#ffd700", nameShadow:"0 0 9px rgba(218,165,32,0.55)",
  },
  {
    id: "wood",
    frameBg: "repeating-linear-gradient(87deg, #4a2e10 0px, #6b4820 2px, #3a2208 5px, #5a3818 8px, #4a2e10 11px)",
    framePad: 13, outerBorder: "2px solid #2a1808",
    innerLine: "1px solid rgba(139,96,48,0.45)", innerInset: 6,
    shadow: "0 0 0 1px #2a1808, 0 0 0 3px rgba(122,80,48,0.38), 0 8px 20px rgba(60,30,0,0.55), 0 18px 42px rgba(0,0,0,0.82), inset 0 1px 0 rgba(180,130,70,0.22), inset 0 -2px 4px rgba(0,0,0,0.6)",
    glow: "rgba(92,61,30,0.45)", cornerBg:"#8b6030", cornerBorder:"#3a2010", cornerShape:"2px", cornerSize:8,
    imageBg: "radial-gradient(ellipse at 35% 25%, #1e1408, #0d0a05)",
    plaqueBg: "repeating-linear-gradient(87deg, #2a1808 0px, #3a2210 2px, #1a1005 5px, #2a1808 8px)", plaqueBorder:"#8b6030",
    plaqueText:"#c49030", chainColor:"#7a5020", nameColor:"#d4a050", nameShadow:"0 0 6px rgba(140,90,0,0.42)",
  },
  {
    id: "silver",
    frameBg: "linear-gradient(135deg, #5a6060 0%, #9aa8a8 18%, #687070 36%, #b0baba 54%, #606868 72%, #8a9898 100%)",
    framePad: 11, outerBorder: "2px solid #404848",
    innerLine: "1px solid rgba(180,200,200,0.22)", innerInset: 5,
    shadow: "0 0 0 1px #404848, 0 0 0 2px rgba(150,170,170,0.22), 0 8px 20px rgba(60,80,80,0.4), 0 18px 42px rgba(0,0,0,0.78), inset 0 1px 0 rgba(200,220,220,0.28), inset 0 -1px 0 rgba(30,40,40,0.58)",
    glow: "rgba(140,160,160,0.3)", cornerBg:"#b0c0c0", cornerBorder:"#4a5858", cornerShape:"50%", cornerSize:9,
    imageBg: "radial-gradient(ellipse at 35% 25%, #141a1a, #090d0d)",
    plaqueBg: "linear-gradient(180deg, #161e1e, #0d1414)", plaqueBorder:"#6a8080",
    plaqueText:"#90a8a8", chainColor:"#7a9090", nameColor:"#b8d0d0", nameShadow:"0 0 6px rgba(140,180,180,0.4)",
  },
  {
    id: "bronze",
    frameBg: "linear-gradient(135deg, #6a3a18 0%, #8b5228 18%, #3a5030 36%, #7a4820 54%, #4a5832 72%, #6a3c1a 100%)",
    framePad: 12, outerBorder: "2px solid #252015",
    innerLine: "1px solid rgba(140,100,48,0.38)", innerInset: 5,
    shadow: "0 0 0 1px #252015, 0 0 0 2px rgba(106,60,24,0.38), 0 8px 20px rgba(70,50,15,0.5), 0 18px 42px rgba(0,0,0,0.82), inset 0 1px 0 rgba(160,120,60,0.22), inset 0 -1px 0 rgba(20,15,5,0.68)",
    glow: "rgba(100,70,25,0.45)", cornerBg:"#8b7040", cornerBorder:"#3a2810", cornerShape:"2px", cornerSize:8,
    imageBg: "radial-gradient(ellipse at 35% 25%, #181408, #0d0a04)",
    plaqueBg: "linear-gradient(180deg, #181608, #0d0c05)", plaqueBorder:"#7a6030",
    plaqueText:"#a08040", chainColor:"#7a5030", nameColor:"#c09848", nameShadow:"0 0 6px rgba(150,110,35,0.45)",
  },
  {
    id: "gilded",
    frameBg: "linear-gradient(135deg, #a06808 0%, #dca018 12%, #b07810 24%, #f8d040 36%, #c09010 48%, #e8b020 60%, #b07808 72%, #d8a818 84%, #a06808 100%)",
    framePad: 14, outerBorder: "2px solid #705008",
    innerLine: "1px solid rgba(255,215,0,0.38)", innerInset: 7,
    shadow: "0 0 0 1px #705008, 0 0 0 3px rgba(218,165,32,0.32), 0 0 0 5px rgba(120,85,0,0.14), 0 10px 28px rgba(218,165,32,0.55), 0 20px 55px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,230,80,0.48), inset 0 -1px 0 rgba(90,60,0,0.58)",
    glow: "rgba(218,165,32,0.52)", cornerBg:"#ffe066", cornerBorder:"#806000", cornerShape:"50%", cornerSize:11,
    imageBg: "radial-gradient(ellipse at 35% 25%, #201a08, #0d0b04)",
    plaqueBg: "linear-gradient(180deg, #302005, #1e1508)", plaqueBorder:"#daa520",
    plaqueText:"#ffd700", chainColor:"#daa520", nameColor:"#fff5a0", nameShadow:"0 0 11px rgba(255,215,0,0.65)",
  },
  {
    id: "obsidian",
    frameBg: "linear-gradient(135deg, #18101e 0%, #2a1535 18%, #120d18 36%, #2c1838 54%, #160e20 72%, #1e1228 100%)",
    framePad: 11, outerBorder: "2px solid #080610",
    innerLine: "1px solid rgba(130,80,180,0.32)", innerInset: 5,
    shadow: "0 0 0 1px #080610, 0 0 0 2px rgba(120,60,160,0.28), 0 8px 24px rgba(80,40,110,0.45), 0 18px 46px rgba(0,0,0,0.88), inset 0 1px 0 rgba(160,100,220,0.18), inset 0 -1px 0 rgba(10,5,15,0.68)",
    glow: "rgba(120,60,160,0.42)", cornerBg:"#9060c8", cornerBorder:"#381858", cornerShape:"50%", cornerSize:9,
    imageBg: "radial-gradient(ellipse at 35% 25%, #120a16, #07050a)",
    plaqueBg: "linear-gradient(180deg, #180a22, #0e0818)", plaqueBorder:"#6a40a8",
    plaqueText:"#9060c0", chainColor:"#582e88", nameColor:"#c090e8", nameShadow:"0 0 9px rgba(160,80,220,0.58)",
  },
];

function TrophyRoom({ battles, players, trophyImages, setTrophyImages, trophyMeta, setTrophyMeta }) {
  const [editingKey, setEditingKey] = useState(null);
  const [urlInput, setUrlInput] = useState("");

  const trophies = useMemo(() => {
    const kills = [];
    battles.forEach((b) => {
      players.forEach((p) => {
        for (let r = 1; r <= b.rounds; r++) {
          (b.namedKills?.[p]?.[r] || []).forEach((k) => {
            kills.push({ key:`${p}::${b.name}::${r}::${k.name}`, name:k.name, player:p, encounter:b.name, round:r, battleOrder:battles.indexOf(b) });
          });
        }
      });
    });
    kills.sort((a, bx) => a.battleOrder - bx.battleOrder || a.round - bx.round);
    return kills;
  }, [battles, players]);

  if (trophies.length === 0) {
    return (
      <ParchmentPanel style={{ textAlign:"center", padding:40 }}>
        <D20Icon size={48} color="#3a3020" />
        <p style={{ color:"#5c4a32", fontSize:14, marginTop:12, fontFamily:"'Spectral', serif", fontStyle:"italic" }}>
          No named kills yet.<br />The Trophy Room awaits your first conquest.
        </p>
      </ParchmentPanel>
    );
  }

  const commitUrl = (key) => { setTrophyImages((prev) => ({ ...prev, [key]: urlInput.trim() })); setEditingKey(null); };
  const updateMeta = (key, field, val) => setTrophyMeta((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

  return (
    <div>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <span style={{ fontSize:11, fontWeight:700, fontFamily:"'MedievalSharp', cursive", letterSpacing:2, color:"#8b7355", textTransform:"uppercase" }}>☠ Trophies of the Fallen ☠</span>
        <div style={{ margin:"8px auto 0", width:240, height:1, background:"linear-gradient(90deg, transparent, #5c4a32, transparent)" }} />
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:36, padding:"10px 4px 48px", justifyContent:"center", alignItems:"flex-end" }}>
        {trophies.map((t) => {
          const r1 = seededRand(t.key, 1); // size
          const r2 = seededRand(t.key, 2); // rotation
          const r3 = seededRand(t.key, 3); // frame material
          const r7 = seededRand(t.key, 7); // placeholder

          // Portrait proportions ~2:3
          const sizeTier = r1 < 0.35 ? "sm" : r1 < 0.72 ? "md" : "lg";
          const dims = { sm:{imgW:136,imgH:194}, md:{imgW:170,imgH:242}, lg:{imgW:208,imgH:298} }[sizeTier];
          const nameSize = { sm:10, md:12, lg:14 }[sizeTier];

          const rotate = ((r2 * 10) - 5).toFixed(2);
          const fv = FRAME_VARIANTS[Math.floor(r3 * FRAME_VARIANTS.length)];
          const placeholder = TROPHY_PLACEHOLDERS[Math.floor(r7 * TROPHY_PLACEHOLDERS.length)];
          const playerColor = PLAYER_COLORS[players.indexOf(t.player) % PLAYER_COLORS.length];
          const imgUrl = trophyImages?.[t.key] || "";
          const isEditing = editingKey === t.key;
          const meta = trophyMeta?.[t.key] || {};
          const plaqueW = dims.imgW + 2 * fv.framePad - 12;

          return (
            <div key={t.key} style={{ transform:`rotate(${rotate}deg)`, transformOrigin:"center bottom", flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center" }}>

              {/* ── Ornate portrait frame ── */}
              <div style={{ background:fv.frameBg, padding:fv.framePad, border:fv.outerBorder, borderRadius:4, boxShadow:fv.shadow, position:"relative" }}>
                {/* Inner filigree border */}
                <div style={{ position:"absolute", inset:fv.innerInset, border:fv.innerLine, borderRadius:2, pointerEvents:"none", zIndex:3 }} />
                {/* Corner ornaments on the frame material */}
                {[{top:3,left:3},{top:3,right:3},{bottom:3,left:3},{bottom:3,right:3}].map((pos, ci) => (
                  <div key={ci} style={{ position:"absolute", ...pos, width:fv.cornerSize, height:fv.cornerSize, background:`radial-gradient(circle, ${fv.cornerBg}, ${fv.cornerBg}77)`, border:`1px solid ${fv.cornerBorder}`, borderRadius:fv.cornerShape, zIndex:4, pointerEvents:"none", boxShadow:`0 0 5px ${fv.cornerBg}66` }} />
                ))}

                {/* Portrait canvas */}
                <div style={{ width:dims.imgW, height:dims.imgH, position:"relative", overflow:"hidden", background:fv.imageBg }}>
                  {imgUrl ? (
                    <img src={imgUrl} alt={t.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} onError={(e) => { e.target.style.display="none"; }} />
                  ) : (
                    <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:18 }}>
                      <p style={{ color:fv.plaqueText, fontSize:11, fontFamily:"'Spectral', serif", fontStyle:"italic", textAlign:"center", lineHeight:1.75, margin:0, textShadow:`0 0 10px ${fv.glow}`, opacity:0.92 }}>{placeholder}</p>
                    </div>
                  )}
                  {/* Add / change portrait art */}
                  <button onClick={() => { setEditingKey(isEditing ? null : t.key); setUrlInput(imgUrl); }}
                    style={{ position:"absolute", bottom:6, right:6, background:"rgba(8,6,3,0.92)", border:`1px solid ${fv.plaqueBorder}88`, borderRadius:3, color:fv.plaqueText, padding:"3px 8px", fontSize:8, cursor:"pointer", fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5, zIndex:5, opacity:0.82, transition:"opacity .15s" }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity="1"} onMouseLeave={(e) => e.currentTarget.style.opacity="0.82"}>
                    {imgUrl ? "✦ art" : "+ art"}
                  </button>
                </div>

                {/* URL input panel */}
                {isEditing && (
                  <div style={{ padding:"8px", background:"#0a0805", borderTop:`1px solid ${fv.plaqueBorder}55` }}>
                    <input autoFocus value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitUrl(t.key); if (e.key === "Escape") setEditingKey(null); }}
                      placeholder="Paste image URL…"
                      style={{ width:"100%", background:"#0d0b09", border:`1px solid ${fv.plaqueBorder}88`, borderRadius:3, color:"#c4a97d", padding:"4px 6px", fontSize:9, fontFamily:"'Spectral', serif", boxSizing:"border-box" }} />
                    <div style={{ display:"flex", gap:4, marginTop:5 }}>
                      <button onClick={() => commitUrl(t.key)} style={{ flex:1, background:"#1a1510", border:`1px solid ${fv.plaqueBorder}`, borderRadius:3, color:fv.plaqueText, padding:"3px 0", fontSize:9, cursor:"pointer", fontFamily:"'MedievalSharp', cursive" }}>✓ Hang it</button>
                      <button onClick={() => setEditingKey(null)} style={{ background:"#1a1510", border:"1px solid #3a3020", borderRadius:3, color:"#5c4a32", padding:"3px 8px", fontSize:9, cursor:"pointer", fontFamily:"'MedievalSharp', cursive" }}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Chain / hook connector ── */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ width:14, height:6, border:`1.5px solid ${fv.chainColor}`, borderBottom:"none", borderRadius:"5px 5px 0 0", opacity:0.72 }} />
                <div style={{ width:2, height:8, background:fv.chainColor, opacity:0.5, borderRadius:1 }} />
                <div style={{ width:8, height:4, border:`1.5px solid ${fv.chainColor}`, borderRadius:3, opacity:0.6 }} />
                <div style={{ width:2, height:5, background:fv.chainColor, opacity:0.45, borderRadius:1 }} />
              </div>

              {/* ── Material-matched plaque ── */}
              <div style={{ width:plaqueW, background:fv.plaqueBg, border:`1px solid ${fv.plaqueBorder}`, borderRadius:4, padding:"9px 12px 11px", textAlign:"center", boxShadow:`0 5px 18px rgba(0,0,0,0.68), inset 0 1px 0 ${fv.plaqueBorder}22, inset 0 -1px 0 rgba(0,0,0,0.42)` }}>
                <div style={{ fontSize:nameSize, fontWeight:700, color:fv.nameColor, fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5, marginBottom:5, wordBreak:"break-word", textShadow:fv.nameShadow }}>{t.name}</div>
                <div style={{ fontSize:9, color:fv.plaqueText, fontFamily:"'Spectral', serif", lineHeight:1.7, opacity:0.88 }}>
                  Slain by{" "}<span style={{ color:playerColor, fontWeight:700, opacity:1 }}>{t.player}</span><br />
                  <span style={{ fontStyle:"italic", opacity:0.8 }}>{t.encounter}</span>
                  <span style={{ opacity:0.45 }}> · </span>Round {t.round}
                </div>
                {/* CR & HP editable fields */}
                <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:7, marginTop:7, paddingTop:6, borderTop:`1px solid ${fv.plaqueBorder}33` }}>
                  <span style={{ fontSize:7, color:fv.plaqueText, fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5, opacity:0.75 }}>CR</span>
                  <input value={meta.cr || ""} onChange={(e) => updateMeta(t.key, "cr", e.target.value)} placeholder="—" title="Challenge Rating"
                    style={{ width:30, background:"transparent", border:"none", borderBottom:`1px solid ${fv.plaqueBorder}55`, color:fv.plaqueText, textAlign:"center", fontSize:10, fontFamily:"'Spectral', serif", padding:"0 2px", outline:"none", cursor:"text" }} />
                  <span style={{ color:fv.plaqueBorder, fontSize:9, opacity:0.45 }}>·</span>
                  <input value={meta.hp || ""} onChange={(e) => updateMeta(t.key, "hp", e.target.value)} placeholder="—" title="Hit Points"
                    style={{ width:40, background:"transparent", border:"none", borderBottom:`1px solid ${fv.plaqueBorder}55`, color:fv.plaqueText, textAlign:"center", fontSize:10, fontFamily:"'Spectral', serif", padding:"0 2px", outline:"none", cursor:"text" }} />
                  <span style={{ fontSize:7, color:fv.plaqueText, fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5, opacity:0.75 }}>HP</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Settings ─── */
function Settings({ players, setPlayers, onReset, onExport, onImport, playerDefaults, setPlayerDefaults }) {
  const [newName, setNewName] = useState("");
  const fileRef = useRef(null);
  const addPlayer = () => { const n = newName.trim(); if (n && !players.includes(n)) { setPlayers([...players, n]); setNewName(""); } };
  const removePlayer = (p) => { if (players.length > 1) setPlayers(players.filter((x) => x !== p)); };
  return (
    <ParchmentPanel>
      <SectionTitle icon="👥">Party Members</SectionTitle>
      <div style={{ fontSize:10, color:"#5c4a32", marginBottom:8, fontFamily:"'Spectral', serif", fontStyle:"italic" }}>Select each adventurer's default damage type for new entries.</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
        {players.map((p, i) => (
          <div key={p} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#1a1510", borderRadius:4, padding:"8px 12px", border:"1px solid #2a2018" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:12, height:12, borderRadius:2, background:PLAYER_COLORS[i % PLAYER_COLORS.length], boxShadow:`0 0 6px ${PLAYER_COLORS[i % PLAYER_COLORS.length]}44` }} />
              <span style={{ fontSize:14, color:"#c4a97d", fontFamily:"'Spectral', serif" }}>{p}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <select value={playerDefaults?.[p] || ""} onChange={(e) => setPlayerDefaults({ ...playerDefaults, [p]: e.target.value })}
                style={{ background:"#0d0b09", color:"#8b7355", border:"1px solid #2a2018", borderRadius:3, padding:"2px 6px", fontSize:10, fontFamily:"'Spectral', serif", cursor:"pointer" }}>
                <option value="">— Regular —</option>
                {DMG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={() => removePlayer(p)} style={{ background:"transparent", border:"none", color:"#5c3030", cursor:"pointer", fontSize:16, fontWeight:700, padding:"0 4px" }}>×</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:24 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()}
          placeholder="New adventurer…" style={{ ...inputStyle, flex:1, textAlign:"left", padding:"8px 12px", fontSize:13 }} />
        <button onClick={addPlayer} style={{ ...roundBtnStyle, padding:"8px 16px", fontSize:13, color:"#daa520" }}>Recruit</button>
      </div>
      <Divider />
      <SectionTitle icon="📦">Backup & Restore</SectionTitle>
      <p style={{ fontSize:12, color:"#5c4a32", marginBottom:12, fontFamily:"'Spectral', serif" }}>Export saves all encounters and party data as a CSV file (opens in Excel). Import loads from a previously exported CSV — current data will be overwritten.</p>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={onExport} style={{ background:"linear-gradient(180deg, #1a2010, #101808)", color:"#2e8b57", border:"1px solid #1a4020", borderRadius:4, padding:"10px 20px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5 }}>
          ⬇ Export Tome
        </button>
        <button onClick={() => fileRef.current.click()} style={{ background:"linear-gradient(180deg, #101820, #0a1018)", color:"#4682b4", border:"1px solid #1a2840", borderRadius:4, padding:"10px 20px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5 }}>
          ⬆ Import Tome
        </button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }}
          onChange={(e) => { if (e.target.files[0]) { onImport(e.target.files[0]); e.target.value = ""; } }} />
      </div>
      <Divider />
      <SectionTitle icon="⚠">Danger Zone</SectionTitle>
      <p style={{ fontSize:12, color:"#5c4a32", marginBottom:12, fontFamily:"'Spectral', serif" }}>This will erase all encounters and party data. There is no resurrection spell for this action.</p>
      <button onClick={onReset} style={{ background:"linear-gradient(180deg, #2a1010, #1a0808)", color:"#d4442a", border:"1px solid #4a2020", borderRadius:4, padding:"10px 20px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5 }}>
        💀 Obliterate All Data
      </button>
    </ParchmentPanel>
  );
}

/* ─── Main App ─── */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [battles, setBattles] = useState([]);
  const [activeBattleIdx, setActiveBattleIdx] = useState(0);
  const [tab, setTab] = useState("entry");
  const [filterPlayer, setFilterPlayer] = useState("All");
  const [filterBattle, setFilterBattle] = useState("All");
  const [filterRound, setFilterRound] = useState("All");
  const [newBattleName, setNewBattleName] = useState("");
  const [showNewBattle, setShowNewBattle] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // "saving" | "saved" | "error"
  const [playerDefaults, setPlayerDefaults] = useState({}); // { [player]: default DMG type }
  const [trophyImages, setTrophyImages] = useState({});    // { [trophyKey]: imageUrl }
  const [trophyMeta, setTrophyMeta] = useState({});       // { [trophyKey]: { cr, hp } }

  // Wire the module-level save callback to this component's state setter.
  const setSyncRef = useRef(setSyncStatus);
  setSyncRef.current = setSyncStatus;
  useEffect(() => { _onSyncChange = (s) => setSyncRef.current(s); return () => { _onSyncChange = null; }; }, []);

  // Load state on mount.
  useEffect(() => { loadState().then((s) => { if (s) { setPlayers(s.players || DEFAULT_PLAYERS); setBattles(s.battles || []); setActiveBattleIdx(s.activeBattleIdx || 0); setPlayerDefaults(s.playerDefaults || {}); setTrophyImages(s.trophyImages || {}); setTrophyMeta(s.trophyMeta || {}); } setLoaded(true); }); }, []);

  // Save whenever state changes (debounced in saveState for Supabase).
  useEffect(() => { if (loaded) saveState({ players, battles, activeBattleIdx, playerDefaults, trophyImages, trophyMeta }); }, [players, battles, activeBattleIdx, playerDefaults, trophyImages, trophyMeta, loaded]);

  // Subscribe to realtime changes from other users.
  useEffect(() => {
    if (!supabase || !loaded) return;
    const channel = supabase
      .channel("campaign-sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${CAMPAIGN_ID}` }, ({ new: row }) => {
        if (row.client_id === CLIENT_ID) return; // ignore our own echoes
        const s = row.state;
        if (!s) return;
        setPlayers(s.players || DEFAULT_PLAYERS);
        setBattles(s.battles || []);
        setActiveBattleIdx(s.activeBattleIdx ?? 0);
        setPlayerDefaults(s.playerDefaults || {});
        setTrophyImages(s.trophyImages || {});
        setTrophyMeta(s.trophyMeta || {});
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loaded]);

  const addBattle = () => { const name = newBattleName.trim() || `Encounter ${battles.length + 1}`; setBattles([...battles, createEmptyBattle(name, players)]); setActiveBattleIdx(battles.length); setNewBattleName(""); setShowNewBattle(false); setTab("entry"); };
  const deleteBattle = (idx) => { const next = battles.filter((_, i) => i !== idx); setBattles(next); setActiveBattleIdx(Math.min(activeBattleIdx, Math.max(0, next.length - 1))); };
  const updateBattleData = (data) => setBattles((p) => p.map((b, i) => i === activeBattleIdx ? { ...b, data } : b));
  const updateBattleRounds = (rounds) => setBattles((p) => p.map((b, i) => i === activeBattleIdx ? { ...b, rounds } : b));
  const handleSetPlayers = (np) => {
    setPlayers(np);
    setBattles((prev) => prev.map((b) => {
      const nd = { ...b.data };
      const nde = { ...(b.dmgEntries || {}) };
      const ndb = { ...(b.dmgBase || {}) };
      const nnk = { ...(b.namedKills || {}) };
      np.forEach((p) => {
        if (!nd[p]) { nd[p] = {}; STAT_TYPES.forEach((s) => { nd[p][s] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) nd[p][s][r] = 0; }); }
        if (!nde[p]) { nde[p] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) nde[p][r] = []; }
        if (!ndb[p]) { ndb[p] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) ndb[p][r] = 0; }
        if (!nnk[p]) { nnk[p] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) nnk[p][r] = []; }
      });
      return { ...b, data:nd, dmgEntries:nde, dmgBase:ndb, namedKills:nnk };
    }));
  };
  const updateKillCell = (player, round, total, namedKillsList) => {
    setBattles((prev) => prev.map((b, i) => {
      if (i !== activeBattleIdx) return b;
      const nextData = JSON.parse(JSON.stringify(b.data));
      nextData[player]["KILL"][round] = Math.max(0, total);
      const nextNamedKills = JSON.parse(JSON.stringify(b.namedKills || {}));
      if (!nextNamedKills[player]) nextNamedKills[player] = {};
      nextNamedKills[player][round] = namedKillsList;
      return { ...b, data:nextData, namedKills:nextNamedKills };
    }));
  };

  const updateDmgCell = (player, round, base, typedEntries) => {
    const total = base + typedEntries.reduce((a, e) => a + (e.amount || 0), 0);
    setBattles((prev) => prev.map((b, i) => {
      if (i !== activeBattleIdx) return b;
      const nextData = JSON.parse(JSON.stringify(b.data));
      nextData[player]["DMG"][round] = total;
      const nextDmgBase = JSON.parse(JSON.stringify(b.dmgBase || {}));
      if (!nextDmgBase[player]) nextDmgBase[player] = {};
      nextDmgBase[player][round] = base;
      const nextDmgEntries = JSON.parse(JSON.stringify(b.dmgEntries || {}));
      if (!nextDmgEntries[player]) nextDmgEntries[player] = {};
      nextDmgEntries[player][round] = typedEntries;
      return { ...b, data:nextData, dmgBase:nextDmgBase, dmgEntries:nextDmgEntries };
    }));
  };

  const handleReset = () => { if (confirm("Obliterate all data? No resurrection!")) { setPlayers(DEFAULT_PLAYERS); setBattles([]); setActiveBattleIdx(0); setPlayerDefaults({}); setTrophyImages({}); setTrophyMeta({}); setTab("entry"); } };

  const handleExport = () => {
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const dmgTypeCols = DMG_TYPES.map((t) => `DMG:${t}`);
    const header = ["Encounter", "Round", "Player", ...STAT_TYPES, "DMG:Base", ...dmgTypeCols, "KILL:Named"];
    const rows = [header.map(escape).join(",")];
    rows.push(["#players", ...players].map(escape).join(","));
    battles.forEach((b) => {
      for (let r = 1; r <= b.rounds; r++) {
        players.forEach((p) => {
          const statVals = STAT_TYPES.map((s) => b.data[p]?.[s]?.[r] ?? 0);
          const baseVal = b.dmgBase?.[p]?.[r] ?? 0;
          const typeVals = DMG_TYPES.map((t) => (b.dmgEntries?.[p]?.[r] || []).filter((e) => e.type === t).reduce((a, e) => a + (e.amount || 0), 0));
          const namedKillStr = (b.namedKills?.[p]?.[r] || []).map((k) => k.name.replace(/\|/g, "\\|")).join("|");
          rows.push([escape(b.name), r, escape(p), ...statVals, baseVal, ...typeVals, escape(namedKillStr)].join(","));
        });
      }
    });
    const csv = rows.join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mordekai-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const lines = e.target.result.split(/\r?\n/).filter((l) => l.trim());
        // first non-empty line is the header
        const parseRow = (line) => line.match(/("(?:[^"]|"")*"|[^,]*)/g).filter((_, i) => i % 2 === 0).map((v) => v.startsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v);
        const header = parseRow(lines[0]);
        if (header[0] !== "Encounter") throw new Error();
        const statColIdxs = STAT_TYPES.map((s) => header.indexOf(s));
        const dmgBaseColIdx = header.indexOf("DMG:Base");
        const dmgTypeColIdxs = DMG_TYPES.map((t) => header.indexOf(`DMG:${t}`));
        const namedKillColIdx = header.indexOf("KILL:Named");

        let importedPlayers = null;
        const battleMap = new Map();

        for (let i = 1; i < lines.length; i++) {
          const row = parseRow(lines[i]);
          if (row[0] === "#players") { importedPlayers = row.slice(1).filter(Boolean); continue; }
          const enc = row[0], roundStr = row[1], player = row[2];
          const round = parseInt(roundStr, 10);
          if (!enc || isNaN(round) || !player) continue;
          if (!battleMap.has(enc)) {
            const data = {};
            const dmgEntries = {};
            const dmgBase = {};
            const namedKills = {};
            (importedPlayers || [player]).forEach((p) => {
              data[p] = {};
              STAT_TYPES.forEach((s) => { data[p][s] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) data[p][s][r] = 0; });
              dmgEntries[p] = {};
              dmgBase[p] = {};
              namedKills[p] = {};
              for (let r = 1; r <= MAX_ROUNDS; r++) { dmgEntries[p][r] = []; dmgBase[p][r] = 0; namedKills[p][r] = []; }
            });
            battleMap.set(enc, { id: generateId(), name: enc, rounds: 1, data, dmgEntries, dmgBase, namedKills });
          }
          const b = battleMap.get(enc);
          b.rounds = Math.max(b.rounds, round);
          if (!b.data[player]) {
            b.data[player] = {};
            STAT_TYPES.forEach((s) => { b.data[player][s] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) b.data[player][s][r] = 0; });
            b.dmgEntries[player] = {};
            b.dmgBase[player] = {};
            b.namedKills[player] = {};
            for (let r = 1; r <= MAX_ROUNDS; r++) { b.dmgEntries[player][r] = []; b.dmgBase[player][r] = 0; b.namedKills[player][r] = []; }
          }
          STAT_TYPES.forEach((s, si) => { if (statColIdxs[si] >= 0) b.data[player][s][round] = Number(row[statColIdxs[si]]) || 0; });
          // reconstruct dmgBase from DMG:Base column
          if (dmgBaseColIdx >= 0) b.dmgBase[player][round] = Number(row[dmgBaseColIdx]) || 0;
          // reconstruct dmgEntries from per-type columns (one entry per type)
          const typeEntries = DMG_TYPES.map((t, ti) => dmgTypeColIdxs[ti] >= 0 ? { type: t, amount: Number(row[dmgTypeColIdxs[ti]]) || 0 } : null).filter((e) => e && e.amount > 0);
          if (typeEntries.length > 0) b.dmgEntries[player][round] = typeEntries;
          // reconstruct namedKills from KILL:Named column
          if (namedKillColIdx >= 0 && row[namedKillColIdx]) {
            const names = row[namedKillColIdx].split(/(?<!\\)\|/).map((n) => n.replace(/\\\|/g, "|").trim()).filter(Boolean);
            if (names.length > 0) b.namedKills[player][round] = names.map((name) => ({ id: generateId(), name }));
          }
        }

        const newBattles = [...battleMap.values()];
        if (!newBattles.length && !importedPlayers) throw new Error();
        setPlayers(importedPlayers || players);
        setBattles(newBattles);
        setActiveBattleIdx(0);
        setPlayerDefaults({});
        setTab("entry");
      } catch {
        alert("Could not read that file — make sure it's a Mordekai CSV backup.");
      }
    };
    reader.readAsText(file);
  };

  const activeBattle = battles[activeBattleIdx];

  if (!loaded) return (
    <div style={{ ...rootStyle, display:"flex", justifyContent:"center", alignItems:"center", minHeight:300 }}>
      <D20Icon size={40} /><span style={{ color:"#8b7355", marginLeft:12, fontFamily:"'MedievalSharp', cursive" }}>Loading the tome…</span>
    </div>
  );

  return (
    <div style={rootStyle}>
      <link href="https://fonts.googleapis.com/css2?family=MedievalSharp&family=Spectral:ital,wght@0,400;0,600;0,700;1,400&family=Cinzel+Decorative:wght@700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:22, position:"relative" }}>
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:12, marginBottom:4 }}>
          <D20Icon size={32} />
          <h1 style={{ fontFamily:"'Cinzel Decorative', serif", fontSize:28, fontWeight:700, color:"#daa520", margin:0, letterSpacing:4, textShadow:"0 0 20px rgba(218,165,32,0.2), 0 2px 4px rgba(0,0,0,0.5)" }}>
            MORDEKAI'S BROKEN SEAL
          </h1>
          <D20Icon size={32} />
        </div>
        <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:4, color:"#5c4a32", fontWeight:600, fontFamily:"'Spectral', serif" }}>
          Chronicle of Battle
        </div>
        <div style={{ fontSize:10, color:"#3a3020", fontStyle:"italic", marginTop:4, fontFamily:"'Spectral', serif", display:"flex", justifyContent:"center", alignItems:"center", gap:10 }}>
          <span>{battles.length} encounter{battles.length !== 1 ? "s" : ""} recorded · {players.length} adventurer{players.length !== 1 ? "s" : ""} in the party</span>
          {supabase && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:9, textTransform:"uppercase", letterSpacing:1, fontStyle:"normal" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background: syncStatus === "error" ? "#d4442a" : syncStatus === "saving" ? "#daa520" : "#2e8b57", boxShadow:`0 0 6px ${syncStatus === "error" ? "#d4442a" : syncStatus === "saving" ? "#daa520" : "#2e8b57"}88` }} />
              <span style={{ color: syncStatus === "error" ? "#d4442a" : syncStatus === "saving" ? "#daa520" : "#2e8b57" }}>
                {syncStatus === "error" ? "Sync error" : syncStatus === "saving" ? "Saving…" : "Live"}
              </span>
            </span>
          )}
        </div>
        <div style={{ margin:"10px auto 0", width:200, height:1, background:"linear-gradient(90deg, transparent, #5c4a32, transparent)" }} />
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", justifyContent:"center", gap:0, marginBottom:18, borderBottom:"1px solid #2a2018" }}>
        {[{ id:"entry", label:"⚔ Battle Log" }, { id:"dashboard", label:"📊 War Room" }, { id:"trophy", label:"🏆 Trophy Room" }, { id:"settings", label:"⚙ Party" }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? "linear-gradient(180deg, #2a2018, transparent)" : "transparent",
            border:"none", borderBottom: tab === t.id ? "2px solid #daa520" : "2px solid transparent",
            color: tab === t.id ? "#daa520" : "#5c4a32",
            padding:"10px 20px", fontSize:12, fontWeight:700, cursor:"pointer",
            fontFamily:"'MedievalSharp', cursive", letterSpacing:1, transition:"all .2s",
            textShadow: tab === t.id ? "0 0 8px rgba(218,165,32,0.3)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Data Entry */}
      {tab === "entry" && (
        <div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
            {battles.map((b, i) => (
              <div key={b.id} style={{ display:"flex", alignItems:"center", gap:0 }}>
                <Pill active={activeBattleIdx === i} onClick={() => setActiveBattleIdx(i)}>{b.name}</Pill>
                <button onClick={(e) => { e.stopPropagation(); if (confirm(`Erase "${b.name}" from the chronicles?`)) deleteBattle(i); }}
                  style={{ background:"transparent", border:"none", color: activeBattleIdx === i ? "#5c3030" : "#2a2018", cursor:"pointer", fontSize:14, fontWeight:700, padding:"0 2px 0 0", marginLeft:-4 }}>×</button>
              </div>
            ))}
            {!showNewBattle ? (
              <button onClick={() => setShowNewBattle(true)} style={{ background:"#1a1510", border:"1px dashed #3a3020", borderRadius:4, color:"#8b7355", padding:"5px 14px", fontSize:12, cursor:"pointer", fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5 }}>+ New Encounter</button>
            ) : (
              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                <input autoFocus value={newBattleName} onChange={(e) => setNewBattleName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addBattle(); if (e.key === "Escape") setShowNewBattle(false); }}
                  placeholder="Name the encounter…" style={{ ...inputStyle, textAlign:"left", padding:"5px 10px", width:160, fontSize:12 }} />
                <button onClick={addBattle} style={{ ...roundBtnStyle, fontSize:12, padding:"5px 12px", color:"#daa520" }}>✓</button>
                <button onClick={() => setShowNewBattle(false)} style={{ ...roundBtnStyle, fontSize:12, padding:"5px 12px", color:"#5c3030" }}>✕</button>
              </div>
            )}
          </div>
          {activeBattle ? (
            <DataEntry battle={activeBattle} players={players} onChange={updateBattleData} onRoundsChange={updateBattleRounds} onDmgChange={updateDmgCell} onKillChange={updateKillCell} playerDefaults={playerDefaults} />
          ) : (
            <ParchmentPanel style={{ textAlign:"center", padding:40 }}>
              <D20Icon size={48} color="#3a3020" />
              <p style={{ color:"#5c4a32", fontSize:14, marginTop:12, fontFamily:"'Spectral', serif", fontStyle:"italic" }}>
                No encounters chronicled yet.<br />Click <strong style={{ color:"#8b7355" }}>+ New Encounter</strong> to begin your tale.
              </p>
            </ParchmentPanel>
          )}
        </div>
      )}

      {tab === "dashboard" && (
        battles.length === 0
          ? <ParchmentPanel style={{ textAlign:"center", padding:40 }}><D20Icon size={48} color="#3a3020" /><p style={{ color:"#5c4a32", fontSize:14, marginTop:12, fontFamily:"'Spectral', serif", fontStyle:"italic" }}>The War Room awaits your first encounter.</p></ParchmentPanel>
          : <Dashboard battles={battles} players={players} filterPlayer={filterPlayer} filterBattle={filterBattle} filterRound={filterRound}
              setFilterPlayer={setFilterPlayer} setFilterBattle={setFilterBattle} setFilterRound={setFilterRound} />
      )}

      {tab === "trophy" && <TrophyRoom battles={battles} players={players} trophyImages={trophyImages} setTrophyImages={setTrophyImages} trophyMeta={trophyMeta} setTrophyMeta={setTrophyMeta} />}

      {tab === "settings" && <Settings players={players} setPlayers={handleSetPlayers} onReset={handleReset} onExport={handleExport} onImport={handleImport} playerDefaults={playerDefaults} setPlayerDefaults={setPlayerDefaults} />}

      {/* Footer */}
      <div style={{ textAlign:"center", marginTop:30, paddingTop:14, borderTop:"1px solid #1a1510" }}>
        <div style={{ fontSize:9, color:"#2a2018", fontFamily:"'Spectral', serif", fontStyle:"italic" }}>
          "May your crits be plenty and your fumbles few."
        </div>
      </div>
    </div>
  );
}

/* ─── Shared styles ─── */
const rootStyle = {
  fontFamily:"'Spectral', serif",
  background:"radial-gradient(ellipse at top, #1a1510 0%, #0d0b09 70%)",
  color:"#c4a97d", padding:20, minHeight:"100vh", boxSizing:"border-box",
};
const tableStyle = { width:"100%", borderCollapse:"collapse", fontFamily:"'Spectral', serif", fontSize:13 };
const summaryTableStyle = { ...tableStyle, tableLayout:"fixed" };
const thStyle = { textAlign:"left", padding:"6px 8px", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#8b7355", borderBottom:"1px solid #3a3020", whiteSpace:"nowrap", fontFamily:"'MedievalSharp', cursive" };
const tdStyle = { padding:"5px 8px", borderBottom:"1px solid #1a1510", verticalAlign:"middle" };
const tdNameStyle = { ...tdStyle, fontWeight:600, color:"#c4a97d", whiteSpace:"nowrap", fontSize:13 };
const inputStyle = { background:"#0d0b09", border:"1px solid #3a3020", borderRadius:3, color:"#c4a97d", fontFamily:"'Spectral', serif", fontSize:13, fontWeight:600, padding:"4px 6px", width:46, textAlign:"center", outline:"none" };
const roundBtnStyle = { background:"#1a1510", border:"1px solid #3a3020", borderRadius:3, color:"#c4a97d", fontWeight:700, fontSize:16, cursor:"pointer", padding:"2px 10px", fontFamily:"'MedievalSharp', cursive" };
