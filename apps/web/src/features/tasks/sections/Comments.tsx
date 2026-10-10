// Comments: list with inline edit / delete, a sticky composer with mentions + file uploads, typing indicator.
import { useEffect, useRef, useState } from 'react';
import type { Comment } from '../../../../../../packages/shared/src/types.ts';
import { keys, taskApi } from '../../../app/data.ts';
import type { QueryResult } from '../../../lib/query.ts';
import { setQueryData } from '../../../lib/query.ts';
import { onRealtime } from '../../../lib/realtime.ts';
import { toast } from '../../../lib/toast.ts';
import { useInterval } from '../../../lib/hooks.ts';
import { formatDateTime, relativeTime } from '../../../lib/format.ts';
import { Avatar, Button, EmptyState, Skeleton, cx } from '../../../ui/primitives.tsx';
import { Tooltip, useConfirm } from '../../../ui/overlays.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { Editor, EditorHint, MarkdownView } from '../Editor.tsx';
import { useUploader } from './Attachments.tsx';
import { useTaskCtx } from './Section.tsx';

const draftKey = (id: string) => `tt.comment.draft.${id}`;
const readDraft = (id: string) => {
  try {
    return localStorage.getItem(draftKey(id)) ?? '';
  } catch {
    return '';
  }
};
const writeDraft = (id: string, v: string) => {
  try {
    if (v) localStorage.setItem(draftKey(id), v);
    else localStorage.removeItem(draftKey(id));
  } catch {
    /* ignore */
  }
};

function CommentItem({ c, mine, canDelete, onEdit, onDelete }: { c: Comment; mine: boolean; canDelete: boolean; onEdit: (body: string) => Promise<void>; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(c.body);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const b = body.trim();
    if (!b || saving) return;
    setSaving(true);
    try {
      if (b !== c.body) await onEdit(b);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  return (
    <article className={cx('task-comment', editing && 'is-editing')} id={`comment-${c.id}`}>
      <Avatar name={c.author.name} src={c.author.avatarUrl} size={28} className="task-comment-avatar" />
      <div className="task-comment-main">
        <div className="task-comment-head">
          <span className="task-comment-author">{c.author.name}</span>
          <Tooltip content={formatDateTime(c.createdAt)}><span className="xs muted">{relativeTime(c.createdAt)}</span></Tooltip>
          {c.editedAt ? <Tooltip content={`Edited ${formatDateTime(c.editedAt)}`}><span className="xs faint">(edited)</span></Tooltip> : null}
          <span className="grow" />
          {!editing && (mine || canDelete) ? (
            <span className="task-row-actions">
              {mine ? <Button size="sm" variant="ghost" icon="pencil" iconOnly onClick={() => { setBody(c.body); setEditing(true); }} aria-label="Edit comment">Edit</Button> : null}
              {canDelete ? <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={onDelete} aria-label="Delete comment">Delete</Button> : null}
            </span>
          ) : null}
        </div>
        {editing ? (
          <div className="task-comment-edit">
            <Editor value={body} onChange={setBody} compact autoFocus minRows={2} onSubmit={() => void save()} onCancel={() => setEditing(false)} toolbar={false} />
            <div className="row between mt-2">
              <EditorHint />
              <span className="row gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" variant="primary" loading={saving} disabled={!body.trim()} onClick={() => void save()}>Save</Button>
              </span>
            </div>
          </div>
        ) : (
          <MarkdownView source={c.body} className="task-comment-body" />
        )}
      </div>
    </article>
  );
}

export function Comments({ comments }: { comments: QueryResult<Comment[]> }) {
  const { task, canEdit, canManage, meId } = useTaskCtx();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(() => readDraft(task.id));
  const [posting, setPosting] = useState(false);
  const { upload, uploading } = useUploader(task.id);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastTyping = useRef(0);
  const [typers, setTypers] = useState<Record<string, { name: string; until: number }>>({});

  // typing indicator from others
  useEffect(
    () =>
      onRealtime('typing', (e) => {
        if (e.type !== 'typing' || e.taskId !== task.id || e.userId === meId) return;
        setTypers((p) => ({ ...p, [e.userId]: { name: e.name, until: Date.now() + 4000 } }));
      }),
    [task.id, meId],
  );
  useInterval(() => {
    const now = Date.now();
    setTypers((p) => {
      const kept = Object.entries(p).filter(([, v]) => v.until > now);
      return kept.length === Object.keys(p).length ? p : Object.fromEntries(kept);
    });
  }, Object.keys(typers).length ? 1000 : null);
  const typingNames = Object.values(typers).map((t) => t.name.split(' ')[0]);

  const onTyping = () => {
    const now = Date.now();
    if (now - lastTyping.current > 3000) {
      lastTyping.current = now;
      void taskApi.typing(task.id);
    }
  };
  const change = (v: string) => {
    setDraft(v);
    writeDraft(task.id, v);
  };

  const list = comments.data ?? [];
  // scroll a newly arrived comment into view (not on the initial load)
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (!comments.data) return;
    if (prevCount.current !== null && list.length > prevCount.current) listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    prevCount.current = list.length;
  }, [list.length, comments.data]);

  const post = async () => {
    const b = draft.trim();
    if (!b || posting) return;
    setPosting(true);
    try {
      const c = await taskApi.addComment(task.id, b);
      setQueryData<Comment[]>(keys.comments(task.id), (p) => (p ? (p.some((x) => x.id === c.id) ? p : [...p, c]) : [c]));
      change('');
    } catch (e) {
      toast.fromError(e);
    } finally {
      setPosting(false);
    }
  };
  const edit = async (c: Comment, body: string) => {
    const before = c.body;
    setQueryData<Comment[]>(keys.comments(task.id), (p) => (p ? p.map((x) => (x.id === c.id ? { ...x, body } : x)) : p));
    try {
      const updated = await taskApi.updateComment(c.id, body);
      setQueryData<Comment[]>(keys.comments(task.id), (p) => (p ? p.map((x) => (x.id === c.id ? updated : x)) : p));
    } catch (e) {
      setQueryData<Comment[]>(keys.comments(task.id), (p) => (p ? p.map((x) => (x.id === c.id ? { ...x, body: before } : x)) : p));
      toast.fromError(e);
      throw e;
    }
  };
  const remove = async (c: Comment) => {
    if (!(await confirm({ title: 'Delete comment?', description: 'This cannot be undone.', danger: true, confirmLabel: 'Delete' }))) return;
    setQueryData<Comment[]>(keys.comments(task.id), (p) => (p ? p.filter((x) => x.id !== c.id) : p));
    try {
      await taskApi.deleteComment(c.id);
    } catch (e) {
      setQueryData<Comment[]>(keys.comments(task.id), (p) => (p && !p.some((x) => x.id === c.id) ? [...p, c].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : p));
      toast.fromError(e);
    }
  };
  const files = async (fs: File[]) => {
    const added = await upload(fs);
    if (added.length) change(draft + (draft && !draft.endsWith('\n') ? '\n' : '') + added.map((a) => `[${a.filename}](${a.url})`).join('\n') + '\n');
  };

  return (
    <div className="task-comments">
      {comments.isLoading ? (
        <div className="col gap-3 mt-3">
          {[0, 1].map((i) => (
            <div key={i} className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <Skeleton width={28} height={28} radius="50%" />
              <div className="col gap-2 grow"><Skeleton width={160} height={12} /><Skeleton height={12} /><Skeleton height={12} width="70%" /></div>
            </div>
          ))}
        </div>
      ) : comments.error ? (
        <EmptyState compact icon="alert-circle" title="Couldn't load comments" description={comments.error.message} action={<Button size="sm" onClick={() => void comments.refetch()}>Retry</Button>} />
      ) : list.length ? (
        <div ref={listRef} className="task-comment-list">
          {list.map((c) => (
            <CommentItem key={c.id} c={c} mine={c.authorId === meId} canDelete={canEdit && (c.authorId === meId || canManage)} onEdit={(b) => edit(c, b)} onDelete={() => void remove(c)} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="message" title="No comments yet" description={canEdit ? 'Start the conversation — @mention teammates to notify them.' : 'Nothing has been said about this task yet.'} />
      )}

      {canEdit ? (
        <div className="task-composer">
          {typingNames.length ? (
            <div className="task-typing xs muted" aria-live="polite">
              <span className="task-typing-dots"><i /><i /><i /></span>
              {typingNames.length === 1 ? `${typingNames[0]} is typing…` : typingNames.length === 2 ? `${typingNames[0]} and ${typingNames[1]} are typing…` : `${typingNames[0]} and ${typingNames.length - 1} others are typing…`}
            </div>
          ) : null}
          <Editor value={draft} onChange={change} compact minRows={2} placeholder="Leave a comment… @ to mention" onSubmit={() => void post()} onFiles={(f) => void files(f)} onTyping={onTyping} disabled={posting} />
          <div className="row between mt-2 task-composer-foot">
            <span className="row gap-2">
              <EditorHint />
              {uploading.length ? <span className="xs muted row gap-1"><Icon name="loader" size={12} className="spinner" /> Uploading…</span> : null}
            </span>
            <Button size="sm" variant="primary" icon="send" loading={posting} disabled={!draft.trim()} onClick={() => void post()}>Comment</Button>
          </div>
        </div>
      ) : (
        <p className="task-section-note xs muted"><Icon name="lock" size={12} /> Guests can read comments but can't post.</p>
      )}
    </div>
  );
}
