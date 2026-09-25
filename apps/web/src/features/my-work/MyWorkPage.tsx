// STUB — replaced by the real page.
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { EmptyState } from '../../ui/primitives.tsx';
export function MyWorkPage() {
  useTopbar([{ label: 'MyWorkPage' }]);
  return <div className="page"><EmptyState icon="sparkles" title="MyWorkPage" description="This page is being built." /></div>;
}
