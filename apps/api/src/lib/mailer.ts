// Email delivery: raw SMTP over STARTTLS/TLS (no dependencies), with a console fallback.
import net from 'node:net';
import tls from 'node:tls';
import { config } from '../config.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function readLine(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const onData = (d: Buffer) => {
      buf += d.toString('utf8');
      // multi-line replies end with "<code> " (space after code)
      const lines = buf.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        socket.off('data', onData);
        resolve(buf);
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

async function cmd(socket: net.Socket | tls.TLSSocket, line: string | null, expect: number[]): Promise<string> {
  if (line !== null) socket.write(line + '\r\n');
  const res = await readLine(socket);
  const code = Number(res.slice(0, 3));
  if (!expect.includes(code)) throw new Error(`SMTP error: ${res.trim()}`);
  return res;
}

async function sendSmtp(mail: Mail): Promise<void> {
  const smtp = config.smtp!;
  const useTls = smtp.port === 465;
  let socket: net.Socket | tls.TLSSocket = useTls
    ? tls.connect({ host: smtp.host, port: smtp.port, servername: smtp.host })
    : net.connect({ host: smtp.host, port: smtp.port });
  await new Promise<void>((resolve, reject) => {
    socket.once(useTls ? 'secureConnect' : 'connect', () => resolve());
    socket.once('error', reject);
  });
  socket.setTimeout(20_000, () => socket.destroy(new Error('SMTP timeout')));
  await cmd(socket, null, [220]);
  await cmd(socket, 'EHLO teamtask', [250]);
  if (!useTls) {
    await cmd(socket, 'STARTTLS', [220]);
    socket = tls.connect({ socket, servername: smtp.host });
    await new Promise<void>((resolve, reject) => {
      (socket as tls.TLSSocket).once('secureConnect', () => resolve());
      socket.once('error', reject);
    });
    await cmd(socket, 'EHLO teamtask', [250]);
  }
  if (smtp.user) {
    await cmd(socket, 'AUTH LOGIN', [334]);
    await cmd(socket, Buffer.from(smtp.user).toString('base64'), [334]);
    await cmd(socket, Buffer.from(smtp.pass).toString('base64'), [235]);
  }
  const fromAddr = /<([^>]+)>/.exec(smtp.from)?.[1] || smtp.from;
  await cmd(socket, `MAIL FROM:<${fromAddr}>`, [250]);
  await cmd(socket, `RCPT TO:<${mail.to}>`, [250, 251]);
  await cmd(socket, 'DATA', [354]);
  const boundary = `b${Date.now().toString(36)}`;
  const headers = [
    `From: ${smtp.from}`,
    `To: ${mail.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(mail.subject).toString('base64')}?=`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    mail.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    mail.html || `<pre>${mail.text}</pre>`,
    `--${boundary}--`,
    '',
  ];
  const data = [...headers, '', ...body].join('\r\n').replace(/\r\n\./g, '\r\n..');
  await cmd(socket, data + '\r\n.', [250]);
  await cmd(socket, 'QUIT', [221]);
  socket.end();
}

export const mailer = {
  get enabled() {
    return Boolean(config.smtp);
  },
  async send(mail: Mail): Promise<{ delivered: boolean }> {
    if (!config.smtp) {
      console.log(`\n[mail] (SMTP not configured) To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
      return { delivered: false };
    }
    try {
      await sendSmtp(mail);
      return { delivered: true };
    } catch (err) {
      console.error('[mail] delivery failed:', (err as Error).message);
      return { delivered: false };
    }
  },
};

export function emailTemplate(title: string, lines: string[], cta?: { label: string; url: string }): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><body style="margin:0;background:#f5f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1f2b">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e6e8ef">
<div style="font-weight:700;font-size:18px;margin-bottom:16px">${esc(title)}</div>
${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5;color:#3a3f52">${esc(l)}</p>`).join('')}
${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:12px;background:#6b7cff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(cta.label)}</a><p style="margin-top:16px;font-size:12px;color:#8b8fa3">Or copy this link: ${esc(cta.url)}</p>` : ''}
</div></body></html>`;
}
