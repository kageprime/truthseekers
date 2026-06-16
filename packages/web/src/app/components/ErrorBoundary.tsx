"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import { IconAlert } from "./Icons";

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
          <div className="glass-card-static p-8 max-w-md text-center">
            <div className="mb-4"><IconAlert size={36} /></div>
            <h1 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Something went wrong
            </h1>
            <p className="text-sm text-[var(--muted)] mb-4">
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
              className="btn btn-primary"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="block mt-3 text-sm text-[var(--muted)] hover:text-[#ea580c]"
             
            >
              ← Back to home
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
