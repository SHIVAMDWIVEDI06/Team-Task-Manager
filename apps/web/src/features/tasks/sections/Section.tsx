// Shared building blocks for the task detail sections: a titled section with count + hover-revealed actions,
// a tiny context so every section knows the current task / permissions, and an authenticated attachment helper.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ProjectBundle, TaskDetail } from '../../../../../../packages/shared/src/types.ts';
import { RequestError, refreshAccessToken, tokenStore } from '../../../lib/api.ts';
import { toast } from '../../../lib/toast.ts';
import { Icon, type IconName } from '../../../ui/Icon.tsx';
import { cx } from '../../../ui/primitives.tsx';

export interface TaskCtx {
  task: TaskDetail;
  bundle: ProjectBundle | undefined;
  canEdit: boolean; // workspace-level edit right
  canManage: boolean; // admin or project lead
  meId: string;
  openTask: (key: string) => void;
}

const Ctx = createContext<TaskCtx | null>(null);
export const TaskCtxProvider = Ctx.Provider;
export function useTaskCtx(): TaskCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTaskCtx outside TaskDetail');
  return v;
}

export function Section({ id, icon, title, count, actions, children, className, hint }: { id?: string; icon?: IconName | string; title: ReactNode; count?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; hint?: ReactNode }) {
  return (
    <section id={id} className={cx('task-section', className)} aria-label={typeof title === 'string' ? title : undefined}>
      <header className="task-section-head">
        {icon ? <Icon name={icon} size={14} className="task-section-icon" /> : null}
        <span className="task-section-title">{title}</span>
        {count !== undefined && count !== null ? <span className="task-section-count tabular">{count}</span> : null}
        {hint ? <span className="task-section-hint xs muted">{hint}</span> : null}
        <span className="grow" />
        {actions ? <span className="task-section-actions">{actions}</span> : null}
      </header>
      {children}
    </section>
  );
}

// ---- Authenticated attachment access ----
// Attachment URLs require the bearer token, so <img src> / plain links cannot load them. We fetch the bytes once and
// hand out object URLs (cached per URL for the life of the page).
const blobCache = new Map<string, Promise<string>>();

async function authedFetch(url: string): Promise<Response> {
  const tok = tokenStore.get() ?? (await refreshAccessToken());
  const go = (t: string | null) => fetch(url, { headers: t ? { authorization: `Bearer ${t}` } : {}, credentials: 'include' });
  let res = await go(tok);
  if (res.status === 401) res = await go(await refreshAccessToken());
  return res;
}

export function fetchAttachmentBlobUrl(url: string): Promise<string> {
  let p = blobCache.get(url);
  if (!p) {
    p = authedFetch(url).then(async (res) => {
      if (!res.ok) throw new RequestError(res.status, 'error', res.status === 404 ? 'File not found' : 'Could not load the file');
      return URL.createObjectURL(await res.blob());
    });
    p.catch(() => blobCache.delete(url));
    blobCache.set(url, p);
  }
  return p;
}

/** Object URL for an authenticated attachment (null while loading / on failure). */
export function useAttachmentUrl(url: string | null): string | null {
  const [out, setOut] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setOut(null);
    if (!url) return;
    fetchAttachmentBlobUrl(url).then((u) => alive && setOut(u)).catch(() => alive && setOut(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return out;
}

export async function openAttachment(url: string) {
  // open the tab synchronously (popup blockers) and point it at the blob once fetched
  const w = window.open('', '_blank');
  try {
    const u = await fetchAttachmentBlobUrl(url);
    if (w) w.location.href = u;
    else window.open(u, '_blank');
  } catch (e) {
    w?.close();
    toast.fromError(e);
  }
}

export async function downloadAttachment(url: string, filename: string) {
  try {
    const u = await fetchAttachmentBlobUrl(url + (url.includes('?') ? '&' : '?') + 'download=1');
    const a = document.createElement('a');
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    toast.fromError(e);
  }
}

export const isImage = (mime: string) => mime.startsWith('image/');

export function fileIcon(mime: string, name: string): IconName {
  if (isImage(mime)) return 'image';
  if (/pdf|text|json|csv|markdown|word|document/.test(mime) || /\.(md|txt|docx?|pdf|csv|json)$/i.test(name)) return 'file-text';
  return 'file';
}
