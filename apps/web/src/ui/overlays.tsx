// Popover, Menu, Tooltip, Dialog, confirm(), Toaster.
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFloating, type FloatingOptions } from './floating.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { Button, cx, Kbd } from './primitives.tsx';
import { toastStore, dismiss, type Toast } from '../lib/toast.ts';

// ---- Layer stack: lets nested overlays close in order on Escape / outside click ----
const layerStack: { id: string; close: () => void; el: () => HTMLElement | null }[] = [];
function pushLayer(id: string, close: () => void, el: () => HTMLElement | null) {
  layerStack.push({ id, close, el });
  return () => {
    const i = layerStack.findIndex((l) => l.id === id);
    if (i !== -1) layerStack.splice(i, 1);
  };
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !layerStack.length) return;
    const top = layerStack[layerStack.length - 1];
    e.stopPropagation();
    top.close();
  });
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!layerStack.length) return;
      const target = e.target as Node;
      // close every popover/menu above the one that contains the click
      for (let i = layerStack.length - 1; i >= 0; i--) {
        const l = layerStack[i];
        const el = l.el();
        if (el && el.contains(target)) break;
        if (el?.dataset.modal === 'true') break; // dialogs don't close on outside click
        l.close();
      }
    },
    true,
  );
}

// ---- Popover ----
export interface PopoverProps extends FloatingOptions {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  anchorRect?: DOMRect | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  width?: number | string;
  autoFocus?: boolean;
  role?: string;
}

export function Popover({ open, onClose, anchorRef, anchorRect, children, className, style, width, autoFocus = true, role = 'dialog', ...floating }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const pos = useFloating(anchorRef, panelRef, open, floating, anchorRect);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const unregister = pushLayer(id, () => onCloseRef.current(), () => panelRef.current);
    // Also treat the anchor as "inside"
    const anchorEl = anchorRef.current;
    const onDown = (e: PointerEvent) => {
      if (anchorEl && anchorEl.contains(e.target as Node)) e.stopPropagation();
    };
    anchorEl?.addEventListener('pointerdown', onDown, true);
    return () => {
      unregister();
      anchorEl?.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, id, anchorRef]);
  useEffect(() => {
    if (open && autoFocus && panelRef.current) {
      const first = panelRef.current.querySelector<HTMLElement>('input, [tabindex="0"], button');
      (first || panelRef.current).focus({ preventScroll: true });
    }
  }, [open, autoFocus]);
  if (!open) return null;
  return createPortal(
    <div ref={panelRef} role={role} tabIndex={-1} className={cx('popover', className)} data-placement={pos?.placement} style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: width ?? pos?.width, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden', ...style }}>
      {children}
    </div>,
    document.body,
  );
}

// ---- Menu ----
export interface MenuItem {
  key?: string;
  label: ReactNode;
  icon?: IconName | string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  onSelect?: () => void;
  separator?: boolean;
  submenu?: MenuItem[];
  description?: string;
}

export function Menu({ open, onClose, anchorRef, anchorRect, items, placement = 'bottom', align = 'start', width, header }: { open: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLElement | null>; anchorRect?: DOMRect | null; items: MenuItem[]; placement?: FloatingOptions['placement']; align?: FloatingOptions['align']; width?: number; header?: ReactNode }) {
  const [active, setActive] = useState(-1);
  const enabled = items.map((it, i) => (!it.separator && !it.disabled ? i : -1)).filter((i) => i >= 0);
  useEffect(() => {
    if (open) setActive(-1);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = enabled.indexOf(active);
      const next = e.key === 'ArrowDown' ? enabled[(idx + 1) % enabled.length] : enabled[(idx - 1 + enabled.length) % enabled.length];
      setActive(next ?? -1);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      items[active].onSelect?.();
      onClose();
    }
  };
  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} anchorRect={anchorRect} placement={placement} align={align} width={width} role="menu" className="menu">
      <div onKeyDown={onKey} tabIndex={0} className="menu-list" style={{ outline: 'none' }}>
        {header ? <div className="menu-header">{header}</div> : null}
        {items.map((it, i) =>
          it.separator ? (
            <div key={it.key ?? i} className="menu-sep" />
          ) : (
            <button
              key={it.key ?? i}
              type="button"
              role="menuitem"
              className={cx('menu-item', it.danger && 'is-danger', it.disabled && 'is-disabled', active === i && 'is-active')}
              disabled={it.disabled}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                if (it.disabled) return;
                it.onSelect?.();
                onClose();
              }}
            >
              {it.checked !== undefined ? <span className="menu-check">{it.checked ? <Icon name="check" size={14} /> : null}</span> : it.icon ? <Icon name={it.icon} size={15} className="menu-icon" /> : null}
              <span className="menu-label">
                {it.label}
                {it.description ? <span className="menu-desc">{it.description}</span> : null}
              </span>
              {it.shortcut ? <Kbd className="menu-shortcut">{it.shortcut}</Kbd> : null}
            </button>
          ),
        )}
      </div>
    </Popover>
  );
}

/** Convenience: a trigger button with a menu. */
export function MenuButton({ items, label = 'More', icon = 'more-h', size = 'sm', variant = 'ghost', align = 'end', children, className, header }: { items: MenuItem[]; label?: string; icon?: IconName | string; size?: 'sm' | 'md'; variant?: 'ghost' | 'secondary' | 'outline'; align?: 'start' | 'end'; children?: ReactNode; className?: string; header?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <Button ref={ref} size={size} variant={variant} icon={children ? icon : undefined} iconOnly={!children} title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open} className={className} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} iconRight={children ? 'chevron-down' : undefined}>
        {children ?? label}
      </Button>
      <Menu open={open} onClose={() => setOpen(false)} anchorRef={ref} items={items} align={align} header={header} />
    </>
  );
}

// ---- Tooltip ----
export function Tooltip({ content, children, placement = 'top', delay = 400, shortcut }: { content: ReactNode; children: ReactNode; placement?: FloatingOptions['placement']; delay?: number; shortcut?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);
  const pos = useFloating(ref, panelRef, open, { placement, align: 'center', offset: 6 });
  const show = () => {
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  };
  if (!content) return <>{children}</>;
  return (
    <span ref={ref} className="tooltip-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onPointerDown={hide}>
      {children}
      {open &&
        createPortal(
          <div ref={panelRef} role="tooltip" className="tooltip" style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}>
            {content}
            {shortcut ? <Kbd className="tooltip-kbd">{shortcut}</Kbd> : null}
          </div>,
          document.body,
        )}
    </span>
  );
}

// ---- Dialog ----
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', className, hideClose, initialFocus }: { open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; className?: string; hideClose?: boolean; initialFocus?: React.RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const unregister = pushLayer(id, () => onCloseRef.current(), () => ref.current);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const target = initialFocus?.current || ref.current?.querySelector<HTMLElement>('[data-autofocus]') || ref.current?.querySelector<HTMLElement>(FOCUSABLE) || ref.current;
      target?.focus({ preventScroll: true });
    }, 10);
    return () => {
      unregister();
      clearTimeout(t);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, id, initialFocus]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const nodes = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  if (!open) return null;
  return createPortal(
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={title ? `${id}-title` : undefined} data-modal="true" tabIndex={-1} className={cx('dialog', `dialog-${size}`, className)} onKeyDown={onKeyDown}>
        {title || !hideClose ? (
          <div className="dialog-header">
            <div>
              {title ? (
                <h2 id={`${id}-title`} className="dialog-title">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="dialog-desc">{description}</p> : null}
            </div>
            {!hideClose ? <Button variant="ghost" size="sm" icon="x" iconOnly onClick={onClose} aria-label="Close">Close</Button> : null}
          </div>
        ) : null}
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

// ---- confirm() ----
interface ConfirmState {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}
const ConfirmCtx = createContext<((opts: Omit<ConfirmState, 'resolve'>) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const confirm = useCallback((opts: Omit<ConfirmState, 'resolve'>) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })), []);
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        hideClose
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {state?.cancelLabel || 'Cancel'}
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
              {state?.confirmLabel || 'Confirm'}
            </Button>
          </>
        }
      >
        {state?.description ? <p className="secondary">{state.description}</p> : null}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('useConfirm outside ConfirmProvider');
  return c;
}

// ---- Toaster ----
export function Toaster() {
  const { toasts } = toastStore.use();
  return createPortal(
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const icon: IconName = t.kind === 'success' ? 'circle-check' : t.kind === 'error' ? 'alert-circle' : 'info';
  return (
    <div className={cx('toast', `toast-${t.kind}`)} role="status">
      <Icon name={icon} size={16} className="toast-icon" />
      <div className="toast-body">
        <div className="toast-title">{t.title}</div>
        {t.description ? <div className="toast-desc">{t.description}</div> : null}
      </div>
      {t.action ? (
        <Button size="sm" variant="ghost" onClick={() => { t.action!.onClick(); dismiss(t.id); }}>
          {t.action.label}
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" icon="x" iconOnly onClick={() => dismiss(t.id)} aria-label="Dismiss">Dismiss</Button>
    </div>
  );
}

// ---- Tabs ----
export function Tabs<T extends string>({ value, onChange, tabs, className, size = 'md' }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; icon?: IconName | string; count?: number }[]; className?: string; size?: 'sm' | 'md' }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const i = tabs.findIndex((t) => t.value === value);
    const el = refs.current[i];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, tabs]);
  return (
    <div className={cx('tabs', `tabs-${size}`, className)} role="tablist">
      {tabs.map((t, i) => (
        <button key={t.value} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={t.value === value} className={cx('tab', t.value === value && 'is-active')} onClick={() => onChange(t.value)}>
          {t.icon ? <Icon name={t.icon} size={size === 'sm' ? 13 : 15} /> : null}
          <span>{t.label}</span>
          {t.count !== undefined ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
      {indicator ? <span className="tabs-indicator" style={{ left: indicator.left, width: indicator.width }} /> : null}
    </div>
  );
}
