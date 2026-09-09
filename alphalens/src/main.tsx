import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '../styles.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-screen" style={{ padding: 30, color: '#f87171', background: '#0b0f19', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>應用程式發生錯誤 (React Error Boundary)</h1>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <strong id="error-message">Error: {this.state.error?.toString()}</strong>
          </div>
          <pre id="error-stack" style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: 'rgba(15, 23, 42, 0.8)', padding: 16, borderRadius: 8, border: '1px solid #1e293b' }}>
            {this.state.error?.stack}
            {'\n\nComponent Stack:\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button 
            onClick={() => { window.location.href = '/'; }}
            style={{ marginTop: 20, padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
          >
            返回首頁
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
