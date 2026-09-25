// Server-Sent Events hub: per-workspace fan-out, per-user delivery, presence.
import type { ServerResponse } from 'node:http';
import type { RealtimeEvent, PresenceUser } from '../../../../packages/shared/src/types.ts';

interface Client {
  id: number;
  userId: string;
  workspaceId: string;
  name: string;
  avatarUrl: string | null;
  res: ServerResponse;
  location: string | null;
  lastSeen: number;
}

type VisibilityCheck = (userId: string, projectId: string) => boolean;

/** Which project an event belongs to (null = workspace-wide). */
function projectOf(event: RealtimeEvent): string | null {
  switch (event.type) {
    case 'task.created':
    case 'task.updated':
    case 'task.deleted':
    case 'tasks.reordered':
    case 'comment.created':
    case 'comment.updated':
    case 'comment.deleted':
    case 'task.detail_changed':
    case 'project.meta_changed':
      return event.projectId;
    case 'project.updated':
      return event.project.id;
    case 'activity':
      return event.activity.projectId;
    default:
      return null;
  }
}

class RealtimeHub {
  private clients = new Map<number, Client>();
  private seq = 0;
  private presenceTimers = new Map<string, NodeJS.Timeout>();
  private canSee: VisibilityCheck = () => true;

  /** Install the project-visibility predicate (private projects are only broadcast to their members). */
  setVisibilityCheck(fn: VisibilityCheck) {
    this.canSee = fn;
  }

  /** Drop every connection of a user to a workspace (e.g. when they are removed). */
  disconnectUser(userId: string, workspaceId: string) {
    for (const c of [...this.clients.values()]) {
      if (c.userId === userId && c.workspaceId === workspaceId) {
        this.clients.delete(c.id);
        try {
          c.res.end();
        } catch {
          /* ignore */
        }
      }
    }
    this.schedulePresence(workspaceId);
  }

  constructor() {
    setInterval(() => this.heartbeat(), 25_000).unref();
  }

  attach(res: ServerResponse, user: { id: string; name: string; avatarUrl: string | null }, workspaceId: string, location: string | null) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 3000\n\n`);
    const client: Client = {
      id: ++this.seq,
      userId: user.id,
      workspaceId,
      name: user.name,
      avatarUrl: user.avatarUrl,
      res,
      location,
      lastSeen: Date.now(),
    };
    this.clients.set(client.id, client);
    res.on('close', () => {
      this.clients.delete(client.id);
      this.schedulePresence(workspaceId);
    });
    this.send(client, { type: 'presence', users: this.presence(workspaceId) });
    this.schedulePresence(workspaceId);
    return client.id;
  }

  private send(client: Client, event: RealtimeEvent) {
    try {
      client.res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      this.clients.delete(client.id);
    }
  }

  private heartbeat() {
    for (const c of this.clients.values()) {
      try {
        c.res.write(`: ping\n\n`);
      } catch {
        this.clients.delete(c.id);
      }
    }
  }

  /** Broadcast to everyone connected to a workspace. */
  publish(workspaceId: string, event: RealtimeEvent, opts: { excludeUserId?: string } = {}) {
    const projectId = projectOf(event);
    const visible = new Map<string, boolean>();
    for (const c of this.clients.values()) {
      if (c.workspaceId !== workspaceId) continue;
      if (opts.excludeUserId && c.userId === opts.excludeUserId) continue;
      if (projectId) {
        let ok = visible.get(c.userId);
        if (ok === undefined) {
          ok = this.canSee(c.userId, projectId);
          visible.set(c.userId, ok);
        }
        if (!ok) continue;
      }
      this.send(c, event);
    }
  }

  /** Deliver to all connections of one user (any workspace). */
  publishToUser(userId: string, event: RealtimeEvent) {
    for (const c of this.clients.values()) if (c.userId === userId) this.send(c, event);
  }

  setLocation(userId: string, workspaceId: string, location: string | null) {
    let changed = false;
    for (const c of this.clients.values()) {
      if (c.userId === userId && c.workspaceId === workspaceId) {
        if (c.location !== location) changed = true;
        c.location = location;
        c.lastSeen = Date.now();
      }
    }
    if (changed) this.schedulePresence(workspaceId);
  }

  presence(workspaceId: string): PresenceUser[] {
    const byUser = new Map<string, PresenceUser>();
    for (const c of this.clients.values()) {
      if (c.workspaceId !== workspaceId) continue;
      const prev = byUser.get(c.userId);
      if (!prev || c.lastSeen > prev.lastSeen) {
        byUser.set(c.userId, { userId: c.userId, name: c.name, avatarUrl: c.avatarUrl, location: c.location, lastSeen: c.lastSeen });
      }
    }
    return [...byUser.values()];
  }

  private schedulePresence(workspaceId: string) {
    if (this.presenceTimers.has(workspaceId)) return;
    this.presenceTimers.set(
      workspaceId,
      setTimeout(() => {
        this.presenceTimers.delete(workspaceId);
        this.publish(workspaceId, { type: 'presence', users: this.presence(workspaceId) });
      }, 300),
    );
  }

  onlineUserIds(): Set<string> {
    return new Set([...this.clients.values()].map((c) => c.userId));
  }
}

export const realtime = new RealtimeHub();
