// Pointer-based drag and drop with sortable lists (no deps). Works with mouse, touch and pen.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createStore } from './store.ts';

export interface DragData {
  [k: string]: unknown;
}
export interface Over {
  id: string;
  data: DragData;
  /** Index within a sortable droppable (position the item would take). */
  index: number | null;
}
export interface DragState {
  activeId: string | null;
  activeData: DragData;
  over: Over | null;
  x: number;
  y: number;
}
export interface DropResult {
  activeId: string;
  activeData: DragData;
  over: Over | null;
}

const dragStore = createStore<DragState>({ activeId: null, activeData: {}, over: null, x: 0, y: 0 });
export const useDragState = dragStore.use;

interface Ctx {
  start: (e: React.PointerEvent, id: string, data: DragData, el: HTMLElement) => void;
  registerDroppable: (id: string, data: DragData, el: HTMLElement) => () => void;
}
const DndCtx = createContext<Ctx | null>(null);

interface DroppableReg {
  id: string;
  data: DragData;
  el: HTMLElement;
}

export function DndProvider({ children, onDragEnd, renderOverlay }: { children: ReactNode; onDragEnd: (r: DropResult) => void; renderOverlay?: (state: DragState) => ReactNode }) {
  const droppables = useRef(new Map<string, DroppableReg>());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [overlay, setOverlay] = useState<{ width: number; height: number; offsetX: number; offsetY: number } | null>(null);
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const state = dragStore.use();

  const registerDroppable = useCallback((id: string, data: DragData, el: HTMLElement) => {
    droppables.current.set(id, { id, data, el });
    return () => {
      droppables.current.delete(id);
    };
  }, []);

  const start = useCallback((e: React.PointerEvent, id: string, data: DragData, el: HTMLElement) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    let active = false;
    let raf = 0;
    let lastX = startX;
    let lastY = startY;
    const pointerId = e.pointerId;

    const computeOver = (x: number, y: number): Over | null => {
      const stack = document.elementsFromPoint(x, y);
      for (const node of stack) {
        const dropEl = (node as HTMLElement).closest?.('[data-droppable-id]') as HTMLElement | null;
        if (!dropEl) continue;
        const reg = droppables.current.get(dropEl.dataset.droppableId!);
        if (!reg) continue;
        // sortable index: compare against item midpoints
        const items = [...dropEl.querySelectorAll<HTMLElement>('[data-sortable-id]')].filter((it) => it.dataset.sortableId !== id && it.closest('[data-droppable-id]') === dropEl);
        let index: number | null = null;
        if (dropEl.dataset.sortable === 'true') {
          index = items.length;
          const horizontal = dropEl.dataset.sortableAxis === 'x';
          for (let i = 0; i < items.length; i++) {
            const r = items[i].getBoundingClientRect();
            const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2;
            if ((horizontal ? x : y) < mid) {
              index = i;
              break;
            }
          }
        }
        return { id: reg.id, data: reg.data, index };
      }
      return null;
    };

    const autoScroll = (x: number, y: number) => {
      const margin = 48;
      const speed = 14;
      let el: HTMLElement | null = document.elementFromPoint(x, y) as HTMLElement | null;
      while (el) {
        const style = getComputedStyle(el);
        const canY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
        const canX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
        if (canY || canX) {
          const r = el.getBoundingClientRect();
          if (canY) {
            if (y < r.top + margin) el.scrollTop -= speed;
            else if (y > r.bottom - margin) el.scrollTop += speed;
          }
          if (canX) {
            if (x < r.left + margin) el.scrollLeft -= speed;
            else if (x > r.right - margin) el.scrollLeft += speed;
          }
        }
        el = el.parentElement;
      }
    };

    const tick = () => {
      raf = 0;
      if (!active) return;
      if (overlayRef.current) overlayRef.current.style.transform = `translate(${lastX - (startX - rect.left)}px, ${lastY - (startY - rect.top)}px)`;
      autoScroll(lastX, lastY);
      const over = computeOver(lastX, lastY);
      const prev = dragStore.get().over;
      if (prev?.id !== over?.id || prev?.index !== over?.index) dragStore.set({ over });
      dragStore.set({ x: lastX, y: lastY });
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!active) {
        if (Math.abs(lastX - startX) < 5 && Math.abs(lastY - startY) < 5) return;
        active = true;
        dragStore.set({ activeId: id, activeData: data, over: null, x: lastX, y: lastY });
        setOverlay({ width: rect.width, height: rect.height, offsetX: startX - rect.left, offsetY: startY - rect.top });
        document.body.classList.add('dragging');
        try {
          el.setPointerCapture?.(pointerId);
        } catch {
          /* ignore */
        }
      }
      ev.preventDefault();
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const finish = (cancelled: boolean) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKey);
      if (raf) cancelAnimationFrame(raf);
      if (active) {
        const s = dragStore.get();
        const over = cancelled ? null : computeOver(lastX, lastY);
        document.body.classList.remove('dragging');
        dragStore.set({ activeId: null, activeData: {}, over: null });
        setOverlay(null);
        if (!cancelled) onDragEndRef.current({ activeId: id, activeData: s.activeData, over });
        // swallow the click that follows a drag
        const swallow = (ce: MouseEvent) => {
          ce.stopPropagation();
          ce.preventDefault();
        };
        document.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 50);
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      finish(false);
    };
    const onCancel = () => finish(true);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') finish(true);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
  }, []);

  const ctx = useMemo(() => ({ start, registerDroppable }), [start, registerDroppable]);

  return (
    <DndCtx.Provider value={ctx}>
      {children}
      {overlay &&
        state.activeId &&
        createPortal(
          <div
            ref={overlayRef}
            className="dnd-overlay"
            style={{ position: 'fixed', left: 0, top: 0, width: overlay.width, height: overlay.height, pointerEvents: 'none', zIndex: 9999, transform: `translate(${state.x - overlay.offsetX}px, ${state.y - overlay.offsetY}px)` }}
          >
            {renderOverlay ? renderOverlay(state) : null}
          </div>,
          document.body,
        )}
    </DndCtx.Provider>
  );
}

export function useDraggable(id: string, data: DragData = {}, disabled = false) {
  const ctx = useContext(DndCtx);
  const activeId = dragStore.use((s) => s.activeId);
  const ref = useRef<HTMLElement | null>(null);
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || !ctx) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, textarea, select, [data-no-drag]')) return;
      const el = (e.currentTarget as HTMLElement) || ref.current;
      ctx.start(e, id, data, el);
    },
    [ctx, id, data, disabled],
  );
  return {
    ref,
    isDragging: activeId === id,
    attributes: { onPointerDown, 'data-sortable-id': id, style: activeId === id ? { opacity: 0.35 } : undefined } as Record<string, unknown>,
  };
}

export function useDroppable(id: string, data: DragData = {}, opts: { sortable?: boolean; axis?: 'x' | 'y' } = {}) {
  const ctx = useContext(DndCtx);
  const ref = useRef<HTMLElement | null>(null);
  const over = dragStore.use((s) => s.over);
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    if (!ctx || !ref.current) return;
    return ctx.registerDroppable(id, dataRef.current, ref.current);
  }, [ctx, id]);
  return {
    ref,
    isOver: over?.id === id,
    overIndex: over?.id === id ? over.index : null,
    attributes: { 'data-droppable-id': id, 'data-sortable': opts.sortable ? 'true' : undefined, 'data-sortable-axis': opts.axis } as Record<string, unknown>,
  };
}
