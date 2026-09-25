// STUB — replaced by the real page.
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { EmptyState } from '../../ui/primitives.tsx';
export function InboxPage() {
  useTopbar([{ label: 'InboxPage' }]);
  return <div className="page"><EmptyState icon="sparkles" title="InboxPage" description="This page is being built." /></div>;
}
