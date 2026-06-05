export default function EmbedLoading() {
  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        height: '100vh',
        background: 'var(--st-bg)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <header
        style={{
          padding: '12px 16px',
          background: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '45px', // Approximate header height
          borderBottom: '1px solid var(--st-border)',
        }}
      >
        <div className="skeleton" style={{ width: '120px', height: '16px', borderRadius: '4px' }} />
        <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
      </header>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--st-border)' }}>
         <div className="skeleton" style={{ width: '65%', height: '14px', borderRadius: '4px' }} />
      </div>
      <section style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ alignSelf: 'flex-start', width: '75%', height: '40px', borderRadius: '12px', borderBottomLeftRadius: '4px' }} />
        <div className="skeleton" style={{ alignSelf: 'flex-start', width: '55%', height: '40px', borderRadius: '12px', borderBottomLeftRadius: '4px' }} />
        <div className="skeleton" style={{ alignSelf: 'flex-end', width: '65%', height: '40px', borderRadius: '12px', borderBottomRightRadius: '4px' }} />
        <div className="skeleton" style={{ alignSelf: 'flex-start', width: '85%', height: '40px', borderRadius: '12px', borderBottomLeftRadius: '4px' }} />
      </section>
      <div style={{ padding: '16px', borderTop: '1px solid var(--st-border)', display: 'flex', gap: '8px' }}>
        <div className="skeleton" style={{ flex: 1, height: '40px', borderRadius: '20px' }} />
        <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .skeleton {
          background: #e2e8f0;
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0,
            rgba(255, 255, 255, 0.4) 20%,
            rgba(255, 255, 255, 0.4) 60%,
            rgba(255, 255, 255, 0)
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}} />
    </main>
  );
}
