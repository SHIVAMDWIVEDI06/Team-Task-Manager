// Safe Markdown → HTML. All user text is HTML-escaped before any markup is applied, so raw HTML never renders.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:|\/)/i.test(u)) return u;
  return null;
}

function inline(text: string): string {
  let s = esc(text);
  // code spans first so their content is not further processed
  const codes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  // mentions @[Name](id)
  s = s.replace(/@\[([^\]]+)\]\(([A-Za-z0-9_-]{6,32})\)/g, (_, name, id) => `<span class="mention" data-user-id="${id}">@${name}</span>`);
  // images ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => {
    const u = safeUrl(url);
    return u ? `<img src="${esc(u)}" alt="${alt}" loading="lazy">` : alt;
  });
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const u = safeUrl(url);
    return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  });
  // bare URLs
  s = s.replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g, (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  // bold, italic, strike
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // task keys like ENG-42 → clickable
  s = s.replace(/(^|[\s(])([A-Z][A-Z0-9]{1,5}-\d+)(?![\w-])/g, (_, pre, key) => `${pre}<a class="task-ref" data-task-key="${key}" href="?task=${key}">${key}</a>`);
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return s;
}

export function renderMarkdown(src: string, opts: { breaks?: boolean } = {}): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  const breaks = opts.breaks ?? true;

  const flushPara = (buf: string[]) => {
    if (!buf.length) return;
    out.push(`<p>${buf.map(inline).join(breaks ? '<br>' : ' ')}</p>`);
    buf.length = 0;
  };

  let para: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    // code fence
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      flushPara(para);
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${fence[1] ? ` class="lang-${esc(fence[1])}"` : ''}>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (!line.trim()) {
      flushPara(para);
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara(para);
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara(para);
      out.push('<hr>');
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara(para);
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'), opts)}</blockquote>`);
      continue;
    }
    // table
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flushPara(para);
      const header = line.split('|').slice(1, -1).map((c) => `<th>${inline(c.trim())}</th>`).join('');
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        rows.push(`<tr>${lines[i].split('|').slice(1, -1).map((c) => `<td>${inline(c.trim())}</td>`).join('')}</tr>`);
        i++;
      }
      out.push(`<table><thead><tr>${header}</tr></thead><tbody>${rows.join('')}</tbody></table>`);
      continue;
    }
    // lists
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flushPara(para);
      const ordered = /\d/.test(li[2]);
      const baseIndent = li[1].length;
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m || m[1].length < baseIndent) break;
        if (m[1].length > baseIndent) {
          // nested list: collect and recurse
          const nested: string[] = [];
          while (i < lines.length) {
            const n = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
            if (!n || n[1].length <= baseIndent) break;
            nested.push(lines[i].slice(baseIndent + 2));
            i++;
          }
          items[items.length - 1] = items[items.length - 1].replace(/<\/li>$/, `${renderMarkdown(nested.join('\n'), opts)}</li>`);
          continue;
        }
        const task = /^\[([ xX])\]\s+(.*)$/.exec(m[3]);
        if (task) {
          const done = task[1] !== ' ';
          items.push(`<li class="task${done ? ' done' : ''}"><input type="checkbox" ${done ? 'checked' : ''} data-md-line="${i}"><span>${inline(task[2])}</span></li>`);
        } else items.push(`<li>${inline(m[3])}</li>`);
        i++;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara(para);
  return out.join('\n');
}

/** Toggle the checkbox on a given source line of markdown (used by rendered task lists). */
export function toggleMarkdownCheckbox(src: string, lineIndex: number): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const line = lines[lineIndex];
  if (line === undefined) return src;
  lines[lineIndex] = /\[ \]/.test(line) ? line.replace('[ ]', '[x]') : line.replace(/\[[xX]\]/, '[ ]');
  return lines.join('\n');
}

/** Plain-text excerpt of markdown (for previews). */
export function markdownExcerpt(src: string, max = 140): string {
  const text = src
    .replace(/```[\s\S]*?```/g, '')
    .replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
