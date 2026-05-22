import Link from "next/link";

export function MetricTile({
  label, value, icon: Icon, accent, href,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4 hover:border-border/60 transition-colors">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold text-foreground leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
