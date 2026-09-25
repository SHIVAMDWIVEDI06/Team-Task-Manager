// STUB — replaced by the real view.
import type { ViewProps } from './types.ts';
import { EmptyState } from '../../../ui/primitives.tsx';
export function ListView(props: ViewProps) {
  return <EmptyState icon="sparkles" title="ListView" description={`${props.tasks.length} tasks · being built`} />;
}
