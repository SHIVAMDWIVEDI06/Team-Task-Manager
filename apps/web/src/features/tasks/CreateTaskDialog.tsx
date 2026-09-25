// STUB — replaced by the create-task feature.
import { uiStore } from '../../lib/store.ts';
import { Dialog } from '../../ui/overlays.tsx';
export function CreateTaskHost() {
  const open = uiStore.use((s) => s.createTaskOpen);
  return <Dialog open={Boolean(open)} onClose={() => uiStore.set({ createTaskOpen: false })} title="New task">Coming soon</Dialog>;
}
