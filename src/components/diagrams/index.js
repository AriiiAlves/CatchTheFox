/**
 * Diagramas do CatchTheFox (SVG gerado a partir de props).
 *
 * Ficam disponíveis em qualquer .md/.mdx sem import (veja src/theme/MDXComponents.js):
 *
 *   <Mem>    células de memória empilhadas (stack frames, chunks, payloads)
 *   <Chain>  listas encadeadas passo a passo (bins)
 *   <Flow>   caixas e setas em uma grade (fluxos como PLT/GOT)
 *   <Side>   coloca diagramas lado a lado
 *
 * Cores (`kind`): neutral, meta, data, ptr, ctrl, danger, free.
 * As cores vêm de variáveis CSS em src/css/custom.css e acompanham o tema claro/escuro.
 */
import React from 'react';

const ADV = 0.61; // largura de um caractere monoespaçado, em "em"
const len = (s) => (s == null ? 0 : String(s).length);
const tw = (s, fs) => len(s) * fs * ADV;

function Fig({title, width, height, children}) {
  return (
    <figure className="dg" style={{maxWidth: width}}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title || 'Diagrama'}>
        {children}
      </svg>
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
}

function Txt({x, y, w, text, max = 13, cls = 'dg-t', anchor = 'middle', bold}) {
  const fs = w ? Math.min(max, (w - 8) / (len(text) * ADV || 1)) : max;
  return (
    <text
      x={x}
      y={y}
      fontSize={fs}
      className={cls}
      textAnchor={anchor}
      dominantBaseline="central"
      fontWeight={bold ? 600 : 400}>
      {text}
    </text>
  );
}

/**
 * rows: [{addr, label, kind, note, h, cells: [{label, kind, w}]}, {gap: true}]
 * top/bottom: legendas acima/abaixo da coluna (ex: "endereços baixos").
 */
export function Mem({rows, title, top, bottom, cellW = 260, rowH = 30}) {
  const fs = 12.5;
  const a0 = Math.max(0, ...rows.map((r) => tw(r.addr, fs)));
  const aW = a0 ? a0 + 14 : 1;
  const n0 = Math.max(0, ...rows.map((r) => tw(r.note, fs) + (r.note ? tw('← ', fs) : 0)));
  const nW = n0 ? n0 + 14 : 1;
  const cap = 22;
  let y = top ? cap : 1;
  const out = [];
  rows.forEach((r, i) => {
    if (r.gap) {
      out.push(<Txt key={i} x={aW + cellW / 2} y={y + 10} text="⋮" cls="dg-m" max={15} />);
      y += 20;
      return;
    }
    const h = rowH * (r.h || 1);
    const cells = r.cells || [r];
    const total = cells.reduce((s, c) => s + (c.w || 1), 0);
    let x = aW;
    cells.forEach((c, j) => {
      const w = (cellW * (c.w || 1)) / total;
      out.push(
        <rect key={`${i}r${j}`} x={x} y={y} width={w} height={h} className={`dg-c dg-${c.kind || 'neutral'}`} />,
        <Txt key={`${i}t${j}`} x={x + w / 2} y={y + h / 2} w={w} text={c.label} />,
      );
      x += w;
    });
    // o endereço se refere ao primeiro byte da célula: alinhado ao topo em células altas
    if (r.addr) out.push(<Txt key={`${i}a`} x={aW - 8} y={y + Math.min(h, rowH) / 2} text={r.addr} cls="dg-m" max={fs} anchor="end" />);
    if (r.note)
      out.push(
        <Txt key={`${i}n`} x={aW + cellW + 8} y={y + h / 2} text={`← ${r.note}`} cls={r.hl ? 'dg-hl' : 'dg-m'} max={fs} anchor="start" />,
      );
    y += h;
  });
  const H = y + (bottom ? cap : 1);
  return (
    <Fig title={title} width={aW + cellW + nW} height={H}>
      {top && <Txt x={aW + cellW / 2} y={10} text={top} cls="dg-m" max={11.5} />}
      {out}
      {bottom && <Txt x={aW + cellW / 2} y={H - 9} text={bottom} cls="dg-m" max={11.5} />}
    </Fig>
  );
}

function Arrow({x1, y1, x2, y2, both, dashed}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = (x, y, ang) => {
    const s = 6;
    const p = (d, off) => `${x - s * Math.cos(ang + off) * d},${y - s * Math.sin(ang + off) * d}`;
    return <polygon className="dg-head" points={`${x},${y} ${p(1.5, 0.45)} ${p(1.5, -0.45)}`} />;
  };
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="dg-line" strokeDasharray={dashed ? '4 3' : undefined} />
      {head(x2, y2, a)}
      {both && head(x1, y1, a + Math.PI)}
    </g>
  );
}

/**
 * steps: [{label, nodes: ['a', {t: 'alvo', kind: 'ctrl'}], note, head, tail}]
 * head/tail: nós fixos no início/fim de cada linha (null para omitir).
 * double: setas nos dois sentidos (lista duplamente encadeada).
 */
export function Chain({steps, head = 'HEAD', tail = 'NULL', double = false, title}) {
  const fs = 13;
  const lfs = 12.5;
  const nodeH = 28;
  const pitch = 40;
  const gap = 30;
  const norm = (n, kind) => (typeof n === 'string' ? {t: n, kind} : {kind, ...n});
  const l0 = Math.max(0, ...steps.map((s) => tw(s.label, lfs)));
  const lW = l0 ? l0 + 16 : 1;
  let W = 0;
  const lines = steps.map((s) => {
    const h = s.head === undefined ? head : s.head;
    const t = s.tail === undefined ? tail : s.tail;
    const nodes = [];
    if (h) nodes.push(norm(h, 'meta'));
    (s.nodes || []).forEach((n) => nodes.push(norm(n, 'data')));
    if (t) nodes.push(norm(t, 'neutral'));
    let x = lW;
    const pos = nodes.map((n) => {
      const w = Math.max(44, tw(n.t, fs) + 20);
      const p = {...n, x, w};
      x += w + gap;
      return p;
    });
    const end = x - gap;
    W = Math.max(W, end + (s.note ? 14 + tw(s.note, lfs) : 0));
    return {s, pos, end};
  });
  return (
    <Fig title={title} width={W + 2} height={steps.length * pitch - (pitch - nodeH) + 2}>
      {lines.map(({s, pos, end}, i) => {
        const y = 1 + i * pitch;
        const cy = y + nodeH / 2;
        return (
          <g key={i}>
            {s.label && <Txt x={0} y={cy} text={s.label} cls="dg-m" max={lfs} anchor="start" />}
            {pos.map((n, j) => (
              <g key={j}>
                <rect x={n.x} y={y} width={n.w} height={nodeH} rx={4} className={`dg-c dg-${n.kind}`} />
                <Txt x={n.x + n.w / 2} y={cy} text={n.t} max={fs} />
                {j > 0 && (
                  <Arrow x1={pos[j - 1].x + pos[j - 1].w + 3} y1={cy} x2={n.x - 3} y2={cy} both={double} />
                )}
              </g>
            ))}
            {s.note && <Txt x={end + 14} y={cy} text={s.note} cls="dg-m" max={lfs} anchor="start" />}
          </g>
        );
      })}
    </Fig>
  );
}

/**
 * nodes: [{id, x, y, t, sub, kind, w}]  (x, y em células da grade; podem ser fracionários)
 * edges: [{from, to, label, dashed, bend, both}]
 */
export function Flow({nodes, edges = [], title, cw = 220, ch = 86, nw = 184, nh = 46}) {
  const pad = 4;
  const N = {};
  nodes.forEach((n) => {
    const w = n.w || nw;
    N[n.id] = {...n, w, cx: pad + n.x * cw + nw / 2, cy: pad + n.y * ch + nh / 2};
  });
  const W = Math.max(...Object.values(N).map((n) => n.cx + n.w / 2)) + pad;
  const H = Math.max(...Object.values(N).map((n) => n.cy + nh / 2)) + pad;
  const clip = (n, tx, ty) => {
    const dx = tx - n.cx;
    const dy = ty - n.cy;
    const s = Math.min(dx ? (n.w / 2 + 3) / Math.abs(dx) : Infinity, dy ? (nh / 2 + 3) / Math.abs(dy) : Infinity);
    return [n.cx + dx * s, n.cy + dy * s];
  };
  return (
    <Fig title={title} width={W} height={H}>
      {edges.map((e, i) => {
        const a = N[e.from];
        const b = N[e.to];
        const mx = (a.cx + b.cx) / 2;
        const my = (a.cy + b.cy) / 2;
        const d = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1;
        const bend = e.bend || 0;
        const cx = mx - ((b.cy - a.cy) / d) * bend;
        const cy = my + ((b.cx - a.cx) / d) * bend;
        const [x1, y1] = clip(a, cx, cy);
        const [x2, y2] = clip(b, cx, cy);
        const ang = Math.atan2(y2 - cy, x2 - cx) || Math.atan2(y2 - y1, x2 - x1);
        const hd = (x, y, an) => {
          const p = (off) => `${x - 9 * Math.cos(an + off)},${y - 9 * Math.sin(an + off)}`;
          return <polygon className="dg-head" points={`${x},${y} ${p(0.45)} ${p(-0.45)}`} />;
        };
        const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
        const ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
        const lw = tw(e.label, 11.5) + 8;
        return (
          <g key={i}>
            <path
              d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
              className="dg-line"
              strokeDasharray={e.dashed ? '4 3' : undefined}
            />
            {hd(x2, y2, ang)}
            {e.both && hd(x1, y1, Math.atan2(y1 - cy, x1 - cx))}
            {e.label && (
              <g>
                <rect x={lx - lw / 2} y={ly - 9} width={lw} height={18} className="dg-bg" />
                <Txt x={lx} y={ly} text={e.label} cls={e.hl ? 'dg-hl' : 'dg-m'} max={11.5} />
              </g>
            )}
          </g>
        );
      })}
      {Object.values(N).map((n) => (
        <g key={n.id}>
          <rect x={n.cx - n.w / 2} y={n.cy - nh / 2} width={n.w} height={nh} rx={5} className={`dg-c dg-${n.kind || 'neutral'}`} />
          <Txt x={n.cx} y={n.sub ? n.cy - 8 : n.cy} w={n.w} text={n.t} bold />
          {n.sub && <Txt x={n.cx} y={n.cy + 10} w={n.w} text={n.sub} cls="dg-m" max={11} />}
        </g>
      ))}
    </Fig>
  );
}

export function Side({children}) {
  return <div className="dg-side">{children}</div>;
}
