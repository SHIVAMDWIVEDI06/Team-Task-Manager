// Core UI primitives: Button, Input, Textarea, Field, Checkbox, Switch, Segmented, Avatar, Badge, Kbd, Skeleton, Spinner, EmptyState, Progress.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { initials } from '../../../../packages/shared/src/utils.ts';

export function cx(...parts: unknown[]): string {
  return parts.filter((p) => typeof p === 'string' && p).join(' ');
}

// ---- Button ----
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName | string;
  iconRight?: IconName | string;
  loading?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
  active?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: CSSProperties;
  title?: string;
  children?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
  ref?: React.Ref<HTMLButtonElement>;
  [k: `data-${string}`]: unknown;
  [k: `aria-${string}`]: unknown;
}

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, loading, disabled, iconOnly, active, type = 'button', className, children, ...rest }: ButtonProps) {
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  return (
    <button type={type} className={cx('btn', `btn-${variant}`, `btn-${size}`, iconOnly && 'btn-icon', active && 'is-active', loading && 'is-loading', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner size={iconSize} /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children !== undefined && !iconOnly ? <span className="btn-label">{children}</span> : null}
      {iconOnly && children !== undefined ? (typeof children === 'string' ? <span className="sr-only">{children}</span> : <span className="btn-icon-content">{children}</span>) : null}
      {iconRight ? <Icon name={iconRight} size={iconSize} /> : null}
    </button>
  );
}

export function IconButton(props: Omit<ButtonProps, 'iconOnly'> & { label: string }) {
  const { label, variant = 'ghost', ...rest } = props;
  return (
    <Button iconOnly variant={variant} title={label} aria-label={label} {...rest}>
      {label}
    </Button>
  );
}

// ---- Inputs ----
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName | string;
  error?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}
export function Input({ size = 'md', icon, error, className, ...rest }: InputProps) {
  return (
    <div className={cx('input-wrap', icon && 'has-icon', error && 'is-error', `input-${size}`, className)}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} className="input-icon" /> : null}
      <input className="input" {...rest} />
    </div>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  autoResize?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
}
export function Textarea({ error, autoResize, className, ...rest }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!autoResize || !ref.current) return;
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${Math.min(500, el.scrollHeight)}px`;
  }, [autoResize, rest.value]);
  return <textarea ref={ref} className={cx('input textarea', error && 'is-error', className)} {...rest} />;
}

export function Field({ label, hint, error, children, htmlFor, className, required }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string; className?: string; required?: boolean }) {
  return (
    <div className={cx('field', error && 'has-error', className)}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="field-required">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <div className="field-error">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, disabled, indeterminate, className, size = 16 }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean; indeterminate?: boolean; className?: string; size?: number }) {
  return (
    <label className={cx('checkbox', disabled && 'is-disabled', className)} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={cx('checkbox-box', (checked || indeterminate) && 'is-checked')} style={{ width: size, height: size }}>
        {indeterminate && !checked ? <Icon name="minus" size={size - 4} strokeWidth={3} /> : checked ? <Icon name="check" size={size - 4} strokeWidth={3} /> : null}
      </span>
      {label ? <span className="checkbox-label">{label}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('switch-row', disabled && 'is-disabled')}>
      {label || description ? (
        <span className="switch-text">
          {label ? <span className="switch-label">{label}</span> : null}
          {description ? <span className="switch-desc">{description}</span> : null}
        </span>
      ) : null}
      <button type="button" role="switch" aria-checked={checked} className={cx('switch', checked && 'is-on')} disabled={disabled} onClick={() => onChange(!checked)}>
        <span className="switch-thumb" />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: IconName | string; title?: string }[]; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div className={cx('segmented', `segmented-${size}`, className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} title={o.title} className={cx('segmented-item', o.value === value && 'is-active')} onClick={() => onChange(o.value)}>
          {o.icon ? <Icon name={o.icon} size={size === 'sm' ? 13 : 15} /> : null}
          {o.label ? <span>{o.label}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ---- Avatar ----
const AVATAR_COLORS = ['#6b7cff', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#22c55e', '#f5a524', '#ef4444', '#06b6d4'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, src, size = 24, className, title, online, square }: { name: string; src?: string | null; size?: number; className?: string; title?: string; online?: boolean; square?: boolean }) {
  const [broken, setBroken] = useState(false);
  const style: CSSProperties = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)), borderRadius: square ? Math.round(size * 0.25) : '50%' };
  return (
    <span className={cx('avatar', className)} style={style} title={title ?? name}>
      {src && !broken ? <img src={src} alt={name} onError={() => setBroken(true)} style={{ borderRadius: 'inherit' }} /> : <span className="avatar-fallback" style={{ background: avatarColor(name), borderRadius: 'inherit' }}>{initials(name)}</span>}
      {online !== undefined ? <span className={cx('avatar-status', online && 'is-online')} /> : null}
    </span>
  );
}

export function AvatarStack({ users, size = 22, max = 4 }: { users: { id: string; name: string; avatarUrl?: string | null }[]; size?: number; max?: number }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="avatar-stack" style={{ ['--avatar-size' as string]: `${size}px` }}>
      {shown.map((u) => (
        <Avatar key={u.id} name={u.name} src={u.avatarUrl} size={size} />
      ))}
      {rest > 0 ? (
        <span className="avatar avatar-more" style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

// ---- Badges ----
export function Badge({ children, color, tone = 'neutral', size = 'md', dot, className, icon, onClick, title }: { children?: ReactNode; color?: string; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'; size?: 'sm' | 'md'; dot?: boolean; className?: string; icon?: IconName | string; onClick?: () => void; title?: string }) {
  const style: CSSProperties | undefined = color ? { ['--badge-color' as string]: color } : undefined;
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp type={onClick ? 'button' : undefined} className={cx('badge', `badge-${tone}`, `badge-${size}`, color && 'badge-colored', onClick && 'is-clickable', className)} style={style} onClick={onClick} title={title}>
      {dot ? <span className="badge-dot" /> : icon ? <Icon name={icon} size={size === 'sm' ? 11 : 13} /> : null}
      {children}
    </Comp>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx('kbd', className)}>{children}</kbd>;
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Icon name="loader" size={size} className={cx('spinner', className)} />;
}

export function Skeleton({ width, height = 14, className, radius, style }: { width?: number | string; height?: number | string; className?: string; radius?: number | string; style?: CSSProperties }) {
  return <span className={cx('skeleton', className)} style={{ width: width ?? '100%', height, borderRadius: radius ?? 6, ...style }} />;
}

export function EmptyState({ icon = 'inbox', title, description, action, className, compact }: { icon?: IconName | string; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cx('empty', compact && 'empty-compact', className)}>
      <div className="empty-icon">
        <Icon name={icon} size={compact ? 20 : 26} strokeWidth={1.5} />
      </div>
      <div className="empty-title">{title}</div>
      {description ? <div className="empty-desc">{description}</div> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Progress({ value, max = 100, color, height = 6, className, title }: { value: number; max?: number; color?: string; height?: number; className?: string; title?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cx('progress', className)} style={{ height }} title={title ?? `${pct}%`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Separator({ vertical, className }: { vertical?: boolean; className?: string }) {
  return <div className={cx(vertical ? 'sep-v' : 'sep-h', className)} role="separator" />;
}

export function Dot({ color, size = 8, className }: { color: string; size?: number; className?: string }) {
  return <span className={cx('dot', className)} style={{ width: size, height: size, background: color }} />;
}

export function PriorityIcon({ priority, size = 14 }: { priority: 0 | 1 | 2 | 3 | 4; size?: number }) {
  const bars = priority === 0 ? 0 : priority;
  const colors = ['var(--p-none)', 'var(--p-low)', 'var(--p-medium)', 'var(--p-high)', 'var(--p-urgent)'];
  const color = colors[priority];
  if (priority === 4) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <rect x="1" y="1" width="14" height="14" rx="3" fill={color} />
        <path d="M8 4v5M8 11.5v.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 4.5} y={11 - i * 3.5} width="3" height={4 + i * 3.5} rx="1" fill={i < bars ? color : 'currentColor'} opacity={i < bars ? 1 : 0.22} />
      ))}
    </svg>
  );
}

export function StatusIcon({ category, color, size = 14 }: { category: string; color: string; size?: number }) {
  const s = size;
  const r = s / 2 - 1.5;
  const c = s / 2;
  if (category === 'done') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
        <circle cx={c} cy={c} r={r} fill={color} />
        <path d={`M${c - r * 0.5} ${c} l${r * 0.35} ${r * 0.35} l${r * 0.65} -${r * 0.7}`} stroke="#fff" strokeWidth={s / 8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (category === 'cancelled') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
        <circle cx={c} cy={c} r={r} fill={color} />
        <path d={`M${c - r * 0.45} ${c - r * 0.45} l${r * 0.9} ${r * 0.9} M${c + r * 0.45} ${c - r * 0.45} l-${r * 0.9} ${r * 0.9}`} stroke="#fff" strokeWidth={s / 8} strokeLinecap="round" />
      </svg>
    );
  }
  if (category === 'in_progress') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={1.5} />
        <path d={`M${c} ${c - r + 1.2} A${r - 1.2} ${r - 1.2} 0 0 1 ${c} ${c + r - 1.2} Z`} fill={color} />
      </svg>
    );
  }
  if (category === 'backlog') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={`${(2 * Math.PI * r) / 8} ${(2 * Math.PI * r) / 8}`} />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
