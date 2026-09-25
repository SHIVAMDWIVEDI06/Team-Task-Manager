// STUB — replaced by the real view.
import type { ViewProps } from './types.ts';
import { EmptyState } from '../../../ui/primitives.tsx';
export function CalendarView(props: ViewProps) {
  return <EmptyState icon="sparkles" title="CalendarView" description={`${props.tasks.length} tasks · being built`} />;
}
