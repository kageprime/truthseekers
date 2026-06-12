"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#fffaf0] px-6">
          <div className="pixel-card p-8 max-w-md text-center bg-white">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="pixel text-sm mb-3" style={{ color: "var(--ink)" }}>
              Something went wrong
            </h1>
            <p className="text-sm text-[#5f6368] mb-4">
              The page encountered an unexpected error. Please try refreshing.
            </p>
            {this.state.error && process.env.NODE_ENV === "development" && (
              <details className="text-left mb-4">
                <summary className="text-xs cursor-pointer text-[#888]">Error details</summary>
                <pre className="text-xs mt-2 p-3 bg-[#f8f9fa] border border-[#dfe1e5] rounded overflow-auto max-h-40">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="btn-primary"
            >
              Try Again
            </button>
            <a
              href="/"
              className="block mt-3 text-sm text-[#5f6368] hover:text-[#ea580c]"
            >
              ← Back to home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
