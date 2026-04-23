import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,207,255,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-[#0B1D3A] to-[#00CFFF] text-primary-foreground hover:brightness-110 hover:scale-105 active:scale-95",
        destructive: "bg-gradient-to-r from-[#8d1d1d] to-[#FF4D4D] text-destructive-foreground hover:scale-105",
        outline: "border border-[#00CFFF66] bg-[#071a36cc] text-white hover:bg-[#0b2348cc] hover:border-[#00CFFF] hover:text-[#e0f9ff] hover:scale-105",
        secondary: "bg-[#0f254acc] text-secondary-foreground hover:bg-[#143263cc] hover:scale-105",
        ghost: "hover:bg-[#00CFFF22] hover:text-[#d8f9ff] hover:scale-105",
        link: "text-primary underline-offset-4 hover:underline",
        gold: "bg-gradient-to-r from-[#795b06] to-[#FFD700] text-[#120d00] font-bold shadow-lg hover:scale-105 active:scale-95",
        bid: "bg-gradient-to-r from-[#0B1D3A] to-[#00CFFF] text-white font-bold shadow-lg hover:brightness-110 hover:scale-105 active:scale-95",
        danger: "bg-gradient-to-r from-[#8d1d1d] to-[#FF4D4D] text-white font-bold shadow-lg hover:brightness-110 hover:scale-105 active:scale-95",
        broadcast: "bg-[#0f254acc] backdrop-blur-md border border-[#00CFFF55] text-foreground hover:bg-[#143263dd] hover:border-[#00CFFFaa] hover:scale-105",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-14 rounded-lg px-10 text-lg",
        icon: "h-10 w-10",
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
