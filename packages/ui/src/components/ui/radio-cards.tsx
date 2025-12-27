"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { CircleIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function RadioCards({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-cards"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}

function RadioCardsItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-cards-item"
      className={cn(
        "border-input bg-background hover:bg-accent/50 data-[state=checked]:border-ring data-[state=checked]:bg-accent group relative flex cursor-pointer rounded-lg border p-4 text-left shadow-xs transition-all outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    >
      <div className="flex flex-1 flex-col gap-1 pr-6">{children}</div>
      <span
        data-slot="radio-cards-indicator"
        className="border-muted-foreground/40 group-data-[state=checked]:border-primary absolute top-4 right-4 flex aspect-square size-3.5 shrink-0 items-center justify-center rounded-full border transition-[color,box-shadow]"
      >
        <RadioGroupPrimitive.Indicator className="relative flex items-center justify-center">
          <CircleIcon className="fill-primary stroke-primary size-2" />
        </RadioGroupPrimitive.Indicator>
      </span>
    </RadioGroupPrimitive.Item>
  );
}

function RadioCardsTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="radio-cards-title"
      className={cn("text-sm leading-none font-medium", className)}
      {...props}
    />
  );
}

function RadioCardsDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="radio-cards-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export { RadioCards, RadioCardsDescription, RadioCardsItem, RadioCardsTitle };
