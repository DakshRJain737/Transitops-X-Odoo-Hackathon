import { forwardRef, useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { cn } from "../../utils/cn";

function FieldWrapper({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-zinc-300 mb-1.5"
        >
          {label}
          {required && <span className="text-danger-400 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-danger-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Base classes shared by input/select/textarea so focus glow + error state stay consistent */
const fieldBaseClass = (error) =>
  cn(
    "w-full bg-surface-600/60 border rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500",
    "px-3.5 py-2.5 transition-all duration-200 outline-none",
    "hover:border-border-strong",
    "focus:border-accent-500 focus:shadow-glow-sm focus:bg-surface-600",
    error
      ? "border-danger-500/50 focus:border-danger-500 focus:shadow-glow-danger"
      : "border-border"
  );

/**
 * Input — text/email/number/password/etc.
 * Password fields automatically get a show/hide toggle.
 */
export const Input = forwardRef(
  (
    {
      label,
      error,
      hint,
      required,
      leftIcon = null,
      type = "text",
      id,
      className,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword && showPassword ? "text" : type;
    const fieldId = id || props.name;

    return (
      <FieldWrapper
        label={label}
        htmlFor={fieldId}
        error={error}
        hint={hint}
        required={required}
      >
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 [&>svg]:w-4 [&>svg]:h-4 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={fieldId}
            type={resolvedType}
            className={cn(
              fieldBaseClass(error),
              leftIcon && "pl-10",
              isPassword && "pr-10",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </FieldWrapper>
    );
  }
);
Input.displayName = "Input";

/**
 * Select — native <select> styled to match Input. Kept native (not a custom
 * listbox) for full keyboard/accessibility support out of the box; visual
 * consistency comes from shared fieldBaseClass + a custom chevron.
 */
export const Select = forwardRef(
  (
    { label, error, hint, required, options = [], placeholder, id, className, ...props },
    ref
  ) => {
    const fieldId = id || props.name;
    return (
      <FieldWrapper
        label={label}
        htmlFor={fieldId}
        error={error}
        hint={hint}
        required={required}
      >
        <div className="relative">
          <select
            ref={ref}
            id={fieldId}
            className={cn(
              fieldBaseClass(error),
              "appearance-none pr-9 cursor-pointer",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </FieldWrapper>
    );
  }
);
Select.displayName = "Select";

/** Textarea — for descriptions, maintenance notes, etc. */
export const Textarea = forwardRef(
  ({ label, error, hint, required, id, className, rows = 4, ...props }, ref) => {
    const fieldId = id || props.name;
    return (
      <FieldWrapper
        label={label}
        htmlFor={fieldId}
        error={error}
        hint={hint}
        required={required}
      >
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          className={cn(fieldBaseClass(error), "resize-none", className)}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
Textarea.displayName = "Textarea";

export default Input;