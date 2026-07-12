import { Badge } from "../ui/Badge";
import { getStatusMeta } from "../../constants/statuses";
import { cn } from "../../utils/cn";

const DOT_COLOR_STYLES = {
  accent: "text-accent-400",
  success: "text-success-400",
  warning: "text-warning-400",
  danger: "text-danger-400",
  info: "text-info-400",
  muted: "text-muted-foreground",
};

export function StatusChip({
  type,
  status,
  showDot = true,
  size = "sm",
  className,
}) {
  const meta = getStatusMeta(type, status);

  return (
    <Badge color={meta.color} size={size} className={className}>
      {showDot && (
        <span
          className={cn(
            "status-dot bg-current",
            DOT_COLOR_STYLES[meta.color] ?? DOT_COLOR_STYLES.muted
          )}
        />
      )}
      {meta.label}
    </Badge>
  );
}

export default StatusChip;