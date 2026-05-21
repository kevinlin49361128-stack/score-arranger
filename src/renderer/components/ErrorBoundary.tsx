/**
 * ErrorBoundary — 攔截 React 渲染錯誤, 在畫面上顯示堆疊.
 * 比預設「空白螢幕」好調試很多.
 */

import React from "react";

import { t } from "../utils/i18n";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  info: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({ error, info });
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          color: "#e0e0e0",
          background: "#1a1a1a",
          fontFamily: "ui-monospace, monospace",
          fontSize: 13,
          height: "100vh",
          overflow: "auto",
        }}>
          <h2 style={{ color: "#ff6b6b", marginTop: 0 }}>
            {t("app.rendererError")}
          </h2>
          <div style={{ marginBottom: 12 }}>
            <strong>{this.state.error.name}:</strong>{" "}
            {this.state.error.message}
          </div>
          <pre style={{
            background: "#000",
            padding: 12,
            borderRadius: 4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>
            {this.state.error.stack}
          </pre>
          {this.state.info && (
            <pre style={{
              background: "#000",
              padding: 12,
              borderRadius: 4,
              marginTop: 12,
              whiteSpace: "pre-wrap",
            }}>
              {this.state.info.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
