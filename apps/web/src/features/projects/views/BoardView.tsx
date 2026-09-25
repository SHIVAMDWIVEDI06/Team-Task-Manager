// STUB — replaced by the real view.
import type { ViewProps } from './types.ts';
import { EmptyState } from '../../../ui/primitives.tsx';
export function BoardView(props: ViewProps) {
  return <EmptyState icon="sparkles" title="BoardView" description={`${props.tasks.length} tasks · being built`} />;
}
