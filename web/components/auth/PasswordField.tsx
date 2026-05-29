'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { INPUT_STYLE } from '@web/lib/auth/inputStyle';

export type PasswordFieldProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'type'
>;

const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const TOGGLE_BUTTON_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  transition: 'color 140ms ease',
};

export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ style, className, ...inputProps }, forwardedRef) {
    const [revealed, setRevealed] = React.useState(false);

    const hide = React.useCallback(() => setRevealed(false), []);
    const show = React.useCallback(() => setRevealed(true), []);

    React.useEffect(() => {
      if (!revealed) return;
      const onBlur = () => hide();
      const onVisibility = () => {
        if (document.visibilityState !== 'visible') hide();
      };
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }, [revealed, hide]);

    const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      show();
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        show();
      }
    };

    const onKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.code === 'Space') {
        event.preventDefault();
        hide();
      }
    };

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={forwardedRef}
          type={revealed ? 'text' : 'password'}
          style={{ ...INPUT_STYLE, paddingRight: 36, ...style }}
          className={className ?? 'focus-ring'}
          {...inputProps}
        />
        <button
          type="button"
          aria-label={revealed ? 'Hide password' : 'Show password (press and hold)'}
          aria-controls={inputProps.id}
          tabIndex={0}
          className="focus-ring"
          style={{
            ...TOGGLE_BUTTON_STYLE,
            color: revealed ? 'var(--text)' : 'var(--text-muted)',
          }}
          onPointerDown={onPointerDown}
          onPointerUp={hide}
          onPointerLeave={hide}
          onPointerCancel={hide}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={hide}
          onContextMenu={(event) => event.preventDefault()}
        >
          {revealed ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
        <span aria-live="polite" style={SR_ONLY_STYLE}>
          {revealed ? 'Password visible' : 'Password hidden'}
        </span>
      </div>
    );
  },
);
