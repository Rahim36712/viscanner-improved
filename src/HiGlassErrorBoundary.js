import React from "react";

export class HiGlassErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("HiGlassErrorBoundary caught rendering exception:", error, errorInfo);
    // Automatically attempt clean recovery after 50ms
    setTimeout(() => {
      this.setState((prevState) => ({
        hasError: false,
        errorCount: prevState.errorCount + 1,
      }));
    }, 50);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "#666", textAlign: "center" }}>
          <span>Resetting view...</span>
        </div>
      );
    }
    return this.props.children;
  }
}

export default HiGlassErrorBoundary;
