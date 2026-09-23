import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#F5B82E] text-slate-950 font-bold shadow-[0_0_15px_rgba(245,184,46,0.25)] hover:bg-[#FFC52F] hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(245,184,46,0.4)] active:translate-y-0",
        gold: "bg-gradient-to-r from-[#F5B82E] to-[#FFC52F] text-slate-950 font-black shadow-[0_0_20px_rgba(245,184,46,0.3)] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(245,184,46,0.5)] active:translate-y-0",
        outline: "border border-white/15 bg-[#09152A]/80 text-slate-100 hover:bg-[#0B1930] hover:border-amber-400/40 hover:text-amber-400 hover:-translate-y-0.5 active:translate-y-0",
        secondary: "border border-white/10 bg-[#0B1930] text-slate-200 hover:bg-[#0E203E] hover:border-white/20 hover:text-white hover:-translate-y-0.5 active:translate-y-0",
        ghost: "text-slate-300 hover:bg-white/5 hover:text-white transition-colors",
        link: "text-amber-400 underline-offset-4 hover:underline",
        destructive: "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 hover:-translate-y-0.5 active:translate-y-0",
        danger: "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 hover:-translate-y-0.5 active:translate-y-0",
        success: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0",
        bid: "bg-gradient-to-r from-[#F5B82E] to-[#FFC52F] text-slate-950 font-black shadow-[0_0_25px_rgba(245,184,46,0.35)] hover:-translate-y-0.5 hover:shadow-[0_0_35px_rgba(245,184,46,0.55)] active:translate-y-0",
        broadcast: "border border-amber-400/30 bg-[#09152A]/90 text-white hover:border-amber-400/60 hover:bg-[#0D1C33] hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-7 text-sm font-bold tracking-wide",
        xl: "h-14 rounded-2xl px-9 text-base font-bold tracking-wider uppercase",
        icon: "h-9 w-9 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
