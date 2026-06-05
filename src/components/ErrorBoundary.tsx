import { Component, ErrorInfo, ReactNode } from 'react';

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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught extension error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-color)',
          height: '100vh',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ color: 'var(--indicator-color)', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ margin: '8px 0 24px 0', opacity: 0.8, maxWidth: '400px', fontSize: '14px', lineHeight: '1.5' }}>
            {this.state.error?.message || 'An unexpected error occurred in the extension.'}
          </p>
          <button
            className="btn primary"
            onClick={() => window.location.reload()}
            style={{ padding: '8px 20px' }}
          >
            Reload Extension
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
