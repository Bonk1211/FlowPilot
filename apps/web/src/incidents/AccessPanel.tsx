import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Flask, LockKey, SignOut } from "@phosphor-icons/react";
import {
  loadIncidentAccess,
  setIncidentToken,
  type IncidentAccess,
} from "./api";
import "./access.css";

type AccessState = IncidentAccess & { signOut: () => void };
const AccessContext = createContext<AccessState | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- Shared access state for incident feature controls.
export function useIncidentAccess() {
  const access = useContext(AccessContext);
  if (!access)
    throw new Error("Incident controls require the access provider.");
  return access;
}

export function AccessStatus() {
  const access = useIncidentAccess();
  if (access.mode === "demo")
    return <span className="incident-access-demo">Local demo roles</span>;
  return (
    <div className="incident-access-status">
      <span>Signed in as {access.subject}</span>
      <button onClick={access.signOut}>
        <SignOut aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

export function AccessPanel({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<IncidentAccess | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadIncidentAccess()
      .then((value) => {
        if (active) setAccess(value);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Access could not be checked.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function signOut() {
    setIncidentToken(null);
    setToken("");
    setError("");
    setAccess((value) =>
      value
        ? { ...value, subject: null, authenticated: false, permissions: [] }
        : null,
    );
  }

  if (
    access &&
    (access.mode === "demo" ||
      (access.authenticated && access.permissions.includes("view")))
  ) {
    return (
      <AccessContext.Provider value={{ ...access, signOut }}>
        {children}
      </AccessContext.Provider>
    );
  }
  return (
    <div className="incident-app incident-access-page">
      <a className="wordmark" href="/incidents">
        <Flask aria-hidden="true" />
        FlowPilot
      </a>
      <main className="incident-access-panel">
        <LockKey aria-hidden="true" className="incident-access-icon" />
        <p className="eyebrow">S932 incident workspace</p>
        <h1>
          {loading && !access ? "Checking access…" : "Sign in to investigate"}
        </h1>
        {error && (
          <p role="alert" className="incident-access-error">
            {error}
          </p>
        )}
        {loading && <p role="status">Connecting to the incident service…</p>}
        {access?.mode === "configured" && (
          <>
            <p>
              Use the access token provided by your workspace administrator. It
              stays in this browser tab's session.
            </p>
            {access.authenticated && !access.permissions.includes("view") && (
              <p role="alert">
                This account does not have permission to view incidents. Sign in
                with an account granted incident access.
              </p>
            )}
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setLoading(true);
                setError("");
                try {
                  setIncidentToken(token.trim());
                  const result = await loadIncidentAccess();
                  if (!result.authenticated) {
                    setIncidentToken(null);
                    setError(
                      "That token was not accepted. Check your access token and try again.",
                    );
                    return;
                  }
                  setToken("");
                  setAccess(result);
                } catch (cause) {
                  setIncidentToken(null);
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Sign in failed. Try again.",
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              <label>
                Workspace access token
                <input
                  type="password"
                  autoComplete="current-password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                  spellCheck={false}
                />
              </label>
              <button className="primary" disabled={loading || !token.trim()}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </>
        )}
        {!loading && !access && (
          <button
            onClick={() => {
              setLoading(true);
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Retry access check
          </button>
        )}
      </main>
    </div>
  );
}
