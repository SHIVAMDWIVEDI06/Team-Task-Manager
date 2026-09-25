// STUB — replaced by the real page.
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { EmptyState } from '../../ui/primitives.tsx';
export function ProjectPage() {
  useTopbar([{ label: 'ProjectPage' }]);
  return <div className="page"><EmptyState icon="sparkles" title="ProjectPage" description="This page is being built." /></div>;
}
