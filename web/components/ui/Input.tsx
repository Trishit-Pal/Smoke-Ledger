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
      'w-full bg-bg-elevated border rounded-md px-md py-sm text-body text-text',
      'placeholder:text-text-faint focus:outline-none transition-colors',
      hasError ? 'border-danger focus:border-danger' : 'border-border focus:border-accent',
      multiline && 'resize-y min-h-[88px]',
      className,
    );

    return (
      <div className={cn('flex flex-col', containerClassName)}>
        {label ? (
          <label
            htmlFor={inputId}
            className="text-caption uppercase text-text-muted mb-1"
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
