// STUB — replaced by the real page.
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { EmptyState } from '../../ui/primitives.tsx';
export function TeamPage() {
  useTopbar([{ label: 'TeamPage' }]);
  return <div className="page"><EmptyState icon="sparkles" title="TeamPage" description="This page is being built." /></div>;
}
