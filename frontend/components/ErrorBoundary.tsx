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
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black px-4">
          <div className="max-w-md w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <span className="text-red-600 dark:text-red-400 text-lg font-bold">!</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Something went wrong</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              The dashboard encountered an unexpected error. Reloading may resolve the issue.
            </p>
            {this.state.error && (
              <p className="mt-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="mt-6 rounded-full bg-zinc-900 dark:bg-zinc-100 px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
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
