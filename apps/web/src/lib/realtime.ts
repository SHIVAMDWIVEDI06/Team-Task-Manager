// Server-Sent Events client: keeps the query cache live and exposes an event bus.
import type { RealtimeEvent, Task, TaskDetail, Comment, Project, Notification, PresenceUser, Activity, ProjectBundle } from '../../../../packages/shared/src/types.ts';
import { getQueryData, invalidate, setQueryData } from './query.ts';
import { tokenStore, refreshAccessToken, api } from './api.ts';
import { createStore, uiStore } from './store.ts';

type Handler = (e: RealtimeEvent) => void;
const handlers = new Map<string, Set<Handler>>();

export const presenceStore = createStore<{ users: PresenceUser[] }>({ users: [] });

let source: EventSource | null = null;
let currentWorkspace: string | null = null;
let currentLocation: string | null = null;
let reconnectTimer: number | null = null;
let backoff = 1000;

function upsertTask(list: Task[] | undefined, task: Task): Task[] {
  if (!list) return [task];
  const idx = list.findIndex((t) => t.id === task.id);
  if (idx === -1) return [...list, task];
  const next = list.slice();
  next[idx] = task;
  return next;
}

export function applyEvent(e: RealtimeEvent) {
  switch (e.type) {
    case 'task.created':
    case 'task.updated': {
      setQueryData<Task[]>(`tasks:${e.projectId}`, (prev) => (prev ? upsertTask(prev, e.task) : prev));
      setQueryData<TaskDetail>(`task:${e.task.id}`, (prev) => (prev ? { ...prev, ...e.task } : prev));
      if (e.task.parentId) invalidate(`task:${e.task.parentId}`);
      invalidate(['dashboard', 'mytasks', 'search']);
      break;
    }
    case 'task.deleted': {
      setQueryData<Task[]>(`tasks:${e.projectId}`, (prev) => (prev ? prev.filter((t) => t.id !== e.taskId && t.parentId !== e.taskId) : prev));
      invalidate(['dashboard', 'mytasks']);
      break;
    }
    case 'tasks.reordered':
      invalidate(`tasks:${e.projectId}`);
      break;
    case 'comment.created':
      setQueryData<Comment[]>(`comments:${e.taskId}`, (prev) => (prev ? (prev.some((c) => c.id === e.comment.id) ? prev : [...prev, e.comment]) : prev));
      break;
    case 'comment.updated':
      setQueryData<Comment[]>(`comments:${e.taskId}`, (prev) => (prev ? prev.map((c) => (c.id === e.comment.id ? e.comment : c)) : prev));
      break;
    case 'comment.deleted':
      setQueryData<Comment[]>(`comments:${e.taskId}`, (prev) => (prev ? prev.filter((c) => c.id !== e.commentId) : prev));
      break;
    case 'task.detail_changed':
      invalidate([`task:${e.taskId}`, `time:${e.taskId}`, `activity:task:${e.taskId}`]);
      break;
    case 'project.updated': {
      setQueryData<Project[]>(`projects:${e.project.workspaceId}`, (prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((p) => p.id === e.project.id);
        const merged = idx === -1 ? [...prev, e.project] : prev.map((p) => (p.id === e.project.id ? { ...p, ...e.project } : p));
        return e.project.state === 'archived' ? merged.filter((p) => p.id !== e.project.id || getQueryData<boolean>('projects:showArchived')) : merged;
      });
      setQueryData<ProjectBundle>(`bundle:${e.project.id}`, (prev) => (prev ? { ...prev, project: { ...prev.project, ...e.project } } : prev));
      invalidate(['dashboard', `projects:${e.project.workspaceId}`]);
      break;
    }
    case 'project.deleted':
      invalidate(['projects', 'dashboard']);
      break;
    case 'project.meta_changed':
      invalidate(`bundle:${e.projectId}`);
      break;
    case 'workspace.updated':
      invalidate(['workspaces', 'workspace']);
      break;
    case 'members.changed':
      invalidate(['members', 'bundle', 'invites', 'workspaces', 'dashboard']);
      break;
    case 'notification':
      setQueryData<{ items: Notification[]; unread: number }>('notifications', (prev) => (prev ? { items: [e.notification, ...prev.items].slice(0, 200), unread: prev.unread + 1 } : prev));
      break;
    case 'presence':
      presenceStore.set({ users: e.users });
      break;
    case 'activity':
      setQueryData<Activity[]>(`activity:${e.activity.workspaceId}`, (prev) => (prev ? [e.activity, ...prev].slice(0, 200) : prev));
      if (e.activity.projectId) setQueryData<Activity[]>(`activity:project:${e.activity.projectId}`, (prev) => (prev ? [e.activity, ...prev].slice(0, 200) : prev));
      if (e.activity.taskId) setQueryData<Activity[]>(`activity:task:${e.activity.taskId}`, (prev) => (prev ? [e.activity, ...prev] : prev));
      break;
    default:
      break;
  }
  const set = handlers.get(e.type);
  if (set) for (const h of set) h(e);
  const all = handlers.get('*');
  if (all) for (const h of all) h(e);
}

export function onRealtime(type: RealtimeEvent['type'] | '*', handler: Handler) {
  let set = handlers.get(type);
  if (!set) {
    set = new Set();
    handlers.set(type, set);
  }
  set.add(handler);
  return () => {
    set!.delete(handler);
  };
}

async function open() {
  if (!currentWorkspace) return;
  let token = tokenStore.get();
  if (!token) token = await refreshAccessToken();
  if (!token || !currentWorkspace) return;
  source?.close();
  const url = `/api/events?workspace=${encodeURIComponent(currentWorkspace)}&token=${encodeURIComponent(token)}${currentLocation ? `&location=${encodeURIComponent(currentLocation)}` : ''}`;
  const es = new EventSource(url);
  source = es;
  es.onopen = () => {
    backoff = 1000;
    uiStore.set({ realtimeConnected: true });
    // We may have missed events while disconnected — refresh the important lists.
    invalidate(['tasks', 'notifications', 'dashboard', 'bundle', 'projects']);
  };
  es.onmessage = (m) => {
    try {
      applyEvent(JSON.parse(m.data) as RealtimeEvent);
    } catch (err) {
      console.warn('[realtime] bad event', err);
    }
  };
  es.onerror = () => {
    uiStore.set({ realtimeConnected: false });
    es.close();
    if (source === es) {
      source = null;
      scheduleReconnect();
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = window.setTimeout(async () => {
    reconnectTimer = null;
    backoff = Math.min(backoff * 2, 15_000);
    // token may have expired → refresh before reconnecting
    await refreshAccessToken();
    void open();
  }, backoff);
}

export const realtime = {
  connect(workspaceId: string) {
    if (currentWorkspace === workspaceId && source) return;
    currentWorkspace = workspaceId;
    presenceStore.set({ users: [] });
    void open();
  },
  disconnect() {
    currentWorkspace = null;
    source?.close();
    source = null;
    uiStore.set({ realtimeConnected: false });
    presenceStore.set({ users: [] });
  },
  setLocation(location: string | null) {
    if (location === currentLocation) return;
    currentLocation = location;
    if (currentWorkspace) void api.post('/api/presence', { workspaceId: currentWorkspace, location }).catch(() => {});
  },
  get connected() {
    return Boolean(source);
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentWorkspace && !source) void open();
  });
  window.addEventListener('online', () => {
    if (currentWorkspace && !source) void open();
  });
}
