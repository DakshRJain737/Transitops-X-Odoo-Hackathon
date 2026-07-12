import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

const VARIANT_STYLES = {
  primary:
    "bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-glow-sm hover:shadow-glow-md border border-accent-400/20",
  secondary:
    "bg-surface-700 text-zinc-100 border border-border-strong hover:bg-surface-600",
  outline:
    "bg-transparent text-zinc-100 border border-border-strong hover:bg-white/[0.04] hover:border-accent-500/50",
  ghost:
    "bg-transparent text-zinc-300 hover:bg-white/[0.06] hover:text-white border border-transparent",
  danger:
    "bg-gradient-to-br from-danger-500 to-red-600 text-white shadow-glow-danger hover:shadow-[0_0_28px_0_rgba(239,68,68,0.45)] border border-danger-400/20",
};

const SIZE_STYLES = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
  icon: "h-10 w-10 rounded-xl", // square, for icon-only buttons
};

export const Button = forwardRef(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon = null,
      rightIcon = null,
      disabled = false,
      className,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.97 } : undefined}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          // base
          "relative inline-flex items-center justify-center font-medium",
          "transition-colors duration-200 ease-out",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          "select-none whitespace-nowrap",
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
            <span>Please wait…</span>
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="inline-flex shrink-0 [&>svg]:w-4 [&>svg]:h-4">
                {leftIcon}
              </span>
            )}
            {children}
            {rightIcon && (
              <span className="inline-flex shrink-0 [&>svg]:w-4 [&>svg]:h-4">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export default Button;