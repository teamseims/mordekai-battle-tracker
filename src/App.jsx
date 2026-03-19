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

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Unique ID for this browser tab. Used to suppress realtime echoes of our own saves.
const CLIENT_ID = generateId();

function createEmptyBattle(name, players) {
  const data = {};
  const dmgEntries = {};
  const namedKills = {};
  players.forEach((p) => {
    data[p] = {};
    STAT_TYPES.forEach((s) => { data[p][s] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) data[p][s][r] = 0; });
    dmgEntries[p] = {};
    namedKills[p] = {};
    for (let r = 1; r <= MAX_ROUNDS; r++) { dmgEntries[p][r] = []; namedKills[p][r] = []; }
  });
  return { id: generateId(), name, rounds: 1, data, dmgEntries, namedKills };
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
      <input type="number" min={namedCount} value={value || ""} placeholder="–"
        onChange={(e) => onUpdate(Math.max(namedCount, parseInt(e.target.value) || 0), namedKills)}
        style={{ ...inputStyle, width: namedCount > 0 ? 34 : 46 }} />

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
function DmgCell({ entries, defaultType, onChange }) {
  const [open, setOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [newAmt, setNewAmt] = useState("");
  const [newType, setNewType] = useState(defaultType || DMG_TYPES[0]);
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const total = entries.reduce((a, e) => a + (e.amount || 0), 0);

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

  const openPanel = () => { setPos(getRect()); setNewType(defaultType || DMG_TYPES[0]); setTooltipVisible(false); setOpen(true); };
  const addEntry = () => { const amt = parseInt(newAmt); if (!amt || amt <= 0) return; onChange([...entries, { amount: amt, type: newType }]); setNewAmt(""); };
  const removeEntry = (i) => onChange(entries.filter((_, idx) => idx !== i));

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", gap:3, justifyContent:"center" }}>
      <span
        onMouseEnter={() => { if (!open && entries.length > 0) { setPos(getRect()); setTooltipVisible(true); } }}
        onMouseLeave={() => setTooltipVisible(false)}
        style={{ fontSize:12, fontWeight:700, color: total > 0 ? "#d4442a" : "#3a3020", minWidth:18, display:"inline-block", textAlign:"center" }}
      >{total || "–"}</span>
      <button onClick={openPanel} style={{ background:"#2a1e10", border:"1px solid #3a3020", borderRadius:3, color:"#8b7355", cursor:"pointer", fontSize:10, fontWeight:700, padding:"0px 4px", lineHeight:"14px" }}>+</button>

      {/* Hover breakdown tooltip */}
      {tooltipVisible && !open && entries.length > 0 && (
        <div style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:200, background:"#1a1510", border:"1px solid #5c4a32", borderRadius:4, padding:"6px 10px", fontSize:11, fontFamily:"'Spectral', serif", pointerEvents:"none", whiteSpace:"nowrap", boxShadow:"0 4px 16px rgba(0,0,0,0.6)" }}>
          {entries.map((e, i) => (
            <div key={i} style={{ display:"flex", gap:8, alignItems:"center", color: DMG_TYPE_COLORS[e.type] || "#c4a97d" }}>
              <span style={{ fontWeight:700 }}>{e.amount}</span><span>{e.type || "—"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Entry panel */}
      {open && (
        <div ref={panelRef} style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:300, background:"#1a1510", border:"1px solid #5c4a32", borderRadius:6, padding:"10px 12px", minWidth:212, boxShadow:"0 8px 32px rgba(0,0,0,0.7)", fontFamily:"'Spectral', serif" }}>
          <div style={{ fontSize:10, color:"#daa520", fontFamily:"'MedievalSharp', cursive", marginBottom:8, letterSpacing:1 }}>Damage Entries</div>
          {entries.length > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
              {entries.map((e, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6, background:"#0d0b09", borderRadius:3, padding:"3px 6px" }}>
                  <span style={{ fontWeight:700, color: DMG_TYPE_COLORS[e.type] || "#c4a97d", minWidth:24 }}>{e.amount}</span>
                  <span style={{ color:"#8b7355", fontSize:11, flex:1 }}>{e.type || "—"}</span>
                  <button onClick={() => removeEntry(i)} style={{ background:"transparent", border:"none", color:"#5c3030", cursor:"pointer", fontSize:13, fontWeight:700, padding:"0 2px", lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:11, color:"#3a3020", fontStyle:"italic", marginBottom:8 }}>No entries yet</div>
          )}
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <input type="number" min={1} value={newAmt} onChange={(e) => setNewAmt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
              placeholder="Amt" style={{ background:"#0d0b09", border:"1px solid #3a3020", borderRadius:3, color:"#c4a97d", fontFamily:"'Spectral', serif", fontSize:11, fontWeight:600, padding:"4px 6px", width:44, textAlign:"center", outline:"none" }} />
            <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ background:"#1a1510", color:"#c4a97d", border:"1px solid #3a3020", borderRadius:4, padding:"4px 4px", fontSize:11, fontFamily:"'Spectral', serif", flex:1 }}>
              <option value="">— Regular —</option>
              {DMG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={addEntry} style={{ background:"#2a1e10", border:"1px solid #5c4a32", borderRadius:3, color:"#daa520", cursor:"pointer", fontSize:11, padding:"4px 8px" }}>Add</button>
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
                  {roundNums.map((r) => <th key={r} style={{ ...thStyle, textAlign:"center", minWidth:52 }}>R{r}</th>)}
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
                            <DmgCell entries={dmgEntries[p]?.[r] || []} defaultType={playerDefaults?.[p] || ""} onChange={(ent) => onDmgChange(p, r, ent)} />
                          ) : stat === "KILL" ? (
                            <KillCell value={d[p]?.["KILL"]?.[r] || 0} namedKills={namedKillsData[p]?.[r] || []} onUpdate={(val, kills) => onKillChange(p, r, val, kills)} />
                          ) : (
                            <input type="number" min={0} value={d[p]?.[stat]?.[r] || ""} placeholder="–"
                              onChange={(e) => setCellValue(stat, p, r, e.target.value)} style={inputStyle} />
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
          (b.dmgEntries?.[p]?.[r] || []).forEach((e) => {
            const key = e.type || "—";
            out[key] = (out[key] || 0) + (e.amount || 0);
          });
        }
      });
    });
    const order = [...DMG_TYPES, "—"];
    return order.filter((t) => out[t] > 0).map((t) => ({ name: t, value: out[t], color: DMG_TYPE_COLORS[t] || "#8b7355" }));
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
              {killPieData.length > 0 && (
                <ChartCard title="Kill Tally" height={fp.length > 1 ? 123 : 190} icon="💀">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={killPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        outerRadius={fp.length > 1 ? 42 : 65} innerRadius={fp.length > 1 ? 20 : 32} strokeWidth={0}>
                        {killPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:"#8b7355", fontFamily:"'Spectral', serif" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
              {healPieData.length > 0 && (
                <ChartCard title="Healing Shared" height={fp.length > 1 ? 123 : 190} icon="❤">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={healPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        outerRadius={fp.length > 1 ? 42 : 65} innerRadius={fp.length > 1 ? 20 : 32} strokeWidth={0}>
                        {healPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:"#8b7355", fontFamily:"'Spectral', serif" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
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
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Hero</th>{STAT_TYPES.map((s) => <th key={s} style={{ ...thStyle, textAlign:"center", color:STAT_COLORS[s] }}>{STAT_ICONS[s]} {s}</th>)}</tr></thead>
            <tbody>
              {fp.map((p) => (<tr key={p}><td style={tdNameStyle}>{p}</td>{STAT_TYPES.map((s) => <td key={s} style={{ ...tdStyle, textAlign:"center" }}><StatBadge stat={s} value={stats[p][s]} small /></td>)}</tr>))}
              {fp.length > 1 && (<tr><td style={{ ...tdNameStyle, color:"#8b7355", fontStyle:"italic" }}>Party</td>{STAT_TYPES.map((s) => <td key={s} style={{ ...tdStyle, textAlign:"center" }}><StatBadge stat={s} value={totals[s]} small /></td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </ParchmentPanel>

      {roundNums.length > 0 && (
        <>
          <SectionTitle icon="⏱">By Round of Combat</SectionTitle>
          <ParchmentPanel style={{ marginBottom:16 }}>
            <div style={{ overflowX:"auto" }}>
              <table style={tableStyle}>
                <thead><tr><th style={thStyle}>Round</th>{STAT_TYPES.map((s) => <th key={s} style={{ ...thStyle, textAlign:"center", color:STAT_COLORS[s] }}>{STAT_ICONS[s]}</th>)}</tr></thead>
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
              <table style={tableStyle}>
                <thead><tr><th style={thStyle}>Encounter</th>{STAT_TYPES.map((s) => <th key={s} style={{ ...thStyle, textAlign:"center", color:STAT_COLORS[s] }}>{STAT_ICONS[s]}</th>)}</tr></thead>
                <tbody>
                  {battleBreakdown.map((row) => (<tr key={row.id}><td style={tdNameStyle}>{row.name}</td>{STAT_TYPES.map((s) => <td key={s} style={{ ...tdStyle, textAlign:"center" }}><StatBadge stat={s} value={row[s]} small /></td>)}</tr>))}
                </tbody>
              </table>
            </div>
          </ParchmentPanel>
        </>
      )}

      {/* ── Trophy Wall ── */}
      {trophyWall.length > 0 && (
        <>
          <Divider />
          <SectionTitle icon="☠">Trophy Wall</SectionTitle>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            {trophyWall.map((k, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"10px 16px", background:"linear-gradient(90deg, #1a1208 0%, #110d04 60%, #0d0b09 100%)", border:"1px solid #3a2800", borderRadius:6, boxShadow:"0 0 12px rgba(218,165,32,0.07), inset 0 1px 0 rgba(218,165,32,0.06)" }}>
                <span style={{ fontSize:22, color:"#daa520", flexShrink:0, textShadow:"0 0 12px rgba(218,165,32,0.6)" }}>☠</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#daa520", fontFamily:"'MedievalSharp', cursive", letterSpacing:0.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{k.name}</div>
                  <div style={{ fontSize:11, color:"#5c4a32", fontFamily:"'Spectral', serif", marginTop:2 }}>
                    Slain by{" "}
                    <span style={{ color: PLAYER_COLORS[players.indexOf(k.player) % PLAYER_COLORS.length], fontWeight:700 }}>{k.player}</span>
                    <span style={{ color:"#3a3020" }}> · </span>
                    <span style={{ color:"#8b7355", fontStyle:"italic" }}>{k.encounter}</span>
                    <span style={{ color:"#3a3020" }}> · </span>
                    <span style={{ color:"#5c4a32" }}>Round {k.round}</span>
                  </div>
                </div>
                <div style={{ fontSize:11, color:"#3a2800", fontFamily:"'MedievalSharp', cursive", flexShrink:0 }}>R{k.round}</div>
              </div>
            ))}
          </div>
        </>
      )}
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

  // Wire the module-level save callback to this component's state setter.
  const setSyncRef = useRef(setSyncStatus);
  setSyncRef.current = setSyncStatus;
  useEffect(() => { _onSyncChange = (s) => setSyncRef.current(s); return () => { _onSyncChange = null; }; }, []);

  // Load state on mount.
  useEffect(() => { loadState().then((s) => { if (s) { setPlayers(s.players || DEFAULT_PLAYERS); setBattles(s.battles || []); setActiveBattleIdx(s.activeBattleIdx || 0); setPlayerDefaults(s.playerDefaults || {}); } setLoaded(true); }); }, []);

  // Save whenever state changes (debounced in saveState for Supabase).
  useEffect(() => { if (loaded) saveState({ players, battles, activeBattleIdx, playerDefaults }); }, [players, battles, activeBattleIdx, playerDefaults, loaded]);

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
      const nnk = { ...(b.namedKills || {}) };
      np.forEach((p) => {
        if (!nd[p]) { nd[p] = {}; STAT_TYPES.forEach((s) => { nd[p][s] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) nd[p][s][r] = 0; }); }
        if (!nde[p]) { nde[p] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) nde[p][r] = []; }
        if (!nnk[p]) { nnk[p] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) nnk[p][r] = []; }
      });
      return { ...b, data:nd, dmgEntries:nde, namedKills:nnk };
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

  const updateDmgCell = (player, round, entries) => {
    const total = entries.reduce((a, e) => a + (e.amount || 0), 0);
    setBattles((prev) => prev.map((b, i) => {
      if (i !== activeBattleIdx) return b;
      const nextData = JSON.parse(JSON.stringify(b.data));
      nextData[player]["DMG"][round] = total;
      const nextDmgEntries = JSON.parse(JSON.stringify(b.dmgEntries || {}));
      if (!nextDmgEntries[player]) nextDmgEntries[player] = {};
      nextDmgEntries[player][round] = entries;
      return { ...b, data:nextData, dmgEntries:nextDmgEntries };
    }));
  };

  const handleReset = () => { if (confirm("Obliterate all data? No resurrection!")) { setPlayers(DEFAULT_PLAYERS); setBattles([]); setActiveBattleIdx(0); setPlayerDefaults({}); setTab("entry"); } };

  const handleExport = () => {
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const dmgTypeCols = DMG_TYPES.map((t) => `DMG:${t}`);
    const header = ["Encounter", "Round", "Player", ...STAT_TYPES, ...dmgTypeCols, "KILL:Named"];
    const rows = [header.map(escape).join(",")];
    rows.push(["#players", ...players].map(escape).join(","));
    battles.forEach((b) => {
      for (let r = 1; r <= b.rounds; r++) {
        players.forEach((p) => {
          const statVals = STAT_TYPES.map((s) => b.data[p]?.[s]?.[r] ?? 0);
          const typeVals = DMG_TYPES.map((t) => (b.dmgEntries?.[p]?.[r] || []).filter((e) => e.type === t).reduce((a, e) => a + (e.amount || 0), 0));
          const namedKillStr = (b.namedKills?.[p]?.[r] || []).map((k) => k.name.replace(/\|/g, "\\|")).join("|");
          rows.push([escape(b.name), r, escape(p), ...statVals, ...typeVals, escape(namedKillStr)].join(","));
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
            const namedKills = {};
            (importedPlayers || [player]).forEach((p) => {
              data[p] = {};
              STAT_TYPES.forEach((s) => { data[p][s] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) data[p][s][r] = 0; });
              dmgEntries[p] = {};
              namedKills[p] = {};
              for (let r = 1; r <= MAX_ROUNDS; r++) { dmgEntries[p][r] = []; namedKills[p][r] = []; }
            });
            battleMap.set(enc, { id: generateId(), name: enc, rounds: 1, data, dmgEntries, namedKills });
          }
          const b = battleMap.get(enc);
          b.rounds = Math.max(b.rounds, round);
          if (!b.data[player]) {
            b.data[player] = {};
            STAT_TYPES.forEach((s) => { b.data[player][s] = {}; for (let r = 1; r <= MAX_ROUNDS; r++) b.data[player][s][r] = 0; });
            b.dmgEntries[player] = {};
            b.namedKills[player] = {};
            for (let r = 1; r <= MAX_ROUNDS; r++) { b.dmgEntries[player][r] = []; b.namedKills[player][r] = []; }
          }
          STAT_TYPES.forEach((s, si) => { if (statColIdxs[si] >= 0) b.data[player][s][round] = Number(row[statColIdxs[si]]) || 0; });
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
        {[{ id:"entry", label:"⚔ Battle Log", emoji:"" }, { id:"dashboard", label:"📊 War Room", emoji:"" }, { id:"settings", label:"⚙ Party", emoji:"" }].map((t) => (
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
const thStyle = { textAlign:"left", padding:"6px 8px", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#8b7355", borderBottom:"1px solid #3a3020", whiteSpace:"nowrap", fontFamily:"'MedievalSharp', cursive" };
const tdStyle = { padding:"5px 6px", borderBottom:"1px solid #1a1510", verticalAlign:"middle" };
const tdNameStyle = { ...tdStyle, fontWeight:600, color:"#c4a97d", whiteSpace:"nowrap", fontSize:13 };
const inputStyle = { background:"#0d0b09", border:"1px solid #3a3020", borderRadius:3, color:"#c4a97d", fontFamily:"'Spectral', serif", fontSize:13, fontWeight:600, padding:"4px 6px", width:46, textAlign:"center", outline:"none" };
const roundBtnStyle = { background:"#1a1510", border:"1px solid #3a3020", borderRadius:3, color:"#c4a97d", fontWeight:700, fontSize:16, cursor:"pointer", padding:"2px 10px", fontFamily:"'MedievalSharp', cursive" };
