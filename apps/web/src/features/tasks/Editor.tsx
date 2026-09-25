// Markdown editor with toolbar, @mention autocomplete, task-key linking, paste/drop of files, and a rendered view.
// Mentions are stored as @[Name](userId) in the markdown source.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { renderMarkdown, toggleMarkdownCheckbox } from '../../lib/markdown.ts';
import { useWorkspace, useWorkspaceOptional } from '../../app/workspace.tsx';
import { Avatar, Button, cx, Kbd } from '../../ui/primitives.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { Tooltip } from '../../ui/overlays.tsx';
import { navigate, useSearchParams } from '../../lib/router.tsx';
import { modKey } from '../../lib/format.ts';
import './editor.css';

export interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
  onSubmit?: () => void; // mod+Enter
  onCancel?: () => void; // Escape
  onFiles?: (files: File[]) => void;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
  toolbar?: boolean;
  footer?: ReactNode;
  onTyping?: () => void;
  id?: string;
}

interface MentionState {
  start: number; // index of '@'
  query: string;
  rect: { top: number; left: number };
}

/** Caret pixel position inside a textarea (mirror-div technique). */
function caretCoords(el: HTMLTextAreaElement, pos: number): { top: number; left: number } {
  const div = document.createElement('div');
  const style = getComputedStyle(el);
  for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'padding', 'border', 'boxSizing', 'whiteSpace', 'wordWrap', 'width'] as const) {
    (div.style as unknown as Record<string, string>)[prop] = style[prop as keyof CSSStyleDeclaration] as string;
  }
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.top = '0';
  div.style.left = '-9999px';
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = el.value.slice(pos) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const rect = el.getBoundingClientRect();
  const top = rect.top + span.offsetTop - el.scrollTop + parseFloat(style.lineHeight || '20');
  const left = rect.left + span.offsetLeft - el.scrollLeft;
  document.body.removeChild(div);
  return { top, left };
}

export function Editor({ value, onChange, placeholder = 'Write something… Markdown supported, @ to mention', minRows = 3, autoFocus, onSubmit, onCancel, onFiles, compact, className, disabled, toolbar = true, footer, onTyping, id }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const ws = useWorkspaceOptional();
  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [preview, setPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const members = ws?.members ?? [];
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members.filter((m) => m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q)).slice(0, 6);
  }, [mention, members]);

  useEffect(() => setMentionIndex(0), [mention?.query]);
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 0);
  }, [autoFocus]);
  // auto-grow
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(minRows * 22 + 16, Math.min(600, el.scrollHeight))}px`;
  }, [value, minRows, preview]);

  const setValueAndCaret = useCallback(
    (next: string, caret: number) => {
      onChange(next);
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [onChange],
  );

  const detectMention = (el: HTMLTextAreaElement) => {
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos);
    const m = /(?:^|\s)@([\w .-]{0,30})$/.exec(before);
    if (m && members.length) {
      const start = pos - m[1].length - 1;
      setMention({ start, query: m[1], rect: caretCoords(el, start) });
    } else setMention(null);
  };

  const insertMention = (userId: string, name: string) => {
    if (!mention || !ref.current) return;
    const el = ref.current;
    const pos = el.selectionStart;
    const next = value.slice(0, mention.start) + `@[${name}](${userId}) ` + value.slice(pos);
    setMention(null);
    setValueAndCaret(next, mention.start + name.length + userId.length + 6);
  };

  const wrap = (before: string, after = before, placeholderText = 'text') => {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = value.slice(s, e) || placeholderText;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const linePrefix = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const lineEnd = value.indexOf('\n', e) === -1 ? value.length : value.indexOf('\n', e);
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const allHave = lines.every((l) => l.startsWith(prefix));
    const updated = lines.map((l) => (allHave ? l.slice(prefix.length) : prefix + l)).join('\n');
    const next = value.slice(0, lineStart) + updated + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + updated.length);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const m = suggestions[mentionIndex];
        insertMention(m.userId, m.user.name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMention(null);
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if (e.key === 'Escape' && onCancel) {
      e.stopPropagation();
      onCancel();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrap('**');
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrap('_');
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      wrap('`');
      return;
    }
    // continue lists on Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      const el = e.currentTarget;
      const pos = el.selectionStart;
      const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
      const line = value.slice(lineStart, pos);
      const m = /^(\s*)([-*+]|\d+[.)])\s(\[[ xX]\]\s)?(.*)$/.exec(line);
      if (m) {
        e.preventDefault();
        if (!m[4].trim() && !m[3]) {
          // empty item → end list
          const next = value.slice(0, lineStart) + value.slice(pos);
          setValueAndCaret(next, lineStart);
          return;
        }
        const marker = /\d/.test(m[2]) ? `${Number.parseInt(m[2]) + 1}.` : m[2];
        const insert = `\n${m[1]}${marker} ${m[3] ? '[ ] ' : ''}`;
        const next = value.slice(0, pos) + insert + value.slice(pos);
        setValueAndCaret(next, pos + insert.length);
        return;
      }
    }
    if (e.key === 'Tab' && !mention) {
      e.preventDefault();
      const el = e.currentTarget;
      const pos = el.selectionStart;
      const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
      if (e.shiftKey) {
        if (value.slice(lineStart, lineStart + 2) === '  ') setValueAndCaret(value.slice(0, lineStart) + value.slice(lineStart + 2), Math.max(lineStart, pos - 2));
      } else setValueAndCaret(value.slice(0, lineStart) + '  ' + value.slice(lineStart), pos + 2);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (files.length && onFiles) {
      e.preventDefault();
      onFiles(files);
    }
  };

  const tools: { icon: string; title: string; shortcut?: string; run: () => void }[] = [
    { icon: 'bold', title: 'Bold', shortcut: `${modKey} B`, run: () => wrap('**') },
    { icon: 'italic', title: 'Italic', shortcut: `${modKey} I`, run: () => wrap('_') },
    { icon: 'strike', title: 'Strikethrough', run: () => wrap('~~') },
    { icon: 'code', title: 'Code', shortcut: `${modKey} E`, run: () => wrap('`') },
    { icon: 'heading', title: 'Heading', run: () => linePrefix('## ') },
    { icon: 'list', title: 'Bullet list', run: () => linePrefix('- ') },
    { icon: 'list-ordered', title: 'Numbered list', run: () => linePrefix('1. ') },
    { icon: 'check-square', title: 'Checklist', run: () => linePrefix('- [ ] ') },
    { icon: 'quote', title: 'Quote', run: () => linePrefix('> ') },
    { icon: 'link', title: 'Link', run: () => wrap('[', '](https://)', 'link text') },
    { icon: 'at-sign', title: 'Mention', run: () => { const el = ref.current; if (!el) return; const pos = el.selectionStart; const prefix = pos > 0 && !/\s/.test(value[pos - 1]) ? ' @' : '@'; setValueAndCaret(value.slice(0, pos) + prefix + value.slice(pos), pos + prefix.length); setTimeout(() => ref.current && detectMention(ref.current), 0); } },
  ];

  return (
    <div className={cx('editor', compact && 'is-compact', dragOver && 'is-dragover', disabled && 'is-disabled', className)} onDragOver={(e) => { if (onFiles) { e.preventDefault(); setDragOver(true); } }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { if (!onFiles) return; e.preventDefault(); setDragOver(false); const files = [...e.dataTransfer.files]; if (files.length) onFiles(files); }}>
      {toolbar ? (
        <div className="editor-toolbar">
          {tools.map((t) => (
            <Tooltip key={t.title} content={t.title} shortcut={t.shortcut} placement="top">
              <button type="button" className="editor-tool" onMouseDown={(e) => e.preventDefault()} onClick={t.run} aria-label={t.title} disabled={disabled || preview}>
                <Icon name={t.icon} size={14} />
              </button>
            </Tooltip>
          ))}
          <span className="grow" />
          {onFiles ? (
            <Tooltip content="Attach files" placement="top">
              <label className="editor-tool" aria-label="Attach files">
                <Icon name="paperclip" size={14} />
                <input type="file" multiple hidden onChange={(e) => { const files = [...(e.target.files || [])]; if (files.length) onFiles(files); e.target.value = ''; }} />
              </label>
            </Tooltip>
          ) : null}
          <button type="button" className={cx('editor-tool editor-preview-toggle', preview && 'is-active')} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
            <Icon name={preview ? 'pencil' : 'eye'} size={14} />
            <span>{preview ? 'Edit' : 'Preview'}</span>
          </button>
        </div>
      ) : null}
      {preview ? (
        <div className="editor-preview">{value.trim() ? <MarkdownView source={value} /> : <span className="muted">Nothing to preview</span>}</div>
      ) : (
        <textarea
          id={id}
          ref={ref}
          className="editor-textarea"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          rows={minRows}
          onChange={(e) => {
            onChange(e.target.value);
            detectMention(e.currentTarget);
            onTyping?.();
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) detectMention(e.currentTarget); }}
          onClick={(e) => detectMention(e.currentTarget)}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          onPaste={onPaste}
          spellCheck
        />
      )}
      {footer ? <div className="editor-footer">{footer}</div> : null}
      {mention && suggestions.length
        ? createPortal(
            <div className="mention-menu" style={{ position: 'fixed', top: Math.min(mention.rect.top + 4, window.innerHeight - 240), left: Math.min(mention.rect.left, window.innerWidth - 280) }} role="listbox">
              {suggestions.map((m, i) => (
                <button key={m.userId} type="button" role="option" aria-selected={i === mentionIndex} className={cx('mention-item', i === mentionIndex && 'is-active')} onMouseDown={(e) => { e.preventDefault(); insertMention(m.userId, m.user.name); }} onMouseEnter={() => setMentionIndex(i)}>
                  <Avatar name={m.user.name} src={m.user.avatarUrl} size={20} />
                  <span className="col" style={{ minWidth: 0 }}>
                    <span className="truncate">{m.user.name}</span>
                    <span className="xs muted truncate">{m.user.email}</span>
                  </span>
                </button>
              ))}
              <div className="mention-hint"><Kbd>↑↓</Kbd> navigate <Kbd>↵</Kbd> select</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Renders markdown safely. Task keys open the task; checkboxes toggle when `onChange` is provided; mentions show the name. */
export function MarkdownView({ source, onChange, className, breaks }: { source: string; onChange?: (next: string) => void; className?: string; breaks?: boolean }) {
  const html = useMemo(() => renderMarkdown(source, { breaks }), [source, breaks]);
  const ws = useWorkspaceOptional();
  const [, setParams] = useSearchParams();
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const ref = target.closest('a.task-ref') as HTMLAnchorElement | null;
    if (ref) {
      e.preventDefault();
      const key = ref.dataset.taskKey!;
      if (ws) setParams({ task: key }, { replace: false });
      else navigate(`?task=${key}`);
      return;
    }
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      const line = Number((target as HTMLInputElement).dataset.mdLine);
      if (onChange && !Number.isNaN(line)) onChange(toggleMarkdownCheckbox(source, line));
      else e.preventDefault();
    }
  };
  return <div className={cx('md', className)} dangerouslySetInnerHTML={{ __html: html }} onClick={onClick} />;
}

export function useProjectContextForEditor() {
  return useWorkspace();
}

export function EditorHint() {
  return (
    <span className="editor-hint muted xs">
      <Kbd>{modKey}</Kbd> <Kbd>↵</Kbd> to submit · Markdown · @ to mention
    </span>
  );
}
