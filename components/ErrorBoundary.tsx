
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-50 min-h-screen text-red-900 font-mono overflow-auto">
                    <h1 className="text-2xl font-bold mb-4">¡Algo salió mal!</h1>
                    <p className="font-bold mb-2">Error:</p>
                    <pre className="bg-white p-4 rounded border border-red-200 mb-4 whitespace-pre-wrap">
                        {this.state.error?.toString()}
                    </pre>
                    <p className="font-bold mb-2">Component Stack:</p>
                    <pre className="bg-white p-4 rounded border border-red-200 whitespace-pre-wrap text-sm">
                        {this.state.errorInfo?.componentStack}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
