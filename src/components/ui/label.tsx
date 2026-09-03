import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-xs font-semibold uppercase tracking-wide text-ink/60", className)}
      {...props}
    />
  );
}
