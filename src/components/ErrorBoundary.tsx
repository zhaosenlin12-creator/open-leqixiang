import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Human label surfaced in dev console + the fallback UI for triage. */
  scope?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render-phase exceptions that would otherwise blank the entire
// app and shows a recoverable error panel instead. Logs to the console
// for diagnostics; the operator can hit Reload to recover.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Only the topmost boundary should log; nested boundaries dedupe via
    // a module-local set so a single crash doesn\'t flood the console.
    if (!loggedThisError(error)) {
      markLoggedError(error);
      // eslint-disable-next-line no-console
      console.error(`[ErrorBoundary]${this.props.scope ? '[' + this.props.scope + ']' : ''}`, error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      const scope = this.props.scope ?? 'section';
      return (
        <div
          role="alert"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            color: '#ffe17a',
            background: 'radial-gradient(circle at 50% 30%, rgba(255, 196, 0, 0.12), transparent 60%), #050608',
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <strong style={{ fontSize: 22 }}>{scope} 遇到错误</strong>
          <pre
            style={{
              maxWidth: '80vw',
              whiteSpace: 'pre-wrap',
              color: 'rgba(255, 255, 255, 0.78)',
              fontSize: 14
            }}
          >
{this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.reset}
            style={{
              padding: '10px 22px',
              border: '1px solid rgba(255, 196, 0, 0.6)',
              background: 'rgba(255, 196, 0, 0.18)',
              color: '#ffe17a',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 15
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const LOG_TTL_MS = 4000;
const logged = new WeakMap<Error, number>();

function loggedThisError(error: Error): boolean {
  const ts = logged.get(error);
  return typeof ts === 'number' && Date.now() - ts < LOG_TTL_MS;
}

function markLoggedError(error: Error): void {
  logged.set(error, Date.now());
}
