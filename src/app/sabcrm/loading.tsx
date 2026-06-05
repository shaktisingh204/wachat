import '@/components/sabcrm/20ui/surface-crm-base.css';

/**
 * SabCRM root loading skeleton — Twenty design system (`.st-*`), NOT ZoruUI.
 *
 * Matches the overview/index layout: page header + grid of object cards.
 * Each card shows a title line, a body block, and a footer chip/count row.
 */
export default function SabcrmLoading() {
  return (
    <div className="sabcrm-twenty">
      <main className="st-page" aria-busy="true" aria-label="Loading SabCRM">
        <header className="st-page-header">
          <span className="st-page-header__icon" aria-hidden="true">
            <span
              className="st-skeleton"
              style={{ width: 16, height: 16, borderRadius: 4 }}
            />
          </span>
          <span
            className="st-skeleton"
            style={{ width: 120, height: 18, display: 'inline-block' }}
          />
        </header>

        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 'var(--st-space-3)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <div className="st-panel" style={{ padding: 'var(--st-space-4)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--st-space-3)',
                  }}
                >
                  <span
                    className="st-skeleton"
                    style={{ width: 128, height: 16, display: 'inline-block' }}
                  />
                  <span
                    className="st-skeleton"
                    style={{ width: 40, height: 16, display: 'inline-block' }}
                  />
                </div>
                <span
                  className="st-skeleton"
                  style={{
                    width: '100%',
                    height: 36,
                    display: 'block',
                    marginTop: 'var(--st-space-3)',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--st-space-2)',
                    marginTop: 'var(--st-space-3)',
                  }}
                >
                  <span
                    className="st-skeleton"
                    style={{ width: 72, height: 20, display: 'inline-block' }}
                  />
                  <span
                    className="st-skeleton"
                    style={{ width: 56, height: 14, display: 'inline-block' }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
