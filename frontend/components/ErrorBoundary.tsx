'use client';

import {Component, ReactNode} from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: {componentStack: string}) {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
          <div className="max-w-md w-full rounded-xl border border-border bg-surface p-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-danger/10 flex items-center justify-center">
              <span className="text-danger text-lg font-bold">!</span>
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
            <p className="mt-2 text-sm text-text-secondary">
              The dashboard encountered an unexpected error. Reloading may resolve the issue.
            </p>
            {this.state.error && (
              <p className="mt-2 text-xs font-mono text-text-secondary break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-muted transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
