import { Component, type ReactNode } from 'react';
import { Button, EmptyState } from '../ui/primitives.tsx';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[ui] render error', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="page">
          <EmptyState
            icon="alert-triangle"
            title="Something went wrong"
            description={this.state.error.message}
            action={
              <div className="row gap-2">
                <Button variant="secondary" onClick={() => this.setState({ error: null })}>
                  Try again
                </Button>
                <Button variant="primary" onClick={() => window.location.reload()}>
                  Reload
                </Button>
              </div>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
