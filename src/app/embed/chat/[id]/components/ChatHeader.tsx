'use client';

interface ChatHeaderProps {
  widgetName: string;
  primaryColor: string;
  onClose: () => void;
  isOnline: boolean;
}

export function ChatHeader({ widgetName, primaryColor, onClose, isOnline }: ChatHeaderProps) {
  return (
    <header
      style={{
        padding: '12px 16px',
        background: primaryColor,
        color: 'var(--st-text-inverted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <strong style={{ fontSize: 14 }}>{widgetName}</strong>
        <span
          title={isOnline ? 'Online' : 'Offline'}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isOnline ? 'var(--st-status-ok)' : 'var(--st-danger)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.2)',
            transition: 'background-color 0.3s ease',
          }}
        />
      </div>
      <button
        type="button"
        aria-label="Close chat"
        onClick={onClose}
        style={{
          background: 'transparent',
          color: 'var(--st-text-inverted)',
          border: 0,
          fontSize: 18,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        {'×'}
      </button>
    </header>
  );
}
