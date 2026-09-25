// STUB — replaced by the real page.
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { EmptyState } from '../../ui/primitives.tsx';
export function ProjectsPage() {
  useTopbar([{ label: 'ProjectsPage' }]);
  return <div className="page"><EmptyState icon="sparkles" title="ProjectsPage" description="This page is being built." /></div>;
}
