/**
 * Root component and step router for Marketing Signal.
 * Shell only — application logic implemented in Phase 1+.
 */

/**
 * App shell that will route between steps 1–8.
 * @returns Root JSX element
 */
export function App(): JSX.Element {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--amber)' }}>
        Marketing Signal
      </h1>
      <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>
        Time-Series Correlation Analyser — scaffold ready
      </p>
    </main>
  );
}
