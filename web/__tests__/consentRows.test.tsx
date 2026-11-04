import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

(globalThis as { React?: typeof React }).React = React;

const { AgreementRow, HealthConsentRow, ChatChoiceRow, TickRow } = await import('@web/components/onboarding/ConsentRows');
const { AGREEMENT_LABEL_PARTS } = await import('@/lib/healthConsent');
const { LEDGER_CHAT_NOTICE } = await import('@web/components/chat/notice');

const noop = () => {};
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
// The static markup HTML-escapes apostrophes and quotes; compare against the same encoding.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

describe('AgreementRow', () => {
  const out = html(<AgreementRow checked={false} onChange={noop} number="01" />);

  test('renders one checkbox', () => {
    expect(out.match(/type="checkbox"/g)).toHaveLength(1);
  });

  test('the label wraps the full sentence and both links', () => {
    const { before, terms, middle, privacy, after } = AGREEMENT_LABEL_PARTS;
    const text = out.replace(/<[^>]+>/g, '');
    expect(text).toContain(`${before}${terms}${middle}${privacy}${after}`);
    expect(out).toContain('href="/terms"');
    expect(out).toContain('href="/privacy"');
  });

  test('is not pre-ticked', () => {
    expect(out).not.toContain('checked=""');
  });
});

describe('HealthConsentRow', () => {
  const out = html(<HealthConsentRow checked={false} onChange={noop} number="02" />);

  test('has a checkbox and no decline control or note', () => {
    expect(out.match(/type="checkbox"/g)).toHaveLength(1);
    expect(out).not.toContain('consent</button>');
    expect(out).not.toContain('<button');
    expect(out).not.toContain('role="status"');
  });
});

describe('ChatChoiceRow', () => {
  test('renders every notice paragraph', () => {
    const out = html(<ChatChoiceRow answer={null} onAnswer={noop} number="03" />);
    for (const paragraph of Object.values(LEDGER_CHAT_NOTICE)) expect(out).toContain(esc(paragraph));
  });

  test('renders two buttons, both unpressed while unanswered', () => {
    const out = html(<ChatChoiceRow answer={null} onAnswer={noop} number="03" />);
    expect(out).toContain('Yes, turn it on');
    expect(out).toContain('No, thanks');
    expect(out.match(/<button/g)).toHaveLength(2);
    expect(out.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(out).not.toContain('aria-pressed="true"');
  });

  test('aria-pressed follows the answer', () => {
    const yes = html(<ChatChoiceRow answer={true} onAnswer={noop} number="03" />);
    expect(yes).toMatch(/aria-pressed="true"[^>]*>Yes, turn it on/);
    expect(yes).toMatch(/aria-pressed="false"[^>]*>No, thanks/);
    const no = html(<ChatChoiceRow answer={false} onAnswer={noop} number="03" />);
    expect(no).toMatch(/aria-pressed="false"[^>]*>Yes, turn it on/);
    expect(no).toMatch(/aria-pressed="true"[^>]*>No, thanks/);
  });

  test('keeps the native disclosure marker on the summary', () => {
    const out = html(<ChatChoiceRow answer={null} onAnswer={noop} number="03" />);
    const summary = out.match(/<summary[^>]*>/)?.[0] ?? '';
    expect(summary).toContain('display:list-item');
    expect(summary).not.toContain('display:flex');
  });

  test('wraps everything after the lead in a details element', () => {
    const out = html(<ChatChoiceRow answer={null} onAnswer={noop} number="03" />);
    const lead = out.indexOf(esc(LEDGER_CHAT_NOTICE.lead));
    const open = out.indexOf('<details');
    const close = out.indexOf('</details>');
    expect(lead).toBeGreaterThan(-1);
    expect(open).toBeGreaterThan(lead);
    expect(out).toContain('Read the details');
    for (const key of ['scope', 'sent', 'discreet', 'retention', 'device'] as const) {
      const at = out.indexOf(esc(LEDGER_CHAT_NOTICE[key]));
      expect(at).toBeGreaterThan(open);
      expect(at).toBeLessThan(close);
    }
  });
});

describe('narrow screens (360 px)', () => {
  // The stamp column reserves ~125 px even while invisible, so below sm it must not render a box.

  test('the tick row hides its stamp wrapper below sm, with no inline display to override it', () => {
    const out = html(<TickRow checked={false} onChange={noop} number="03" rotate={-4} label="x" sub="y" />);
    const wrapper = out.match(/<div[^>]*class="hidden sm:flex[^"]*"[^>]*>/)?.[0];
    expect(wrapper).toBeDefined();
    expect(wrapper).not.toContain('display:');
  });

  test('the chat row header hides its stamp wrapper below sm too', () => {
    const out = html(<ChatChoiceRow answer={null} onAnswer={noop} number="04" />);
    const wrapper = out.match(/<div[^>]*class="hidden sm:flex[^"]*"[^>]*>/)?.[0];
    expect(wrapper).toBeDefined();
    expect(wrapper).not.toContain('display:');
  });

  test('every consent row keeps its printed number visible', () => {
    const out = html(<HealthConsentRow checked={false} onChange={noop} number="02" />);
    expect(out).toContain('>02<');
  });

  test('the Yes / No buttons are rounded like the sibling buttons', () => {
    const out = html(<ChatChoiceRow answer={null} onAnswer={noop} number="04" />);
    const buttons = out.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b).toContain('rounded-md');
  });
});

describe('ConsentRows source', () => {
  test('uses tokens, not colour literals', () => {
    const src = readFileSync(join(__dirname, '..', 'components', 'onboarding', 'ConsentRows.tsx'), 'utf8');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });
});
