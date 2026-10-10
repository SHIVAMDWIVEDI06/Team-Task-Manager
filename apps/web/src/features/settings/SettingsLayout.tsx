// Shared scaffolding for settings pages: left nav (desktop) / tabs (mobile), cards and label-left form rows.
import { useId, type ReactNode } from 'react';
import { useIsMobile } from '../../lib/hooks.ts';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { Tabs } from '../../ui/overlays.tsx';
import { cx } from '../../ui/primitives.tsx';
import './settings.css';

export interface SettingsTab<T extends string> {
  value: T;
  label: string;
  icon?: IconName | string;
  danger?: boolean;
}

export function SettingsLayout<T extends string>({ title, description, tabs, value, onChange, navTitle, actions, children }: { title: ReactNode; description?: ReactNode; tabs: SettingsTab<T>[]; value: T; onChange: (v: T) => void; navTitle?: string; actions?: ReactNode; children: ReactNode }) {
  const isMobile = useIsMobile();
  return (
    <div className="settings">
      {!isMobile ? (
        <nav className="settings-nav" aria-label="Settings sections">
          {navTitle ? <div className="settings-nav-title">{navTitle}</div> : null}
          {tabs.map((t) => (
            <button key={t.value} type="button" className={cx('settings-nav-item', t.value === value && 'is-active', t.danger && 'is-danger')} onClick={() => onChange(t.value)} aria-current={t.value === value ? 'page' : undefined}>
              {t.icon ? <Icon name={t.icon} size={15} /> : null}
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </nav>
      ) : null}
      <div className="settings-main">
        <div className="settings-heading">
          <div className="grow">
            <h1>{title}</h1>
            {description ? <div className="settings-heading-desc">{description}</div> : null}
          </div>
          {actions}
        </div>
        {isMobile ? (
          <div className="settings-mobile-tabs">
            <Tabs value={value} onChange={onChange} tabs={tabs.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))} size="sm" />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function SettingsCard({ title, description, children, footer, danger, actions, flush, padded, className, id }: { title?: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; danger?: boolean; actions?: ReactNode; flush?: boolean; padded?: boolean; className?: string; id?: string }) {
  return (
    <section className={cx('settings-card', danger && 'is-danger', className)} id={id} aria-label={typeof title === 'string' ? title : undefined}>
      {title ? (
        <header className="settings-card-head">
          <div className="grow">
            <h2 className="settings-card-title">{title}</h2>
            {description ? <p className="settings-card-desc">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={cx('settings-card-body', flush && 'is-flush', padded && 'is-padded')}>{children}</div>
      {footer ? <footer className="settings-card-foot">{footer}</footer> : null}
    </section>
  );
}

export function FormRow({ label, hint, error, children, htmlFor, center }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string; center?: boolean }) {
  const id = useId();
  return (
    <div className={cx('form-row', center && 'is-center')}>
      <label className="form-row-label" htmlFor={htmlFor} id={`${id}-label`}>
        {label}
        {hint ? <span className="form-row-hint">{hint}</span> : null}
      </label>
      <div className="form-row-control">
        {children}
        {error ? <div className="field-error">{error}</div> : null}
      </div>
    </div>
  );
}

export function DangerRow({ title, description, action }: { title: ReactNode; description?: ReactNode; action: ReactNode }) {
  return (
    <div className="danger-row">
      <div className="grow">
        <div className="danger-row-title">{title}</div>
        {description ? <div className="danger-row-desc">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function SettingsNotice({ children, warning, icon }: { children: ReactNode; warning?: boolean; icon?: IconName | string }) {
  return (
    <div className={cx('settings-notice', warning && 'is-warning')} role="note">
      <Icon name={icon ?? (warning ? 'alert-triangle' : 'info')} size={15} />
      <div className="grow">{children}</div>
    </div>
  );
}
