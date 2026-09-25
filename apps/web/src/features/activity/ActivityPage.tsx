// STUB — replaced by the real page.
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { EmptyState } from '../../ui/primitives.tsx';
export function ActivityPage() {
  useTopbar([{ label: 'ActivityPage' }]);
  return <div className="page"><EmptyState icon="sparkles" title="ActivityPage" description="This page is being built." /></div>;
}
