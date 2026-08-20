import React from 'react';
import {getUserErrorMessage, logError} from '../lib/utils.ts';
import {trackEvent} from '../lib/analytics.ts';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: unknown;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {hasError: false, error: null};
    }

    static getDerivedStateFromError(error: Error) {
        return {hasError: true, error};
    }

    componentDidCatch(error: Error) {
        logError(error, 'React ErrorBoundary');
        // A crash is otherwise invisible: the user sees the fallback and leaves,
        // and nothing but their own console records it. This stays a class
        // component (hooks cannot catch render errors), hence the plain helper.
        //
        // The constructor name, never the message: messages here can carry a
        // dataset title, a file path or a query the user typed, none of which
        // belongs in Matomo, and every distinct one would be its own report row.
        // `logError` above keeps the full detail in the browser console.
        trackEvent('Error', 'react_boundary', error.name || 'Error');
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-100 text-red-800 rounded">
                    <h2 className="font-bold mb-2">Something went wrong.</h2>
                    <pre className="whitespace-pre-wrap text-xs">{getUserErrorMessage(this.state.error)}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

