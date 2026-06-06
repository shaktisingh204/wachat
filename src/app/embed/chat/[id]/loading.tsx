export default function EmbedLoading() {
  return (
    <main
      className="bg-[var(--st-bg)] flex flex-col"
      style={{
        margin: 0,
        padding: 0,
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <header
        className="flex items-center justify-between border-b border-[var(--st-border)] bg-slate-100"
        style={{
          padding: '12px 16px',
          height: '45px',
        }}
      >
        <div className="skeleton" style={{ width: '120px', height: '16px', borderRadius: '4px' }} />
        <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
      </header>
      <div
        className="border-b border-[var(--st-border)]"
        style={{ padding: '12px 16px' }}
      >
        <div className="skeleton" style={{ width: '65%', height: '14px', borderRadius: '4px' }} />
      </div>
      <section
        className="flex-1 flex flex-col"
        style={{ padding: 24, gap: 16 }}
      >
        <div className="skeleton" style={{ alignSelf: 'flex-start', width: '75%', height: '40px', borderRadius: '12px', borderBottomLeftRadius: '4px' }} />
        <div className="skeleton" style={{ alignSelf: 'flex-start', width: '55%', height: '40px', borderRadius: '12px', borderBottomLeftRadius: '4px' }} />
        <div className="skeleton" style={{ alignSelf: 'flex-end', width: '65%', height: '40px', borderRadius: '12px', borderBottomRightRadius: '4px' }} />
        <div className="skeleton" style={{ alignSelf: 'flex-start', width: '85%', height: '40px', borderRadius: '12px', borderBottomLeftRadius: '4px' }} />
      </section>
      <div
        className="flex border-t border-[var(--st-border)]"
        style={{ padding: '16px', gap: '8px' }}
      >
        <div className="skeleton flex-1" style={{ height: '40px', borderRadius: '20px' }} />
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
