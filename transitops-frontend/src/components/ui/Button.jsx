import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Button — primary interactive element across the entire app.
 *
 * Variants:
 *   primary   — filled accent (default)
 *   secondary — subtle filled surface
 *   outline   — border + transparent bg
 *   ghost     — text-only, hover bg
 *   danger    — filled danger-red (destructive actions)
 *
 * Sizes:  xs | sm | md (default) | lg
 *
 * Additional props:
 *   isLoading — replaces content with a spinner, disables the button
 *   leftIcon  — icon element placed before label
 *   rightIcon — icon element placed after label
 *   className — merged via cn() for overrides
 *
 * Usage examples:
 *   <Button>Save</Button>
 *   <Button variant="ghost" size="sm" leftIcon={<RefreshCcw />}>Refresh</Button>
 *   <Button variant="danger" isLoading={deleting}>Delete</Button>
 *   <Button type="submit" form="my-form" isLoading={submitting}>Submit</Button>
 */

const VARIANT_STYLES = {
  primary: [
    'bg-accent-500 text-white',
    'hover:bg-accent-600 active:bg-accent-700',
    'shadow-glow-sm hover:shadow-glow',
    'border border-accent-400/20',
    'disabled:bg-accent-500/40 disabled:shadow-none',
  ].join(' '),

  secondary: [
    'bg-surface-600 text-zinc-200',
    'hover:bg-surface-500 active:bg-surface-400',
    'border border-border hover:border-border-strong',
    'disabled:bg-surface-700 disabled:text-zinc-500',
  ].join(' '),

  outline: [
    'bg-transparent text-zinc-300',
    'border border-border hover:border-border-strong hover:bg-surface-700/60',
    'active:bg-surface-600/60',
    'disabled:opacity-40',
  ].join(' '),

  ghost: [
    'bg-transparent text-zinc-400',
    'hover:bg-surface-600/70 hover:text-zinc-200',
    'active:bg-surface-500/70',
    'border border-transparent',
    'disabled:opacity-40',
  ].join(' '),

  danger: [
    'bg-danger-500 text-white',
    'hover:bg-danger-600 active:bg-danger-700',
    'border border-danger-400/20',
    'shadow-[0_0_12px_rgba(239,68,68,0.2)] hover:shadow-[0_0_16px_rgba(239,68,68,0.35)]',
    'disabled:bg-danger-500/40 disabled:shadow-none',
  ].join(' '),
};

const SIZE_STYLES = {
  xs: 'h-6  px-2    text-[11px] gap-1   rounded-lg',
  sm: 'h-8  px-3    text-xs     gap-1.5 rounded-xl',
  md: 'h-10 px-4    text-sm     gap-2   rounded-xl',
  lg: 'h-12 px-5    text-base   gap-2   rounded-2xl',
};

const ICON_SIZE = {
  xs: 'w-3   h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4   h-4',
  lg: 'w-5   h-5',
};

const Button = forwardRef(function Button(
  {
    children,
    variant  = 'primary',
    size     = 'md',
    isLoading = false,
    leftIcon  = null,
    rightIcon = null,
    className,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  const iconClass = ICON_SIZE[size] ?? ICON_SIZE.md;
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        // Base
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-all duration-200 ease-out select-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
        // Disabled state shared across all variants
        'disabled:cursor-not-allowed disabled:pointer-events-none',
        // Variant + size
        VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary,
        SIZE_STYLES[size]       ?? SIZE_STYLES.md,
        className
      )}
      {...rest}
    >
      {isLoading ? (
        /* Loading spinner replaces leftIcon + children */
        <>
          <Loader2 className={cn(iconClass, 'animate-spin shrink-0')} aria-hidden />
          <span className="opacity-70">{children}</span>
        </>
      ) : (
        <>
          {leftIcon && (
            <span className={cn('inline-flex items-center shrink-0 [&>svg]:w-full [&>svg]:h-full', iconClass)} aria-hidden>
              {leftIcon}
            </span>
          )}
          {children && <span>{children}</span>}
          {rightIcon && (
            <span className={cn('inline-flex items-center shrink-0 [&>svg]:w-full [&>svg]:h-full', iconClass)} aria-hidden>
              {rightIcon}
            </span>
          )}
        </>
      )}
    </button>
  );
});

export default Button;
