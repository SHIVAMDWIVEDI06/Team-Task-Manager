// STUB — replaced by the real view.
import type { ViewProps } from './types.ts';
import { EmptyState } from '../../../ui/primitives.tsx';
export function TimelineView(props: ViewProps) {
  return <EmptyState icon="sparkles" title="TimelineView" description={`${props.tasks.length} tasks · being built`} />;
}
