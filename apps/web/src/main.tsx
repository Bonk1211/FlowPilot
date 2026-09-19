import {
  Component,
  lazy,
  StrictMode,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import { App } from "./App";
import { CaseApp } from "./CaseApp";
import { Prototype } from "./prototype/Prototype";
import "./styles.css";

// eslint-disable-next-line react-refresh/only-export-components -- This entry point mounts the app below.
const LearningDatabase = lazy(() =>
  import("./LearningDatabase").then((module) => ({
    default: module.LearningDatabase,
  })),
);

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>The workspace could not be displayed</h1>
        <p>Reload to try again. No case data has been changed.</p>
        <button onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {window.location.pathname.replace(/\/$/, "") === "/prototype" ? (
        <Prototype />
      ) : window.location.pathname.replace(/\/$/, "") === "/knowledge" ? (
        <Suspense
          fallback={
            <main className="fatal-error" role="status">
              Loading learning database…
            </main>
          }
        >
          <LearningDatabase />
        </Suspense>
      ) : window.location.pathname === "/log-preview" ? (
        <App />
      ) : (
        <CaseApp />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
