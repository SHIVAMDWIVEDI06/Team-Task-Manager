// Hand-written SVG charts for the dashboard: grouped columns (throughput), donut (status), horizontal bars (priority).
// Responsive: the container width is measured with ResizeObserver and the SVG is drawn at pixel size (crisp text).
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../ui/primitives.tsx';

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Clean axis ticks: 0 … max rounded to a nice number, `count` steps. */
function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function ChartTooltip({ x, y, children, align = 'center' }: { x: number; y: number; children: ReactNode; align?: 'center' | 'left' | 'right' }) {
  return (
    <div className={cx('chart-tip', `chart-tip-${align}`)} style={{ left: x, top: y }} role="status">
      {children}
    </div>
  );
}

// ---- Throughput: created vs completed per day (grouped columns) ----
export interface ThroughputPoint {
  date: string;
  created: number;
  completed: number;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function shortDate(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
function longDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]}, ${MONTHS[m - 1]} ${d}`;
}

export function ThroughputChart({ data, height = 190 }: { data: ThroughputPoint[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 8, bottom: 26, left: 30 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => Math.max(d.created, d.completed)));
  const ticks = niceTicks(max, 3);
  const top = ticks[ticks.length - 1];
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(3, Math.min(14, (slot - 8) / 2));
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const totals = useMemo(() => data.reduce((a, d) => ({ created: a.created + d.created, completed: a.completed + d.completed }), { created: 0, completed: 0 }), [data]);
  const labelEvery = slot < 36 ? 3 : slot < 52 ? 2 : 1;

  return (
    <div className="chart chart-throughput">
      <div className="chart-legend">
        <span className="chart-legend-item"><span className="chart-swatch" style={{ background: 'var(--brand)' }} />Created <span className="tabular muted">{totals.created}</span></span>
        <span className="chart-legend-item"><span className="chart-swatch" style={{ background: 'var(--success)' }} />Completed <span className="tabular muted">{totals.completed}</span></span>
      </div>
      <div ref={ref} className="chart-plot" style={{ height }} onMouseLeave={() => setHover(null)}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={`Tasks created and completed per day for the last ${data.length} days`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="chart-grid" />
                <text x={pad.left - 8} y={y(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">{t}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx0 = pad.left + slot * i + slot / 2;
              const hovered = hover === i;
              const showLabel = (data.length - 1 - i) % labelEvery === 0; // anchored to today so the last label always shows
              const created = Math.max(0, y(d.created));
              const completed = Math.max(0, y(d.completed));
              const base = y(0);
              return (
                <g key={d.date} className={cx('chart-col', hovered && 'is-hover')} onMouseEnter={() => setHover(i)}>
                  <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="transparent" />
                  {hovered ? <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} className="chart-col-bg" rx={4} /> : null}
                  <path d={roundedTop(cx0 - barW - 1, created, barW, base - created, 3)} fill="var(--brand)" opacity={d.created ? 1 : 0} />
                  <path d={roundedTop(cx0 + 1, completed, barW, base - completed, 3)} fill="var(--success)" opacity={d.completed ? 1 : 0} />
                  {!d.created && !d.completed ? <rect x={cx0 - barW - 1} y={base - 2} width={barW * 2 + 2} height={2} rx={1} className="chart-zero" /> : null}
                  {showLabel ? (
                    <text x={cx0} y={height - 8} className="chart-tick" textAnchor="middle">{shortDate(d.date)}</text>
                  ) : null}
                </g>
              );
            })}
            <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="chart-axis" />
          </svg>
        ) : null}
        {hover !== null && data[hover] ? (
          <ChartTooltip x={pad.left + slot * hover + slot / 2} y={pad.top} align={hover > data.length * 0.7 ? 'right' : hover < data.length * 0.3 ? 'left' : 'center'}>
            <div className="chart-tip-title">{longDate(data[hover].date)}</div>
            <div className="chart-tip-row"><span className="chart-swatch" style={{ background: 'var(--brand)' }} />Created<b className="tabular">{data[hover].created}</b></div>
            <div className="chart-tip-row"><span className="chart-swatch" style={{ background: 'var(--success)' }} />Completed<b className="tabular">{data[hover].completed}</b></div>
          </ChartTooltip>
        ) : null}
      </div>
    </div>
  );
}

/** Rect path with rounded top corners only (square at the baseline). */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x} ${y + h} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h} Z`;
}

// ---- Donut ----
export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ segments, size = 150, thickness = 18, centerLabel, centerValue, onSelect }: { segments: DonutSegment[]; size?: number; thickness?: number; centerLabel?: string; centerValue?: ReactNode; onSelect?: (key: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = size / 2 - thickness / 2 - 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2.5 : 0; // px surface gap between arcs
  let offset = 0;
  const active = hover ? segments.find((s) => s.key === hover) : null;
  return (
    <div className="chart chart-donut">
      <div className="chart-donut-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`${centerLabel ?? 'Total'}: ${total}`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
          {total > 0
            ? segments
                .filter((s) => s.value > 0)
                .map((s) => {
                  const len = (s.value / total) * circumference;
                  const dash = Math.max(0, len - gap);
                  const el = (
                    <circle
                      key={s.key}
                      cx={c}
                      cy={c}
                      r={r}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={hover === s.key ? thickness + 4 : thickness}
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={-offset - gap / 2}
                      transform={`rotate(-90 ${c} ${c})`}
                      className={cx('chart-arc', hover && hover !== s.key && 'is-dim', onSelect && 'is-clickable')}
                      onMouseEnter={() => setHover(s.key)}
                      onMouseLeave={() => setHover(null)}
                      onClick={onSelect ? () => onSelect(s.key) : undefined}
                    />
                  );
                  offset += len;
                  return el;
                })
            : null}
        </svg>
        <div className="chart-donut-center">
          <div className="chart-donut-value">{active ? active.value : centerValue ?? total}</div>
          <div className="chart-donut-label">{active ? active.label : centerLabel ?? 'Total'}</div>
        </div>
      </div>
      <ul className="chart-donut-legend" role="list">
        {segments.map((s) => (
          <li key={s.key} className={cx('chart-donut-legend-item', hover === s.key && 'is-hover', onSelect && 'is-clickable')} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)} onClick={onSelect ? () => onSelect(s.key) : undefined}>
            <span className="chart-swatch" style={{ background: s.color }} />
            <span className="chart-donut-legend-label truncate">{s.label}</span>
            <span className="tabular chart-donut-legend-value">{s.value}</span>
            <span className="tabular xs muted chart-donut-legend-pct">{total ? `${Math.round((s.value / total) * 100)}%` : '–'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Horizontal bars ----
export interface HBarRow {
  key: string;
  label: ReactNode;
  value: number;
  color: string;
  title?: string;
}

export function HBarChart({ rows, onSelect, max: maxProp }: { rows: HBarRow[]; onSelect?: (key: string) => void; max?: number }) {
  const max = Math.max(1, maxProp ?? Math.max(0, ...rows.map((r) => r.value)));
  return (
    <div className="chart chart-hbars" role="list">
      {rows.map((r) => {
        const pct = Math.max(0, Math.min(100, (r.value / max) * 100));
        return (
          <div key={r.key} className={cx('chart-hbar', onSelect && 'is-clickable')} role="listitem" title={r.title} onClick={onSelect ? () => onSelect(r.key) : undefined}>
            <span className="chart-hbar-label">{r.label}</span>
            <span className="chart-hbar-track">
              <span className="chart-hbar-fill" style={{ width: `${pct}%`, background: r.color, opacity: r.value ? 1 : 0 }} />
            </span>
            <span className="chart-hbar-value tabular">{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Tiny sparkline for stat tiles ----
export function Sparkline({ values, color = 'var(--brand)', width = 64, height = 20 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} className="chart-sparkline" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(values.length - 1) * step} cy={height - 2 - (values[values.length - 1] / max) * (height - 4)} r={2.5} fill={color} />
    </svg>
  );
}
