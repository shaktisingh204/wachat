import * as React from 'react';
import { Input, IconButton } from '@/components/sabcrm/20ui';
import { Trash2, Plus } from 'lucide-react';
import { BUTTON_TYPES, ButtonData } from '../constants';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

interface ButtonManagerProps {
  buttons: ButtonData[];
  setButtons: (buttons: ButtonData[]) => void;
}

export function ButtonManager({
  buttons,
  setButtons,
}: ButtonManagerProps) {
  const addButton = (type: string) => {
    if (buttons.length >= 10) return;
    setButtons([...buttons, { type, text: '' }]);
  };

  const updateButton = (i: number, field: string, value: string) => {
    const updated = [...buttons];
    (updated[i] as any)[field] = value;
    setButtons(updated);
  };

  const removeButton = (i: number) => {
    setButtons(buttons.filter((_, idx) => idx !== i));
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h3
          className="text-[13px] font-semibold"
          style={{ color: 'var(--st-text)' }}
        >
          Buttons ({buttons.length}/10)
        </h3>
      </div>

      {buttons.map((btn, i) => (
        <div
          key={i}
          className="space-y-2 border p-3"
          style={{
            borderRadius: 'var(--st-radius)',
            borderColor: 'var(--st-border)',
            background: 'var(--st-bg-secondary)',
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--st-text-tertiary)' }}
            >
              {btn.type.replace('_', ' ')}
            </span>
            <IconButton
              label="Remove button"
              icon={Trash2}
              variant="ghost"
              size="sm"
              onClick={() => removeButton(i)}
            />
          </div>
          <Input
            value={btn.text}
            onChange={(e) =>
              updateButton(i, 'text', e.target.value)
            }
            placeholder="Button label"
          />
          {btn.type === 'URL' && (
            <>
              <Input
                value={btn.url || ''}
                onChange={(e) =>
                  updateButton(i, 'url', e.target.value)
                }
                placeholder="https://example.com/{{1}}"
              />
              {btn.url?.includes('{{') && (
                <Input
                  name={`btn_${i}_url_example`}
                  placeholder="URL variable example"
                  className="text-[11px]"
                />
              )}
            </>
          )}
          {btn.type === 'PHONE_NUMBER' && (
            <Input
              value={btn.phone_number || ''}
              onChange={(e) =>
                updateButton(i, 'phone_number', e.target.value)
              }
              placeholder="+1234567890"
            />
          )}
          {btn.type === 'COPY_CODE' && (
            <Input
              value={(btn.example || [''])[0]}
              onChange={(e) => {
                const updated = [...buttons];
                updated[i] = {
                  ...updated[i],
                  example: [e.target.value],
                };
                setButtons(updated);
              }}
              placeholder="Example code (e.g., ABC123)"
            />
          )}
        </div>
      ))}

      {buttons.length < 10 && (
        <div className="flex flex-wrap gap-1.5">
          {BUTTON_TYPES.map((bt) => (
            <button
              key={bt.id}
              type="button"
              onClick={() => addButton(bt.id)}
              className={cx(
                'flex items-center gap-1 border border-dashed px-2.5 py-1.5 text-[11px] transition-colors',
              )}
              style={{
                borderRadius: 'var(--st-radius)',
                borderColor: 'var(--st-border)',
                color: 'var(--st-text-tertiary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--st-border-strong)';
                e.currentTarget.style.color = 'var(--st-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--st-border)';
                e.currentTarget.style.color = 'var(--st-text-tertiary)';
              }}
            >
              <Plus className="h-3 w-3" /> {bt.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
