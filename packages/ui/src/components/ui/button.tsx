import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import {
  interactiveDisabledClasses,
  interactiveFocusClasses,
  interactiveInvalidClasses,
} from "../../lib/control-styles";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  cn(
    "group/button inline-flex shrink-0 items-center justify-center rounded-md bg-clip-padding text-sm font-medium whitespace-nowrap shadow-control transition-[color,box-shadow,background-color,border-color] select-none active:not-aria-[haspopup]:translate-y-px",
    interactiveFocusClasses,
    interactiveDisabledClasses,
    interactiveInvalidClasses,
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ),
  {
    variants: {
      variant: {
        default:
          "border border-control-primary-border bg-control-primary-background text-control-primary-foreground hover:bg-control-primary-background-hover active:bg-control-primary-background-active",
        secondary:
          "border border-control-border bg-control-background text-control-foreground hover:border-control-border-hover hover:bg-control-background-hover active:bg-control-background-active aria-expanded:bg-control-background-hover",
        outline:
          "border border-control-border bg-control-background text-control-foreground hover:border-control-border-hover hover:bg-control-background-hover active:bg-control-background-active aria-expanded:bg-control-background-hover",
        ghost:
          "border border-transparent text-control-foreground shadow-none hover:bg-control-background-hover active:bg-control-background-active aria-expanded:bg-control-background-hover",
        destructive:
          "border border-control-destructive-border bg-control-destructive-background text-control-destructive-foreground hover:border-control-destructive-border hover:bg-control-destructive-background-hover active:bg-control-destructive-background-active focus-visible:border-destructive focus-visible:ring-destructive/25",
        link: "border-transparent text-primary shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
