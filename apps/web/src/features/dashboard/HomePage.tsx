// STUB — replaced by the real page.
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { EmptyState } from '../../ui/primitives.tsx';
export function HomePage() {
  useTopbar([{ label: 'HomePage' }]);
  return <div className="page"><EmptyState icon="sparkles" title="HomePage" description="This page is being built." /></div>;
}
