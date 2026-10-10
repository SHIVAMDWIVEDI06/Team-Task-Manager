// Floating-element positioning (portal + fixed coordinates + flip), shared by Popover, Menu, Tooltip, Select.
import { useLayoutEffect, useState, type RefObject } from 'react';

export type Placement = 'bottom' | 'top' | 'right' | 'left';
export type Align = 'start' | 'center' | 'end';

export interface FloatingOptions {
  placement?: Placement;
  align?: Align;
  offset?: number;
  matchWidth?: boolean;
}

export interface FloatingPosition {
  top: number;
  left: number;
  width?: number;
  maxHeight: number;
  placement: Placement;
}

export function computePosition(anchor: DOMRect, panel: { width: number; height: number }, opts: FloatingOptions): FloatingPosition {
  const { placement = 'bottom', align = 'start', offset = 6 } = opts;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  let p = placement;
  // flip vertically if needed
  if (p === 'bottom' && anchor.bottom + offset + panel.height > vh - pad && anchor.top - offset - panel.height > pad) p = 'top';
  else if (p === 'top' && anchor.top - offset - panel.height < pad && anchor.bottom + offset + panel.height < vh - pad) p = 'bottom';
  if (p === 'right' && anchor.right + offset + panel.width > vw - pad && anchor.left - offset - panel.width > pad) p = 'left';
  else if (p === 'left' && anchor.left - offset - panel.width < pad) p = 'right';

  let top = 0;
  let left = 0;
  if (p === 'bottom' || p === 'top') {
    top = p === 'bottom' ? anchor.bottom + offset : anchor.top - offset - panel.height;
    left = align === 'start' ? anchor.left : align === 'end' ? anchor.right - panel.width : anchor.left + anchor.width / 2 - panel.width / 2;
  } else {
    left = p === 'right' ? anchor.right + offset : anchor.left - offset - panel.width;
    top = align === 'start' ? anchor.top : align === 'end' ? anchor.bottom - panel.height : anchor.top + anchor.height / 2 - panel.height / 2;
  }
  left = Math.max(pad, Math.min(left, vw - panel.width - pad));
  top = Math.max(pad, Math.min(top, vh - panel.height - pad));
  const maxHeight = p === 'top' ? anchor.top - offset - pad : vh - top - pad;
  return { top, left, width: opts.matchWidth ? anchor.width : undefined, maxHeight: Math.max(120, maxHeight), placement: p };
}

/** Recomputes position on open, resize and scroll. */
export function useFloating(anchorRef: RefObject<HTMLElement | null>, panelRef: RefObject<HTMLElement | null>, open: boolean, opts: FloatingOptions, anchorRect?: DOMRect | null) {
  const [pos, setPos] = useState<FloatingPosition | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const a = anchorRect || anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!a || !panel) return;
      // measure natural size (reset maxHeight before measuring)
      panel.style.maxHeight = '';
      const r = panel.getBoundingClientRect();
      setPos(computePosition(a, { width: opts.matchWidth ? a.width : r.width, height: r.height }, opts));
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorRect, opts.placement, opts.align, opts.offset, opts.matchWidth]);
  return pos;
}
