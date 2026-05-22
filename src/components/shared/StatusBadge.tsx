import { STATUS_LABELS, STATUS_BADGE_CLASS, PRIORITY_LABELS, PRIORITY_BADGE_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface BadgeProps {
  value: string;
  className?: string;
}

export function StatusBadge({ value, className }: BadgeProps) {
  const label = STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value;
  const cls = STATUS_BADGE_CLASS[value] ?? "badge-assigned";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", cls, className)}>
      {label}
    </span>
  );
}

export function PriorityBadge({ value, className }: BadgeProps) {
  const label = PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS] ?? value;
  const cls = PRIORITY_BADGE_CLASS[value] ?? "badge-low";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border uppercase tracking-wide", cls, className)}>
      {label}
    </span>
  );
}
