import React from "react";

/*
 * Medieval Trophy Frames — 6 ornate SVG frame designs
 * 
 * Usage: <Frame1 width={280} height={360} color="#b8860b" />
 * 
 * Each frame renders an SVG with a transparent center where
 * the trophy image or placeholder text goes.
 * 
 * Colors can be changed to simulate materials:
 *   Gold:    #b8860b / #daa520
 *   Bronze:  #8b6914 / #cd7f32  
 *   Silver:  #708090 / #a8a8a8
 *   Iron:    #4a4a4a / #696969
 *   Wood:    #5c3317 / #8b4513
 */

/* ── Frame 1: Classic Ornate Rectangle ── 
   Thick beveled border with decorative corner flourishes 
   and carved scrollwork along the edges */
export function Frame1({ width = 280, height = 360, color = "#b8860b", accent = "#daa520" }) {
  return (
    <svg width={width} height={height} viewBox="0 0 280 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer border */}
      <rect x="2" y="2" width="276" height="356" rx="4" stroke={color} strokeWidth="4" fill="none"/>
      {/* Inner border creating depth */}
      <rect x="12" y="12" width="256" height="336" rx="3" stroke={accent} strokeWidth="2" fill="none"/>
      {/* Bevel shadow lines */}
      <rect x="7" y="7" width="266" height="346" rx="3" stroke={color} strokeWidth="1" opacity="0.5" fill="none"/>
      <rect x="17" y="17" width="246" height="326" rx="2" stroke={color} strokeWidth="1" opacity="0.3" fill="none"/>
      
      {/* Top-left corner flourish */}
      <g transform="translate(4, 4)">
        <path d="M0,25 Q0,0 25,0" stroke={accent} strokeWidth="3" fill="none"/>
        <path d="M5,20 C5,8 8,5 20,5" stroke={color} strokeWidth="2" fill="none"/>
        <circle cx="8" cy="8" r="4" fill={accent} opacity="0.8"/>
        <path d="M12,2 Q8,12 2,12" stroke={accent} strokeWidth="1.5" fill="none"/>
        <path d="M25,0 C18,3 15,8 15,15 M0,25 C3,18 8,15 15,15" stroke={color} strokeWidth="1" opacity="0.6" fill="none"/>
      </g>
      
      {/* Top-right corner flourish */}
      <g transform="translate(276, 4) scale(-1, 1)">
        <path d="M0,25 Q0,0 25,0" stroke={accent} strokeWidth="3" fill="none"/>
        <path d="M5,20 C5,8 8,5 20,5" stroke={color} strokeWidth="2" fill="none"/>
        <circle cx="8" cy="8" r="4" fill={accent} opacity="0.8"/>
        <path d="M12,2 Q8,12 2,12" stroke={accent} strokeWidth="1.5" fill="none"/>
        <path d="M25,0 C18,3 15,8 15,15 M0,25 C3,18 8,15 15,15" stroke={color} strokeWidth="1" opacity="0.6" fill="none"/>
      </g>
      
      {/* Bottom-left corner flourish */}
      <g transform="translate(4, 356) scale(1, -1)">
        <path d="M0,25 Q0,0 25,0" stroke={accent} strokeWidth="3" fill="none"/>
        <path d="M5,20 C5,8 8,5 20,5" stroke={color} strokeWidth="2" fill="none"/>
        <circle cx="8" cy="8" r="4" fill={accent} opacity="0.8"/>
        <path d="M12,2 Q8,12 2,12" stroke={accent} strokeWidth="1.5" fill="none"/>
      </g>
      
      {/* Bottom-right corner flourish */}
      <g transform="translate(276, 356) scale(-1, -1)">
        <path d="M0,25 Q0,0 25,0" stroke={accent} strokeWidth="3" fill="none"/>
        <path d="M5,20 C5,8 8,5 20,5" stroke={color} strokeWidth="2" fill="none"/>
        <circle cx="8" cy="8" r="4" fill={accent} opacity="0.8"/>
        <path d="M12,2 Q8,12 2,12" stroke={accent} strokeWidth="1.5" fill="none"/>
      </g>
      
      {/* Top center ornament */}
      <g transform="translate(140, 2)">
        <path d="M-20,8 C-12,0 -4,0 0,-2 C4,0 12,0 20,8" stroke={accent} strokeWidth="2" fill="none"/>
        <path d="M-15,8 C-8,3 -3,2 0,1 C3,2 8,3 15,8" stroke={color} strokeWidth="1" fill={color} opacity="0.3"/>
        <circle cx="0" cy="4" r="2" fill={accent}/>
      </g>
      
      {/* Bottom center ornament */}
      <g transform="translate(140, 358) scale(1, -1)">
        <path d="M-20,8 C-12,0 -4,0 0,-2 C4,0 12,0 20,8" stroke={accent} strokeWidth="2" fill="none"/>
        <path d="M-15,8 C-8,3 -3,2 0,1 C3,2 8,3 15,8" stroke={color} strokeWidth="1" fill={color} opacity="0.3"/>
        <circle cx="0" cy="4" r="2" fill={accent}/>
      </g>
      
      {/* Side scrollwork - left */}
      <path d="M6,100 C2,110 2,120 6,130" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.6"/>
      <path d="M6,200 C2,210 2,220 6,230" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.6"/>
      
      {/* Side scrollwork - right */}
      <path d="M274,100 C278,110 278,120 274,130" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.6"/>
      <path d="M274,200 C278,210 278,220 274,230" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.6"/>
    </svg>
  );
}

/* ── Frame 2: Oval/Cameo Portrait Frame ── 
   Elegant oval with ornamental crest at top and 
   decorative leaf motifs */
export function Frame2({ width = 260, height = 340, color = "#708090", accent = "#a8a8a8" }) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox="0 0 260 340" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer oval */}
      <ellipse cx="130" cy="170" rx="125" ry="162" stroke={color} strokeWidth="4" fill="none"/>
      {/* Inner oval - creates bevel depth */}
      <ellipse cx="130" cy="170" rx="115" ry="152" stroke={accent} strokeWidth="2" fill="none"/>
      {/* Mid oval for thickness */}
      <ellipse cx="130" cy="170" rx="120" ry="157" stroke={color} strokeWidth="1" opacity="0.4" fill="none"/>
      
      {/* Top crest ornament */}
      <g transform="translate(130, 6)">
        <path d="M-30,15 C-25,5 -15,0 0,-5 C15,0 25,5 30,15" stroke={accent} strokeWidth="2.5" fill="none"/>
        <path d="M-20,12 C-15,5 -8,2 0,0 C8,2 15,5 20,12" stroke={color} strokeWidth="1.5" fill={color} opacity="0.2"/>
        <path d="M0,-5 L0,5" stroke={accent} strokeWidth="2"/>
        <path d="M-8,2 L0,-8 L8,2" stroke={accent} strokeWidth="1.5" fill="none"/>
        <circle cx="0" cy="-8" r="3" fill={accent} opacity="0.8"/>
        {/* Leaf sprigs from crest */}
        <path d="M-15,8 C-22,2 -28,4 -32,10" stroke={accent} strokeWidth="1" fill="none" opacity="0.7"/>
        <path d="M15,8 C22,2 28,4 32,10" stroke={accent} strokeWidth="1" fill="none" opacity="0.7"/>
      </g>
      
      {/* Bottom ornament */}
      <g transform="translate(130, 332)">
        <path d="M-25,0 C-15,-10 -5,-12 0,-14 C5,-12 15,-10 25,0" stroke={accent} strokeWidth="2" fill="none"/>
        <circle cx="0" cy="-6" r="2.5" fill={accent} opacity="0.7"/>
        <path d="M-12,-3 C-6,-8 6,-8 12,-3" stroke={color} strokeWidth="1" fill="none"/>
      </g>
      
      {/* Side leaf ornaments - left */}
      <g transform="translate(8, 120)">
        <path d="M0,0 C-4,10 -2,20 0,30 C-4,40 -2,50 0,60" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.5"/>
        <path d="M2,10 C-3,15 -3,20 2,25" stroke={color} strokeWidth="1" fill={color} opacity="0.15"/>
        <path d="M2,35 C-3,40 -3,45 2,50" stroke={color} strokeWidth="1" fill={color} opacity="0.15"/>
      </g>
      
      {/* Side leaf ornaments - right */}
      <g transform="translate(252, 120)">
        <path d="M0,0 C4,10 2,20 0,30 C4,40 2,50 0,60" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.5"/>
        <path d="M-2,10 C3,15 3,20 -2,25" stroke={color} strokeWidth="1" fill={color} opacity="0.15"/>
        <path d="M-2,35 C3,40 3,45 -2,50" stroke={color} strokeWidth="1" fill={color} opacity="0.15"/>
      </g>
      
      {/* Decorative dots around oval */}
      {[0, 30, 60, 120, 150, 180, 210, 240, 300, 330].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = 130 + 122 * Math.cos(rad);
        const y = 170 + 159 * Math.sin(rad);
        return <circle key={angle} cx={x} cy={y} r="1.5" fill={accent} opacity="0.5"/>;
      })}
    </svg>
  );
}

/* ── Frame 3: Gothic Arch Frame ── 
   Pointed arch top with cathedral-inspired tracery
   and iron rivet details */
export function Frame3({ width = 260, height = 370, color = "#4a4a4a", accent = "#696969" }) {
  return (
    <svg width={width} height={height} viewBox="0 0 260 370" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Main arch shape */}
      <path d="M20,370 L20,140 Q20,40 130,10 Q240,40 240,140 L240,370" stroke={color} strokeWidth="5" fill="none"/>
      {/* Inner arch */}
      <path d="M32,365 L32,142 Q32,52 130,24 Q228,52 228,142 L228,365" stroke={accent} strokeWidth="2" fill="none"/>
      {/* Middle line for depth */}
      <path d="M26,367 L26,141 Q26,46 130,17 Q234,46 234,141 L234,367" stroke={color} strokeWidth="1" opacity="0.4" fill="none"/>
      
      {/* Gothic tracery at top */}
      <g transform="translate(130, 10)">
        {/* Central pointed ornament */}
        <path d="M0,-6 L-4,4 L0,2 L4,4 Z" fill={accent} opacity="0.8"/>
        <path d="M0,-6 L0,-12" stroke={accent} strokeWidth="2"/>
        <circle cx="0" cy="-14" r="3" fill={accent} opacity="0.7"/>
        {/* Cross at peak */}
        <path d="M-4,-14 L4,-14 M0,-18 L0,-10" stroke={color} strokeWidth="1.5"/>
      </g>
      
      {/* Iron rivets along the frame */}
      {[80, 140, 200, 260, 320].map((y) => (
        <React.Fragment key={y}>
          <circle cx="23" cy={y} r="3.5" fill={color} opacity="0.7"/>
          <circle cx="23" cy={y} r="2" fill={accent} opacity="0.4"/>
          <circle cx="237" cy={y} r="3.5" fill={color} opacity="0.7"/>
          <circle cx="237" cy={y} r="2" fill={accent} opacity="0.4"/>
        </React.Fragment>
      ))}
      
      {/* Bottom iron crossbar */}
      <line x1="20" y1="365" x2="240" y2="365" stroke={color} strokeWidth="3"/>
      <line x1="20" y1="360" x2="240" y2="360" stroke={accent} strokeWidth="1" opacity="0.4"/>
      
      {/* Hinge details at sides */}
      <g transform="translate(20, 180)">
        <path d="M0,0 L-8,-8 M0,0 L-8,8 M-8,-8 L-8,8" stroke={color} strokeWidth="2" fill="none"/>
        <circle cx="-8" cy="0" r="3" fill={accent} opacity="0.5"/>
      </g>
      <g transform="translate(240, 180)">
        <path d="M0,0 L8,-8 M0,0 L8,8 M8,-8 L8,8" stroke={color} strokeWidth="2" fill="none"/>
        <circle cx="8" cy="0" r="3" fill={accent} opacity="0.5"/>
      </g>
      
      {/* Arch interior tracery lines */}
      <path d="M70,60 Q130,35 190,60" stroke={accent} strokeWidth="1" fill="none" opacity="0.3"/>
      <path d="M50,80 Q130,50 210,80" stroke={accent} strokeWidth="1" fill="none" opacity="0.2"/>
    </svg>
  );
}

/* ── Frame 4: Heraldic Shield Frame ── 
   Shield shape with banner ribbon and 
   crossed elements behind */
export function Frame4({ width = 260, height = 360, color = "#8b4513", accent = "#cd853f" }) {
  return (
    <svg width={width} height={height} viewBox="0 0 260 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield outline */}
      <path d="M130,10 L240,40 L240,200 Q240,300 130,350 Q20,300 20,200 L20,40 Z" 
        stroke={color} strokeWidth="5" fill="none" strokeLinejoin="round"/>
      {/* Inner shield */}
      <path d="M130,24 L228,50 L228,198 Q228,290 130,336 Q32,290 32,198 L32,50 Z" 
        stroke={accent} strokeWidth="2" fill="none" strokeLinejoin="round"/>
      {/* Mid shield for depth */}
      <path d="M130,17 L234,45 L234,199 Q234,295 130,343 Q26,295 26,199 L26,45 Z" 
        stroke={color} strokeWidth="1" opacity="0.4" fill="none" strokeLinejoin="round"/>
      
      {/* Top crown/crest ornament */}
      <g transform="translate(130, 4)">
        <path d="M-15,6 L-10,-4 L-5,2 L0,-8 L5,2 L10,-4 L15,6" stroke={accent} strokeWidth="2" fill={color} opacity="0.4"/>
        <path d="M-18,8 L18,8" stroke={accent} strokeWidth="2"/>
        <circle cx="0" cy="-8" r="2" fill={accent}/>
        <circle cx="-10" cy="-4" r="1.5" fill={accent} opacity="0.7"/>
        <circle cx="10" cy="-4" r="1.5" fill={accent} opacity="0.7"/>
      </g>
      
      {/* Crossed swords behind shield */}
      <g opacity="0.35">
        <line x1="40" y1="350" x2="220" y2="20" stroke={accent} strokeWidth="3"/>
        <line x1="220" y1="350" x2="40" y2="20" stroke={accent} strokeWidth="3"/>
        {/* Sword pommels */}
        <circle cx="40" cy="350" r="5" fill={color}/>
        <circle cx="220" cy="350" r="5" fill={color}/>
        {/* Sword guards */}
        <line x1="56" y1="330" x2="48" y2="340" stroke={accent} strokeWidth="3"/>
        <line x1="204" y1="330" x2="212" y2="340" stroke={accent} strokeWidth="3"/>
      </g>
      
      {/* Shield studs/rivets */}
      {[
        [60, 55], [200, 55],
        [40, 120], [220, 120],
        [35, 200], [225, 200],
        [55, 270], [205, 270],
      ].map(([x, y], i) => (
        <React.Fragment key={i}>
          <circle cx={x} cy={y} r="3" fill={color} opacity="0.6"/>
          <circle cx={x} cy={y} r="1.5" fill={accent} opacity="0.4"/>
        </React.Fragment>
      ))}
      
      {/* Decorative line at shield top */}
      <path d="M60,48 Q130,35 200,48" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.5"/>
    </svg>
  );
}

/* ── Frame 5: Circular Medallion Frame ── 
   Round frame with chain border and 
   compass-rose decorations */
export function Frame5({ width = 300, height = 340, color = "#cd7f32", accent = "#daa520" }) {
  const cx = 150;
  const cy = 160;
  const outerR = 140;
  const innerR = 128;
  return (
    <svg width={width} height={height} viewBox="0 0 300 340" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer circle */}
      <circle cx={cx} cy={cy} r={outerR} stroke={color} strokeWidth="4" fill="none"/>
      {/* Inner circle */}
      <circle cx={cx} cy={cy} r={innerR} stroke={accent} strokeWidth="2" fill="none"/>
      {/* Mid circle for depth */}
      <circle cx={cx} cy={cy} r={outerR - 6} stroke={color} strokeWidth="1" opacity="0.4" fill="none"/>
      
      {/* Chain link pattern around the border */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180;
        const r = outerR - 3;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return (
          <ellipse key={i} cx={x} cy={y} rx="5" ry="3" fill="none" stroke={accent} strokeWidth="1"
            opacity="0.5" transform={`rotate(${i * 15}, ${x}, ${y})`}/>
        );
      })}
      
      {/* Compass rose points - N, S, E, W */}
      <g transform={`translate(${cx}, ${cy - outerR - 2})`}>
        <path d="M0,0 L-6,12 L0,8 L6,12 Z" fill={accent} opacity="0.8"/>
      </g>
      <g transform={`translate(${cx}, ${cy + outerR + 2}) rotate(180)`}>
        <path d="M0,0 L-6,12 L0,8 L6,12 Z" fill={accent} opacity="0.8"/>
      </g>
      <g transform={`translate(${cx + outerR + 2}, ${cy}) rotate(90)`}>
        <path d="M0,0 L-6,12 L0,8 L6,12 Z" fill={accent} opacity="0.8"/>
      </g>
      <g transform={`translate(${cx - outerR - 2}, ${cy}) rotate(-90)`}>
        <path d="M0,0 L-6,12 L0,8 L6,12 Z" fill={accent} opacity="0.8"/>
      </g>
      
      {/* Smaller diagonal points */}
      {[45, 135, 225, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = cx + (outerR + 1) * Math.cos(rad);
        const y = cy + (outerR + 1) * Math.sin(rad);
        return (
          <g key={angle} transform={`translate(${x}, ${y}) rotate(${angle + 90})`}>
            <path d="M0,0 L-4,8 L0,6 L4,8 Z" fill={color} opacity="0.6"/>
          </g>
        );
      })}
      
      {/* Hanging ring at top */}
      <g transform={`translate(${cx}, 8)`}>
        <circle cx="0" cy="0" r="10" stroke={color} strokeWidth="3" fill="none"/>
        <circle cx="0" cy="0" r="6" stroke={accent} strokeWidth="1" fill="none" opacity="0.5"/>
      </g>
    </svg>
  );
}

/* ── Frame 6: Rustic Timber Frame ── 
   Rough wooden beams with iron corner brackets,
   nail heads, and bark-like texture */
export function Frame6({ width = 280, height = 360, color = "#5c3317", accent = "#8b4513" }) {
  return (
    <svg width={width} height={height} viewBox="0 0 280 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer wood beams - slightly uneven */}
      {/* Top beam */}
      <path d="M0,0 L280,2 L278,22 L2,20 Z" fill={color} opacity="0.8" stroke={accent} strokeWidth="1"/>
      {/* Bottom beam */}
      <path d="M2,340 L278,338 L280,360 L0,358 Z" fill={color} opacity="0.8" stroke={accent} strokeWidth="1"/>
      {/* Left beam */}
      <path d="M0,0 L20,2 L22,358 L2,360 Z" fill={color} opacity="0.75" stroke={accent} strokeWidth="1"/>
      {/* Right beam */}
      <path d="M258,2 L280,0 L278,360 L260,358 Z" fill={color} opacity="0.75" stroke={accent} strokeWidth="1"/>
      
      {/* Wood grain lines */}
      <line x1="40" y1="5" x2="200" y2="6" stroke={accent} strokeWidth="0.5" opacity="0.4"/>
      <line x1="60" y1="12" x2="240" y2="13" stroke={accent} strokeWidth="0.5" opacity="0.3"/>
      <line x1="40" y1="345" x2="220" y2="344" stroke={accent} strokeWidth="0.5" opacity="0.4"/>
      <line x1="80" y1="352" x2="250" y2="351" stroke={accent} strokeWidth="0.5" opacity="0.3"/>
      <line x1="6" y1="40" x2="7" y2="300" stroke={accent} strokeWidth="0.5" opacity="0.4"/>
      <line x1="14" y1="60" x2="15" y2="320" stroke={accent} strokeWidth="0.5" opacity="0.3"/>
      <line x1="264" y1="30" x2="265" y2="310" stroke={accent} strokeWidth="0.5" opacity="0.4"/>
      <line x1="272" y1="50" x2="273" y2="280" stroke={accent} strokeWidth="0.5" opacity="0.3"/>
      
      {/* Iron corner brackets */}
      {/* Top-left */}
      <g>
        <path d="M5,5 L40,5 L40,12 L12,12 L12,40 L5,40 Z" fill="#3a3a3a" opacity="0.7"/>
        <path d="M8,8 L35,8 L35,10 L10,10 L10,35 L8,35 Z" fill="#555" opacity="0.4"/>
        <circle cx="25" cy="8" r="2.5" fill="#222"/>
        <circle cx="8" cy="25" r="2.5" fill="#222"/>
        <circle cx="25" cy="8" r="1" fill="#555" opacity="0.6"/>
        <circle cx="8" cy="25" r="1" fill="#555" opacity="0.6"/>
      </g>
      
      {/* Top-right */}
      <g transform="translate(280, 0) scale(-1, 1)">
        <path d="M5,5 L40,5 L40,12 L12,12 L12,40 L5,40 Z" fill="#3a3a3a" opacity="0.7"/>
        <path d="M8,8 L35,8 L35,10 L10,10 L10,35 L8,35 Z" fill="#555" opacity="0.4"/>
        <circle cx="25" cy="8" r="2.5" fill="#222"/>
        <circle cx="8" cy="25" r="2.5" fill="#222"/>
        <circle cx="25" cy="8" r="1" fill="#555" opacity="0.6"/>
        <circle cx="8" cy="25" r="1" fill="#555" opacity="0.6"/>
      </g>
      
      {/* Bottom-left */}
      <g transform="translate(0, 360) scale(1, -1)">
        <path d="M5,5 L40,5 L40,12 L12,12 L12,40 L5,40 Z" fill="#3a3a3a" opacity="0.7"/>
        <path d="M8,8 L35,8 L35,10 L10,10 L10,35 L8,35 Z" fill="#555" opacity="0.4"/>
        <circle cx="25" cy="8" r="2.5" fill="#222"/>
        <circle cx="8" cy="25" r="2.5" fill="#222"/>
      </g>
      
      {/* Bottom-right */}
      <g transform="translate(280, 360) scale(-1, -1)">
        <path d="M5,5 L40,5 L40,12 L12,12 L12,40 L5,40 Z" fill="#3a3a3a" opacity="0.7"/>
        <path d="M8,8 L35,8 L35,10 L10,10 L10,35 L8,35 Z" fill="#555" opacity="0.4"/>
        <circle cx="25" cy="8" r="2.5" fill="#222"/>
        <circle cx="8" cy="25" r="2.5" fill="#222"/>
      </g>
      
      {/* Nail heads along beams */}
      {[80, 140, 200].map((x) => (
        <React.Fragment key={`top-${x}`}>
          <circle cx={x} cy="10" r="2.5" fill="#2a2a2a"/>
          <circle cx={x} cy="10" r="1" fill="#555" opacity="0.5"/>
          <circle cx={x} cy="350" r="2.5" fill="#2a2a2a"/>
          <circle cx={x} cy="350" r="1" fill="#555" opacity="0.5"/>
        </React.Fragment>
      ))}
      {[100, 180, 260].map((y) => (
        <React.Fragment key={`side-${y}`}>
          <circle cx="10" cy={y} r="2.5" fill="#2a2a2a"/>
          <circle cx="10" cy={y} r="1" fill="#555" opacity="0.5"/>
          <circle cx="270" cy={y} r="2.5" fill="#2a2a2a"/>
          <circle cx="270" cy={y} r="1" fill="#555" opacity="0.5"/>
        </React.Fragment>
      ))}
      
      {/* Rope/twine hanging detail at top center */}
      <g transform="translate(140, 0)">
        <path d="M0,0 L0,-15 Q-5,-20 0,-25 Q5,-20 0,-15" stroke={accent} strokeWidth="2" fill="none"/>
        <circle cx="0" cy="-25" r="4" stroke={accent} strokeWidth="2" fill="none"/>
      </g>
    </svg>
  );
}

/* ── Material presets ── */
export const FRAME_MATERIALS = {
  gold:   { color: "#8b6914", accent: "#daa520" },
  bronze: { color: "#6b4423", accent: "#cd7f32" },
  silver: { color: "#556068", accent: "#a8a8a8" },
  iron:   { color: "#3a3a3a", accent: "#696969" },
  wood:   { color: "#5c3317", accent: "#8b4513" },
};

export const ALL_FRAMES = [Frame1, Frame2, Frame3, Frame4, Frame5, Frame6];
