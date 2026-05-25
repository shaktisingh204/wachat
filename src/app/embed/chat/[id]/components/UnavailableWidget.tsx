export function UnavailableWidget() {
  return (
    <main
      style={{
        margin: 0,
        padding: 24,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#111',
        background: '#fff',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Chat unavailable
        </h1>
        <p style={{ fontSize: 13, color: '#555' }}>
          This widget is not currently enabled or does not exist.
        </p>
      </div>
    </main>
  );
}
