import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-transparent text-sm font-extrabold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-blue text-white hover:bg-blue/90",
        success: "bg-green text-white hover:bg-green/90",
        danger: "bg-coral text-white hover:bg-coral/90",
        soft: "bg-blue-soft text-blue hover:bg-blue-soft/70",
        "soft-danger": "bg-coral-soft text-coral hover:bg-coral-soft/70",
        outline: "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        "outline-success": "border-green bg-card text-green hover:bg-green-soft",
        dashed: "border-dashed border-border bg-transparent text-blue hover:bg-card",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-lg px-3 text-[13px]",
        lg: "h-[54px] justify-start gap-3 rounded-xl px-4 text-[15px] [&_svg:not([class*='size-'])]:size-5",
        icon: "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
