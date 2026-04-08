import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Application render error", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-black">Something went wrong</h1>
          <p className="text-zinc-400">
            The app hit an unexpected client-side error. Reload to recover.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-rose-600 px-5 py-2.5 font-medium text-white hover:bg-rose-500"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}