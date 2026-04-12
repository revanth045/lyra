
import React, { ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  info?: string;
}

/**
 * ErrorBoundary to catch UI crashes and display a fallback UI.
 */
// Fix: Use React.Component explicitly to ensure inheritance and visibility of setState and props in TypeScript environments.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Using class field for state initialization for better compatibility and cleaner code.
  public state: ErrorBoundaryState = {
    hasError: false,
    info: undefined
  };

  // Standard React static method to catch errors and update state before render.
  public static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  // Captures the error information when a child component crashes.
  public componentDidCatch(error: any, info: ErrorInfo) {
    // Log the error to an error reporting service
    console.error("UI crash:", error, info);
    // Fix: Correctly use setState inherited from React.Component base class to store error info.
    this.setState({ info: String(error?.message || error) });
  }

  public render(): React.ReactNode {
    // Fix: Access state inherited from React.Component base class.
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h3>Something went wrong.</h3>
          <p>Please try again or hit “Restore checkpoint”.</p>
          {this.state.info && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#fff8",
                padding: 12,
              }}
            >
              {this.state.info}
            </pre>
          )}
        </div>
      );
    }

    // Fix: Correctly access children from props inherited from React.Component base class.
    return this.props.children;
  }
}
