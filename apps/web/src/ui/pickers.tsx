// ListPicker (searchable list), Select, DatePicker, ColorPicker, Calendar grid.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Popover } from './overlays.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { Button, cx, Kbd } from './primitives.tsx';
import { addDays, parseISODate, toISODate, todayISO } from '../../../../packages/shared/src/utils.ts';
import { DAYS_SHORT, MONTHS_LONG, formatDate } from '../lib/format.ts';

export interface PickerItem<V extends string = string> {
  value: V;
  label: string;
  icon?: ReactNode;
  description?: string;
  keywords?: string;
  shortcut?: string;
  section?: string;
  disabled?: boolean;
  right?: ReactNode;
}

export interface ListPickerProps<V extends string> {
  items: PickerItem<V>[];
  value?: V | V[] | null;
  onSelect: (value: V, item: PickerItem<V>) => void;
  multi?: boolean;
  searchable?: boolean;
  placeholder?: string;
  emptyText?: ReactNode;
  footer?: ReactNode;
  onCreate?: (query: string) => void;
  createLabel?: (query: string) => string;
  autoFocus?: boolean;
  className?: string;
  maxHeight?: number;
  query?: string;
  onQueryChange?: (q: string) => void;
  renderItem?: (item: PickerItem<V>, selected: boolean) => ReactNode;
  loading?: boolean;
}

/** A searchable, keyboard-navigable list. Used inside popovers and the command palette. */
export function ListPicker<V extends string>({ items, value, onSelect, multi, searchable = true, placeholder = 'Search…', emptyText = 'No results', footer, onCreate, createLabel, autoFocus = true, className, maxHeight = 320, query: extQuery, onQueryChange, renderItem, loading }: ListPickerProps<V>) {
  const [innerQuery, setInnerQuery] = useState('');
  const query = extQuery ?? innerQuery;
  const setQuery = (q: string) => {
    setInnerQuery(q);
    onQueryChange?.(q);
  };
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selected = new Set<string>(Array.isArray(value) ? value : value ? [value] : []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => (it.label + ' ' + (it.keywords || '') + ' ' + (it.description || '')).toLowerCase().includes(q));
  }, [items, query]);
  const showCreate = Boolean(onCreate && query.trim() && !filtered.some((i) => i.label.toLowerCase() === query.trim().toLowerCase()));
  const total = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => setActive(0), [query, items.length]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 0);
  }, [autoFocus]);

  const choose = (idx: number) => {
    if (idx < filtered.length) {
      const it = filtered[idx];
      if (it.disabled) return;
      onSelect(it.value, it);
      if (!multi) setQuery('');
    } else if (showCreate && onCreate) {
      onCreate(query.trim());
      setQuery('');
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (total ? (a + 1) % total : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (total ? (a - 1 + total) % total : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Home') {
      setActive(0);
    } else if (e.key === 'End') {
      setActive(Math.max(0, total - 1));
    }
  };

  // group by section preserving order
  const sections: { name: string | undefined; items: { item: PickerItem<V>; index: number }[] }[] = [];
  filtered.forEach((item, index) => {
    const last = sections[sections.length - 1];
    if (last && last.name === item.section) last.items.push({ item, index });
    else sections.push({ name: item.section, items: [{ item, index }] });
  });

  return (
    <div className={cx('picker', className)} onKeyDown={onKey}>
      {searchable ? (
        <div className="picker-search">
          <Icon name="search" size={14} className="muted" />
          <input ref={inputRef} className="picker-input" value={query} placeholder={placeholder} onChange={(e) => setQuery(e.target.value)} aria-label={placeholder} />
          {loading ? <Icon name="loader" size={14} className="spinner muted" /> : null}
        </div>
      ) : null}
      <div ref={listRef} className="picker-list" role="listbox" style={{ maxHeight }}>
        {sections.map((sec, si) => (
          <div key={si} className="picker-section">
            {sec.name ? <div className="picker-section-title">{sec.name}</div> : null}
            {sec.items.map(({ item, index }) => {
              const isSel = selected.has(item.value);
              return (
                <div key={item.value} role="option" aria-selected={isSel} data-index={index} className={cx('picker-item', active === index && 'is-active', isSel && 'is-selected', item.disabled && 'is-disabled')} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}>
                  {renderItem ? (
                    renderItem(item, isSel)
                  ) : (
                    <>
                      {multi ? <span className={cx('picker-check', isSel && 'is-checked')}>{isSel ? <Icon name="check" size={12} strokeWidth={3} /> : null}</span> : null}
                      {item.icon ? <span className="picker-icon">{item.icon}</span> : null}
                      <span className="picker-label">
                        <span className="truncate">{item.label}</span>
                        {item.description ? <span className="picker-desc truncate">{item.description}</span> : null}
                      </span>
                      {item.right ? <span className="picker-right">{item.right}</span> : null}
                      {item.shortcut ? <Kbd className="picker-shortcut">{item.shortcut}</Kbd> : null}
                      {!multi && isSel ? <Icon name="check" size={14} className="picker-selected-mark" /> : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {showCreate ? (
          <div role="option" data-index={filtered.length} className={cx('picker-item picker-create', active === filtered.length && 'is-active')} onMouseEnter={() => setActive(filtered.length)} onClick={() => choose(filtered.length)}>
            <Icon name="plus" size={14} className="picker-icon" />
            <span className="picker-label">{createLabel ? createLabel(query.trim()) : `Create "${query.trim()}"`}</span>
          </div>
        ) : null}
        {!total && !loading ? <div className="picker-empty">{emptyText}</div> : null}
      </div>
      {footer ? <div className="picker-footer">{footer}</div> : null}
    </div>
  );
}

/** Trigger + popover list. */
export function Select<V extends string>({ value, onChange, items, placeholder = 'Select…', size = 'md', variant = 'outline', className, searchable, width = 240, disabled, renderValue, align = 'start', icon, title }: { value: V | null; onChange: (v: V) => void; items: PickerItem<V>[]; placeholder?: string; size?: 'sm' | 'md'; variant?: 'outline' | 'ghost' | 'secondary'; className?: string; searchable?: boolean; width?: number; disabled?: boolean; renderValue?: (item: PickerItem<V> | undefined) => ReactNode; align?: 'start' | 'end'; icon?: IconName | string; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const current = items.find((i) => i.value === value);
  return (
    <>
      <Button ref={ref} size={size} variant={variant} className={cx('select-trigger', className)} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} icon={icon} iconRight="chevrons-updown" title={title}>
        {renderValue ? renderValue(current) : current ? (
          <span className="row gap-2">
            {current.icon ? <span className="picker-icon">{current.icon}</span> : null}
            <span className="truncate">{current.label}</span>
          </span>
        ) : (
          <span className="muted">{placeholder}</span>
        )}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={width} align={align} role="listbox">
        <ListPicker items={items} value={value} searchable={searchable ?? items.length > 7} onSelect={(v) => { onChange(v); setOpen(false); }} />
      </Popover>
    </>
  );
}

// ---- Calendar grid ----
export function CalendarGrid({ value, onChange, month, onMonthChange, startOfWeek = 1, min, max, rangeStart, rangeEnd }: { value: string | null; onChange: (d: string) => void; month?: { y: number; m: number }; onMonthChange?: (m: { y: number; m: number }) => void; startOfWeek?: 0 | 1; min?: string; max?: string; rangeStart?: string | null; rangeEnd?: string | null }) {
  const today = todayISO();
  const base = value ? parseISODate(value) : new Date();
  const [inner, setInner] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const cur = month ?? inner;
  const setMonth = (next: { y: number; m: number }) => {
    setInner(next);
    onMonthChange?.(next);
  };
  const first = new Date(cur.y, cur.m, 1);
  const offset = (first.getDay() - startOfWeek + 7) % 7;
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(cur.y, cur.m, d)));
  while (cells.length % 7) cells.push(null);
  const dayNames = [...DAYS_SHORT.slice(startOfWeek), ...DAYS_SHORT.slice(0, startOfWeek)];
  return (
    <div className="cal">
      <div className="cal-head">
        <Button size="sm" variant="ghost" icon="chevron-left" iconOnly onClick={() => setMonth(cur.m === 0 ? { y: cur.y - 1, m: 11 } : { y: cur.y, m: cur.m - 1 })}>Previous month</Button>
        <span className="cal-title">{MONTHS_LONG[cur.m]} {cur.y}</span>
        <Button size="sm" variant="ghost" icon="chevron-right" iconOnly onClick={() => setMonth(cur.m === 11 ? { y: cur.y + 1, m: 0 } : { y: cur.y, m: cur.m + 1 })}>Next month</Button>
      </div>
      <div className="cal-grid">
        {dayNames.map((d) => (
          <div key={d} className="cal-dow">{d[0]}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const disabled = (min && d < min) || (max && d > max);
          const inRange = rangeStart && rangeEnd && d > rangeStart && d < rangeEnd;
          return (
            <button key={d} type="button" disabled={Boolean(disabled)} className={cx('cal-day', d === value && 'is-selected', d === today && 'is-today', inRange && 'in-range', (d === rangeStart || d === rangeEnd) && 'is-range-end')} onClick={() => onChange(d)}>
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange, placeholder = 'Set date', size = 'sm', variant = 'outline', className, quick = true, clearable = true, icon = 'calendar', label, min, startOfWeek = 1, disabled }: { value: string | null; onChange: (d: string | null) => void; placeholder?: string; size?: 'sm' | 'md'; variant?: 'outline' | 'ghost' | 'secondary'; className?: string; quick?: boolean; clearable?: boolean; icon?: IconName | string | null; label?: ReactNode; min?: string; startOfWeek?: 0 | 1; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const today = todayISO();
  const quicks = [
    { label: 'Today', d: today },
    { label: 'Tomorrow', d: addDays(today, 1) },
    { label: 'Next week', d: addDays(today, 7) },
    { label: 'In 2 weeks', d: addDays(today, 14) },
  ];
  return (
    <>
      <Button ref={ref} size={size} variant={variant} icon={icon ?? undefined} className={cx('datepicker-trigger', className)} onClick={() => setOpen((o) => !o)} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}>
        {label ?? (value ? formatDate(value) : <span className="muted">{placeholder}</span>)}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} className="datepicker" width={quick ? 380 : 260}>
        <div className="row" style={{ alignItems: 'stretch' }}>
          {quick ? (
            <div className="datepicker-quick">
              {quicks.map((q) => (
                <button key={q.label} type="button" className={cx('datepicker-quick-item', value === q.d && 'is-active')} onClick={() => { onChange(q.d); setOpen(false); }}>
                  <span>{q.label}</span>
                  <span className="muted small">{DAYS_SHORT[parseISODate(q.d).getDay()]}</span>
                </button>
              ))}
              {clearable && value ? (
                <button type="button" className="datepicker-quick-item is-danger" onClick={() => { onChange(null); setOpen(false); }}>
                  <span>Clear date</span>
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="grow">
            <CalendarGrid value={value} startOfWeek={startOfWeek} min={min} onChange={(d) => { onChange(d); setOpen(false); }} />
            <div className="datepicker-input-row">
              <input className="input input-sm" type="date" value={value ?? ''} min={min} onChange={(e) => { if (e.target.value) { onChange(e.target.value); setOpen(false); } }} aria-label="Date" />
            </div>
          </div>
        </div>
      </Popover>
    </>
  );
}

export function ColorPicker({ value, onChange, colors, size = 22 }: { value: string; onChange: (c: string) => void; colors: string[]; size?: number }) {
  return (
    <div className="color-grid">
      {colors.map((c) => (
        <button key={c} type="button" className={cx('color-swatch', value === c && 'is-active')} style={{ background: c, width: size, height: size }} onClick={() => onChange(c)} aria-label={c} title={c}>
          {value === c ? <Icon name="check" size={12} strokeWidth={3} style={{ color: '#fff' }} /> : null}
        </button>
      ))}
      <label className="color-swatch color-custom" style={{ width: size, height: size }} title="Custom color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
        <Icon name="palette" size={12} />
      </label>
    </div>
  );
}
