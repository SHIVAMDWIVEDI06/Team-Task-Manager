// STUB — replaced by the command palette feature.
import { uiStore } from '../../lib/store.ts';
import { Dialog } from '../../ui/overlays.tsx';
export function CommandPalette({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const open = uiStore.use((s) => s.commandOpen);
  void onOpenShortcuts;
  return <Dialog open={open} onClose={() => uiStore.set({ commandOpen: false })} title="Command palette">Coming soon</Dialog>;
}
