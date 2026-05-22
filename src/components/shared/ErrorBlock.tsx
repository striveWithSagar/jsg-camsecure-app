"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function ErrorBlock({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Something went wrong</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message ?? "An unexpected error occurred."}</p>
      </div>
      <Button size="sm" variant="outline" onClick={reset} className="h-8 text-xs">Try again</Button>
    </div>
  );
}
