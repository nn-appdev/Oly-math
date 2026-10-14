import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPage } from '@/pages/ErrorPage';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Hanya jenis galat dan jejak komponen; tidak mencatat data pengguna.
    console.error('Galat tak tertangani:', error.name, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? <ErrorPage /> : this.props.children;
  }
}
