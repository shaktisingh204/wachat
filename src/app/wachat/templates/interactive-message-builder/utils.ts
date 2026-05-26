export type MsgType = 'buttons' | 'list' | 'product' | 'location_request' | 'flow' | 'carousel';

export interface ListRow {
  title: string;
  description: string;
  id?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface CarouselCard {
  title: string;
  body: string;
  buttonLabel: string;
}

export interface InteractiveButton {
  label: string;
  id: string;
}

export interface InteractiveMessageState {
  msgType: MsgType;
  body: string;
  buttons: InteractiveButton[];
  sections: ListSection[];
  flowId?: string;
  flowCta?: string;
  flowToken?: string;
  carouselCards?: CarouselCard[];
}

export function buildInteractivePayload(state: InteractiveMessageState): any {
  const { msgType, body, buttons, sections, flowId, flowCta, flowToken, carouselCards } = state;
  const payload: any = {
    type: 'interactive',
    interactive: { type: msgType, body: { text: body } },
  };

  if (msgType === 'buttons') {
    payload.interactive.action = {
      buttons: (buttons || [])
        .filter(b => b.label)
        .map((b, i) => ({ type: 'reply', reply: { id: b.id || `btn_${i}`, title: b.label } })),
    };
  } else if (msgType === 'list') {
    payload.interactive.action = {
      button: 'Menu',
      sections: sections.map((s, si) => ({
        title: s.title,
        rows: s.rows.map((r, ri) => ({
          id: r.id || `row_${si}_${ri}`,
          title: r.title,
          description: r.description,
        })),
      })),
    };
  } else if (msgType === 'location_request') {
    payload.interactive.action = { name: 'send_location' };
  } else if (msgType === 'flow') {
    payload.interactive.action = {
      name: 'flow',
      parameters: {
        flow_message_version: '3',
        flow_token: flowToken || 'default_token',
        flow_id: flowId || 'YOUR_FLOW_ID',
        flow_cta: flowCta || 'Open Flow',
        flow_action: 'navigate',
        flow_action_payload: {
          screen: 'START'
        }
      }
    };
  } else if (msgType === 'carousel') {
    payload.interactive.type = 'carousel';
    payload.interactive.cards = (carouselCards || []).map((c, i) => ({
      card_index: i,
      components: [
        { type: 'header', parameters: [{ type: 'text', text: c.title }] },
        { type: 'body', parameters: [{ type: 'text', text: c.body }] },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: 0,
          parameters: [{ type: 'payload', payload: `carousel_btn_${i}` }]
        }
      ]
    }));
  }

  return payload;
}
