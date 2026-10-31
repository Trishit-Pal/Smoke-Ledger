'use client';

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

type BaseProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
  containerClassName?: string;
  multiline?: boolean;
  rows?: number;
};

export const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, BaseProps>(
  function Input(
    {
      label,
      hint,
      error,
      containerClassName,
      multiline = false,
      rows = 4,
      className,
      id,
      ...rest
    },
    ref,
  ) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const hasError = Boolean(error);

    const fieldClasses = cn(
      // Editorial underline field: hairline that strengthens on focus (the global
      // :focus-visible outline in globals.css supplies the keyboard ring).
      'w-full bg-transparent border-0 border-b rounded-none px-0 py-sm text-body text-text nums-tabular',
      'placeholder:text-text-faint transition-colors',
      hasError
        ? 'border-danger focus:border-danger'
        : 'border-[var(--rule)] focus:border-[var(--rule-strong)]',
      multiline && 'resize-y min-h-[88px]',
      className,
    );

    return (
      <div className={cn('flex flex-col', containerClassName)}>
        {label ? (
          <label
            htmlFor={inputId}
            className="editorial-caption mb-xs"
          >
            {label}
          </label>
        ) : null}
        {multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={inputId}
            rows={rows}
            aria-invalid={hasError || undefined}
            aria-describedby={hint || error ? `${inputId}-desc` : undefined}
            className={fieldClasses}
            {...(rest as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            id={inputId}
            aria-invalid={hasError || undefined}
            aria-describedby={hint || error ? `${inputId}-desc` : undefined}
            className={fieldClasses}
            {...rest}
          />
        )}
        {hasError ? (
          <p id={`${inputId}-desc`} className="text-small text-danger mt-1">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-desc`} className="text-small text-text-muted mt-1">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

export default Input;
