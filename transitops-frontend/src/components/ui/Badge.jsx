import { cn } from "../../utils/cn";

const COLOR_STYLES = {
  accent: "bg-accent-500/12 text-accent-300 border-accent-500/25",
  success: "bg-success-bg text-success-400 border-success-500/25",
  warning: "bg-warning-bg text-warning-400 border-warning-500/25",
  danger: "bg-danger-bg text-danger-400 border-danger-500/25",
  info: "bg-info-bg text-info-400 border-info-500/25",
  muted: "bg-white/[0.05] text-muted-foreground border-white/10",
};

const SIZE_STYLES = {
  sm: "text-[11px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
};

export function Badge({
  children,
  color = "muted",
  size = "sm",
  icon = null,
  className,
  ...props
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        COLOR_STYLES[color] ?? COLOR_STYLES.muted,
        SIZE_STYLES[size],
        className
      )}
      {...props}
    >
      {icon && (
        <span className="inline-flex shrink-0 [&>svg]:w-3 [&>svg]:h-3">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

export default Badge;