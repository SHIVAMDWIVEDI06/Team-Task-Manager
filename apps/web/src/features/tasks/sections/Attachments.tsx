// Attachments: card grid (image thumbnails), open / download / delete, upload button + drop zone.
import { useCallback, useRef, useState } from 'react';
import type { Attachment, TaskDetail } from '../../../../../../packages/shared/src/types.ts';
import { keys, taskApi } from '../../../app/data.ts';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { formatBytes, formatDateTime, relativeTime } from '../../../lib/format.ts';
import { Button, Spinner, cx } from '../../../ui/primitives.tsx';
import { Tooltip, useConfirm } from '../../../ui/overlays.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { Section, downloadAttachment, fileIcon, isImage, openAttachment, useAttachmentUrl, useTaskCtx } from './Section.tsx';

export interface PendingUpload {
  id: number;
  name: string;
  size: number;
}
let seq = 0;

/** Upload files as attachments of a task; tracks in-flight files for UI feedback. */
export function useUploader(taskId: string) {
  const [uploading, setUploading] = useState<PendingUpload[]>([]);
  const upload = useCallback(
    async (files: File[]): Promise<Attachment[]> => {
      if (!files.length) return [];
      const pending = files.map((f) => ({ id: ++seq, name: f.name, size: f.size }));
      setUploading((u) => [...u, ...pending]);
      try {
        const added = await taskApi.upload(taskId, files);
        setQueryData<TaskDetail>(keys.task(taskId), (p) => (p ? { ...p, attachments: [...p.attachments, ...added.filter((a) => !p.attachments.some((x) => x.id === a.id))], attachmentCount: p.attachmentCount + added.length } : p));
        invalidate(keys.task(taskId));
        toast.success(added.length === 1 ? `Uploaded ${added[0].filename}` : `Uploaded ${added.length} files`);
        return added;
      } catch (e) {
        toast.fromError(e, 'Upload failed');
        return [];
      } finally {
        const ids = new Set(pending.map((p) => p.id));
        setUploading((u) => u.filter((p) => !ids.has(p.id)));
      }
    },
    [taskId],
  );
  return { upload, uploading };
}

function Card({ a, canDelete, onDelete }: { a: Attachment; canDelete: boolean; onDelete: () => void }) {
  const img = isImage(a.mime);
  const thumb = useAttachmentUrl(img ? a.url : null);
  return (
    <div className="task-attachment" role="listitem">
      <button type="button" className="task-attachment-preview" onClick={() => void openAttachment(a.url)} aria-label={`Open ${a.filename}`} title="Open in new tab">
        {img ? thumb ? <img src={thumb} alt={a.filename} loading="lazy" /> : <Spinner size={16} className="muted" /> : <Icon name={fileIcon(a.mime, a.filename)} size={26} strokeWidth={1.4} className="task-attachment-icon" />}
      </button>
      <div className="task-attachment-meta">
        <span className="task-attachment-name truncate" title={a.filename}>{a.filename}</span>
        <span className="xs muted truncate">
          {formatBytes(a.size)}
          {a.uploader ? ` · ${a.uploader.name.split(' ')[0]}` : ''}
          <Tooltip content={formatDateTime(a.createdAt)}><span> · {relativeTime(a.createdAt)}</span></Tooltip>
        </span>
      </div>
      <span className="task-attachment-actions">
        <Tooltip content="Download"><Button size="sm" variant="ghost" icon="download" iconOnly onClick={() => void downloadAttachment(a.url, a.filename)} aria-label={`Download ${a.filename}`}>Download</Button></Tooltip>
        {canDelete ? <Tooltip content="Delete"><Button size="sm" variant="ghost" icon="trash" iconOnly onClick={onDelete} aria-label={`Delete ${a.filename}`}>Delete</Button></Tooltip> : null}
      </span>
    </div>
  );
}

export function Attachments() {
  const { task, canEdit, canManage, meId } = useTaskCtx();
  const confirm = useConfirm();
  const { upload, uploading } = useUploader(task.id);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!task.attachments.length && !canEdit) return null;

  const remove = async (a: Attachment) => {
    if (!(await confirm({ title: `Delete ${a.filename}?`, description: 'The file will be permanently removed from this task.', danger: true, confirmLabel: 'Delete' }))) return;
    setQueryData<TaskDetail>(keys.task(task.id), (p) => (p ? { ...p, attachments: p.attachments.filter((x) => x.id !== a.id), attachmentCount: Math.max(0, p.attachmentCount - 1) } : p));
    try {
      await taskApi.deleteAttachment(a.id);
    } catch (e) {
      toast.fromError(e);
      invalidate(keys.task(task.id));
    }
  };

  const pickFiles = () => inputRef.current?.click();
  const dropProps = canEdit
    ? {
        onDragEnter: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); dragDepth.current++; setDragOver(true); } },
        onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); },
        onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragOver(false); },
        onDrop: (e: React.DragEvent) => { e.preventDefault(); dragDepth.current = 0; setDragOver(false); const files = [...e.dataTransfer.files]; if (files.length) void upload(files); },
      }
    : {};

  const count = task.attachments.length;
  return (
    <Section
      icon="paperclip"
      title="Attachments"
      count={count || undefined}
      actions={canEdit ? <Button size="sm" variant="ghost" icon="upload" onClick={pickFiles}>Upload</Button> : null}
    >
      {canEdit ? <input ref={inputRef} type="file" multiple hidden onChange={(e) => { const files = [...(e.target.files || [])]; if (files.length) void upload(files); e.target.value = ''; }} aria-label="Upload files" /> : null}
      <div className={cx('task-attachments-zone', dragOver && 'is-dragover', !count && !uploading.length && 'is-empty')} {...dropProps}>
        {count || uploading.length ? (
          <div className="task-attachments" role="list">
            {task.attachments.map((a) => (
              <Card key={a.id} a={a} canDelete={canEdit && (a.uploaderId === meId || canManage)} onDelete={() => void remove(a)} />
            ))}
            {uploading.map((u) => (
              <div key={u.id} className="task-attachment is-uploading" role="listitem" aria-busy="true">
                <div className="task-attachment-preview"><Spinner size={18} /></div>
                <div className="task-attachment-meta">
                  <span className="task-attachment-name truncate">{u.name}</span>
                  <span className="xs muted">Uploading · {formatBytes(u.size)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : canEdit ? (
          <button type="button" className="task-attachments-empty" onClick={pickFiles}>
            <Icon name="upload" size={16} />
            <span>Drop files here or <span className="task-link-text">browse</span></span>
          </button>
        ) : null}
        {dragOver ? <div className="task-attachments-dropmsg"><Icon name="upload" size={16} /> Drop to upload</div> : null}
      </div>
    </Section>
  );
}
