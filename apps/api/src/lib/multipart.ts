// Minimal multipart/form-data parser (in-memory; bounded by the caller's size limit).
import { errors } from './errors.ts';

export interface UploadedFile {
  field: string;
  filename: string;
  mime: string;
  data: Buffer;
}

function parseHeaders(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split('\r\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}

function param(header: string, name: string): string | null {
  const re = new RegExp(`${name}\\*?=(?:"([^"]*)"|([^;]*))`, 'i');
  const m = re.exec(header);
  if (!m) return null;
  return (m[1] ?? m[2] ?? '').trim();
}

export function parseMultipart(raw: Buffer, contentType: string): { fields: Record<string, string>; files: UploadedFile[] } {
  const boundary = param(contentType, 'boundary');
  if (!boundary) throw errors.badRequest('Missing multipart boundary');
  const delimiter = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];

  let pos = raw.indexOf(delimiter);
  if (pos === -1) throw errors.badRequest('Malformed multipart body');
  pos += delimiter.length;

  while (pos < raw.length) {
    // end marker "--"
    if (raw[pos] === 0x2d && raw[pos + 1] === 0x2d) break;
    // skip CRLF after boundary
    if (raw[pos] === 0x0d && raw[pos + 1] === 0x0a) pos += 2;
    const headerEnd = raw.indexOf('\r\n\r\n', pos);
    if (headerEnd === -1) break;
    const headers = parseHeaders(raw.subarray(pos, headerEnd).toString('utf8'));
    const bodyStart = headerEnd + 4;
    const next = raw.indexOf(delimiter, bodyStart);
    if (next === -1) break;
    let bodyEnd = next;
    if (raw[bodyEnd - 2] === 0x0d && raw[bodyEnd - 1] === 0x0a) bodyEnd -= 2;
    const body = raw.subarray(bodyStart, bodyEnd);

    const disposition = headers['content-disposition'] || '';
    const field = param(disposition, 'name') || 'file';
    const filename = param(disposition, 'filename');
    if (filename !== null) {
      files.push({
        field,
        filename: filename.replace(/[\\/]/g, '_').slice(0, 200) || 'file',
        mime: headers['content-type'] || 'application/octet-stream',
        data: Buffer.from(body),
      });
    } else {
      fields[field] = body.toString('utf8');
    }
    pos = next + delimiter.length;
  }
  return { fields, files };
}
