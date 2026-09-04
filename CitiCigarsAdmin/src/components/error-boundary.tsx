import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive text-destructive m-4">
          <h2 className="font-serif text-xl mb-2">Erreur système (R1)</h2>
          <pre className="text-xs font-mono whitespace-pre-wrap">{this.state.error?.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
