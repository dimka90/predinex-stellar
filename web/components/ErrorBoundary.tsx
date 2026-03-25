'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex items-center justify-center p-4">
                    <div className="glass p-8 rounded-2xl max-w-md w-full text-center space-y-6">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold">Something went wrong</h2>
                            <p className="text-muted-foreground">
                                An unexpected error occurred. We&apos;ve been notified and are looking into it.
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="bg-muted/50 p-4 rounded-lg text-left overflow-auto max-h-32 text-xs font-mono text-muted-foreground">
                                {this.state.error.message}
                            </div>
                        )}

                        <button
                            onClick={this.handleReset}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-black rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                        >
                            <RotateCcw className="w-4 h-4" />
                            RELOAD APPLICATION
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
