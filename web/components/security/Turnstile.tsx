'use client';

import * as React from 'react';
import Script from 'next/script';

/**
 * Lightweight Cloudflare Turnstile (free tier) widget.
 *
 * - Renders only if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in env. Otherwise
 *   `onToken(null)` is invoked once and the component returns nothing, so the
 *   surrounding form does not block.
 * - Token is short-lived (typically ~2 minutes); call `reset()` after every
 *   submit attempt so the user gets a fresh token on retry.
 * - Uses Next's <Script /> with the per-request nonce to remain CSP-compliant.
 *
 * To enable end-to-end:
 *   1. Create a free Turnstile site key + secret at https://dash.cloudflare.com/?to=/:account/turnstile
 *   2. In Supabase Dashboard → Auth → Settings, enable Captcha and paste the secret.
 *   3. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for the web app.
 *   4. Forms pass the resulting token via `options.captchaToken` on auth calls.
 */

type TurnstileWindow = Window & {
  turnstile?: {
    render: (
      container: HTMLElement,
      params: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
        size?: 'normal' | 'compact';
      },
    ) => string;
    reset: (widgetId?: string) => void;
    remove: (widgetId?: string) => void;
  };
};

interface Props {
  onToken: (token: string | null) => void;
  theme?: 'light' | 'dark' | 'auto';
}

export function TurnstileWidget({ onToken, theme = 'auto' }: Props): React.ReactElement | null {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!siteKey) {
      // No captcha configured — explicitly null so the form knows not to wait.
      onToken(null);
    }
    // We intentionally only fire onToken(null) once on mount when no site key
    // is configured; further token updates are driven by the widget callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!siteKey || !scriptLoaded || !containerRef.current) return;
    const w = window as TurnstileWindow;
    if (!w.turnstile) return;
    const id = w.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme,
      size: 'normal',
      callback: (token: string) => onToken(token),
      'expired-callback': () => onToken(null),
      'error-callback': () => onToken(null),
    });
    widgetIdRef.current = id;
    return () => {
      try {
        if (widgetIdRef.current && w.turnstile) {
          w.turnstile.remove(widgetIdRef.current);
        }
      } catch {
        // Widget cleanup is best-effort.
      }
    };
  }, [siteKey, scriptLoaded, theme, onToken]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} aria-label="Security check" />
    </>
  );
}

export function isCaptchaConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}
