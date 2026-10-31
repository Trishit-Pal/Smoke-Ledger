'use client';

import * as React from 'react';
import { INPUT_STYLE } from '@web/lib/auth/inputStyle';

// ThemedSelect — an accessible, theme-aware dropdown used where a native
// <select>'s option popup can't be themed cross-browser. The popup background
// tracks the active theme (var(--bg)), option text is the theme's foreground
// (var(--text), the near-opposite of the background), and the currently
// selected option is highlighted with the brand accent. Tracks light/dark live
// because every color is a CSS variable resolved at paint.

export interface ThemedSelectOption {
  value: string;
  label: string;
}

interface ThemedSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  hasError?: boolean;
}

export function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  ariaLabel,
  hasError,
}: ThemedSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  // Per-instance prefix so option ids don't collide when multiple ThemedSelects
  // coexist on a page (keeps aria-activedescendant correct for screen readers).
  const optionId = React.useId();
  const listId = `${optionId}-list`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : '';

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // On open, focus the list and highlight the selected (or first) option.
  React.useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    listRef.current?.focus();
    // selectedIndex intentionally read once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Closing the list unmounts the focused element, which would drop focus to
  // <body>; hand it back to the trigger so keyboard users keep their place.
  const closeAndRefocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const commit = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    closeAndRefocus();
  };

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeAndRefocus();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className="focus-ring"
        style={{
          ...INPUT_STYLE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
          cursor: 'pointer',
          color: selectedLabel ? 'var(--text)' : 'var(--text-faint)',
          borderBottomColor: hasError ? 'var(--warn-earth)' : 'var(--rule)',
        }}
      >
        <span>{selectedLabel || placeholder}</span>
        <span aria-hidden style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
          ▾
        </span>
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={activeIndex >= 0 ? `${optionId}-${activeIndex}` : undefined}
          onKeyDown={onListKeyDown}
          style={{
            position: 'absolute',
            zIndex: 50,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: 'none',
            // Background tracks the active theme; text is its opposite.
            background: 'var(--bg)',
            border: '1px solid var(--rule-strong)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-card)',
            maxHeight: 240,
            overflowY: 'auto',
            outline: 'none',
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${optionId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: isSelected ? 'var(--accent-ink)' : 'var(--text)',
                  background: isSelected
                    ? 'var(--accent-soft)'
                    : isActive
                      ? 'var(--rule)'
                      : 'transparent',
                  // Marker so the keyboard-active row is visible even in dark mode.
                  boxShadow: isActive ? 'inset 3px 0 0 var(--accent-ink)' : undefined,
                }}
              >
                <span>{opt.label}</span>
                {isSelected ? (
                  <span aria-hidden style={{ color: 'var(--accent-ink)' }}>
                    ✓
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default ThemedSelect;
