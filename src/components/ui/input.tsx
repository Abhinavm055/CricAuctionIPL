import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-[#00CFFF44] bg-[#071427cc] px-3 py-2 text-base text-white ring-offset-background placeholder:text-slate-400 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00CFFF] focus-visible:border-[#00CFFFaa] focus-visible:shadow-[0_0_0_1px_rgba(0,207,255,0.75),0_0_14px_rgba(0,207,255,0.35)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
