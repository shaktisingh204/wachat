import * as React from 'react';
import { Input, IconButton, Button, Card, CardBody } from '@/components/sabcrm/20ui';
import { Trash2, Plus } from 'lucide-react';
import { BUTTON_TYPES, ButtonData } from '../constants';

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
        <h3 className="text-[13px] font-semibold text-[var(--st-text)]">
          Buttons ({buttons.length}/10)
        </h3>
      </div>

      {buttons.map((btn, i) => (
        <Card key={i} variant="outlined" padding="sm">
          <CardBody>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">
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
          </CardBody>
        </Card>
      ))}

      {buttons.length < 10 && (
        <div className="flex flex-wrap gap-1.5">
          {BUTTON_TYPES.map((bt) => (
            <Button
              key={bt.id}
              variant="outline"
              size="sm"
              iconLeft={Plus}
              onClick={() => addButton(bt.id)}
            >
              {bt.name}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}
