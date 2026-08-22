import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(function FloatingInput(
  {
    label,
    hint,
    error,
    containerClassName,
    className,
    id,
    type = 'text',
    placeholder,
    'aria-describedby': describedBy,
    'aria-invalid': ariaInvalid,
    ...inputProps
  },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? hint;
  const messageId = message ? `${inputId}-message` : undefined;
  const description = [describedBy, messageId].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={`xe_floating-input${error ? ' xe_floating-input--error' : ''}${
        containerClassName ? ` ${containerClassName}` : ''
      }`}
    >
      <label className="xe_floating-input__field" htmlFor={inputId}>
        <input
          {...inputProps}
          ref={ref}
          id={inputId}
          type={type}
          className={`xe_floating-input__control${className ? ` ${className}` : ''}`}
          placeholder={placeholder ?? ' '}
          aria-describedby={description}
          aria-invalid={ariaInvalid ?? (error ? true : undefined)}
        />
        <span className="xe_floating-input__label">{label}</span>
      </label>
      {message && (
        <span id={messageId} className="xe_floating-input__message">
          {message}
        </span>
      )}
    </div>
  );
});
