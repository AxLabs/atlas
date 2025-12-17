import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

import { Separator } from "./separator";

const itemVariants = cva("flex w-full items-start gap-4 rounded-md p-4 transition-colors", {
  variants: {
    variant: {
      default: "bg-muted/50",
      outline: "border border-input bg-background shadow-sm shadow-black/5",
      muted: "bg-muted",
    },
    size: {
      default: "p-4",
      sm: "p-3",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ItemProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof itemVariants> {
  asChild?: boolean;
}

const Item = React.forwardRef<React.ElementRef<"div">, ItemProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(
          itemVariants({ variant, size }),
          asChild &&
            "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          className
        )}
        {...props}
      />
    );
  }
);
Item.displayName = "Item";

const ItemGroup = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="list" className={cn("flex flex-col gap-2", className)} {...props} />
  )
);
ItemGroup.displayName = "ItemGroup";

const ItemSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentPropsWithoutRef<typeof Separator>
>(({ className, ...props }, ref) => <Separator ref={ref} className={className} {...props} />);
ItemSeparator.displayName = "ItemSeparator";

const itemMediaVariants = cva("flex shrink-0 items-center justify-center", {
  variants: {
    variant: {
      default: "size-10",
      icon: "size-10 rounded-md bg-muted",
      image: "size-10 overflow-hidden rounded-md",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ItemMediaProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof itemMediaVariants> {}

const ItemMedia = React.forwardRef<React.ElementRef<"div">, ItemMediaProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="media"
      className={cn(itemMediaVariants({ variant }), className)}
      {...props}
    />
  )
);
ItemMedia.displayName = "ItemMedia";

const ItemContent = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex min-w-0 flex-1 flex-col gap-1", className)} {...props} />
));
ItemContent.displayName = "ItemContent";

const ItemTitle = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("leading-none font-medium", className)} {...props} />
  )
);
ItemTitle.displayName = "ItemTitle";

const ItemDescription = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-muted-foreground text-sm", className)} {...props} />
));
ItemDescription.displayName = "ItemDescription";

const ItemActions = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex shrink-0 items-center gap-2", className)} {...props} />
));
ItemActions.displayName = "ItemActions";

const ItemHeader = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5", className)} {...props} />
  )
);
ItemHeader.displayName = "ItemHeader";

const ItemFooter = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center", className)} {...props} />
  )
);
ItemFooter.displayName = "ItemFooter";

export {
  Item,
  ItemGroup,
  ItemSeparator,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemHeader,
  ItemFooter,
};
