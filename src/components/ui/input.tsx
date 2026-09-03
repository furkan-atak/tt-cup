import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm text-ink outline-none ring-ball/40 placeholder:text-ink/40 focus:border-ball focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}
