import { Dialog } from '../../ui/overlays.tsx';
import { Kbd } from '../../ui/primitives.tsx';
import { modKey } from '../../lib/format.ts';

const groups: { title: string; items: [string, string[]][] }[] = [
  {
    title: 'General',
    items: [
      ['Command palette / search', [modKey, 'K']],
      ['Create task', ['C']],
      ['Toggle sidebar', [modKey, 'B']],
      ['Show shortcuts', ['?']],
      ['Close panel / dialog', ['Esc']],
    ],
  },
  {
    title: 'Navigation',
    items: [
      ['Home', ['G', 'H']],
      ['My work', ['G', 'M']],
      ['Inbox', ['G', 'I']],
      ['Projects', ['G', 'P']],
      ['Team', ['G', 'T']],
      ['Activity', ['G', 'A']],
    ],
  },
  {
    title: 'Project views',
    items: [
      ['Board', ['1']],
      ['List', ['2']],
      ['Calendar', ['3']],
      ['Timeline', ['4']],
      ['Toggle filters', ['F']],
      ['List: move / open / select', ['J', 'K', '↵', 'X']],
      ['List: rename task', ['R']],
    ],
  },
  {
    title: 'Inbox',
    items: [
      ['Move between notifications', ['J', 'K']],
      ['Open notification', ['↵']],
      ['Toggle read / unread', ['E']],
      ['Delete notification', ['⌫']],
    ],
  },
  {
    title: 'Task',
    items: [
      ['Change status', ['S']],
      ['Change priority', ['P']],
      ['Assign', ['A']],
      ['Set due date', ['D']],
      ['Add label', ['L']],
      ['Next / previous task', ['J', 'K']],
      ['Copy task link', [modKey, 'Shift', 'C']],
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="lg">
      <div className="grid-2">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="section-title">{g.title}</div>
            <div className="col gap-2">
              {g.items.map(([label, keys]) => (
                <div key={label} className="row between">
                  <span className="secondary" style={{ fontSize: 'var(--fs-md)' }}>{label}</span>
                  <span className="row gap-1">
                    {keys.map((k, i) => (
                      <Kbd key={i}>{k}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
