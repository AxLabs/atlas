import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

import { Separator } from "./separator";

const FieldSet = React.forwardRef<
  React.ElementRef<"fieldset">,
  React.ComponentPropsWithoutRef<"fieldset">
>(({ className, ...props }, ref) => (
  <fieldset
    ref={ref}
    className={cn("group/fieldset space-y-4 border-none p-0", className)}
    {...props}
  />
));
FieldSet.displayName = "FieldSet";

const fieldLegendVariants = cva("inline-block text-sm font-medium leading-none tracking-tight", {
  variants: {
    variant: {
      legend: "mb-1 text-base font-semibold",
      label: "",
    },
  },
  defaultVariants: {
    variant: "legend",
  },
});

const FieldLegend = React.forwardRef<
  React.ElementRef<"legend">,
  React.ComponentPropsWithoutRef<"legend"> & VariantProps<typeof fieldLegendVariants>
>(({ className, variant, ...props }, ref) => (
  <legend ref={ref} className={cn(fieldLegendVariants({ variant }), className)} {...props} />
));
FieldLegend.displayName = "FieldLegend";

const FieldGroup = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn("space-y-4 **:data-[slot=checkbox-group]:space-y-3", className)}
      {...props}
    />
  )
);
FieldGroup.displayName = "FieldGroup";

const fieldVariants = cva("group/field flex gap-4", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row items-start",
      responsive: "flex-col @[240px]/field-group:flex-row @[240px]/field-group:items-start",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

export interface FieldProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof fieldVariants> {}

const Field = React.forwardRef<React.ElementRef<"div">, FieldProps>(
  ({ className, orientation, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
);
Field.displayName = "Field";

const FieldContent = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-1 flex-col space-y-1.5 group-data-[orientation=horizontal]/field:space-y-1",
      className
    )}
    {...props}
  />
));
FieldContent.displayName = "FieldContent";

const FieldLabel = React.forwardRef<
  React.ElementRef<"label">,
  React.ComponentPropsWithoutRef<"label"> & {
    asChild?: boolean;
  }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "label";
  return (
    <Comp
      ref={ref}
      className={cn(
        "group-data-invalid/field:text-destructive [&:has([role=radio])]:border-input [&:has([role=radio]:checked)]:border-ring inline-block text-sm leading-none font-medium tracking-tight [&:has([role=radio])]:cursor-pointer [&:has([role=radio])]:rounded-md [&:has([role=radio])]:border [&:has([role=radio])]:p-4 [&:has([role=radio])]:shadow-sm [&:has([role=radio])]:shadow-black/5",
        className
      )}
      {...props}
    />
  );
});
FieldLabel.displayName = "FieldLabel";

const FieldTitle = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "group-data-invalid/field:text-destructive inline-block text-sm leading-none font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
);
FieldTitle.displayName = "FieldTitle";

const FieldDescription = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-muted-foreground group-data-invalid/field:text-destructive text-sm",
      className
    )}
    {...props}
  />
));
FieldDescription.displayName = "FieldDescription";

const FieldSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentPropsWithoutRef<typeof Separator> & {
    children?: React.ReactNode;
  }
>(({ className, children, ...props }, ref) => {
  if (children) {
    return (
      <div className={cn("relative flex items-center py-4", className)}>
        <Separator ref={ref} className="flex-1" {...props} />
        <span className="text-muted-foreground px-2 text-xs">{children}</span>
        <Separator className="flex-1" />
      </div>
    );
  }

  return <Separator ref={ref} className={cn("my-4", className)} {...props} />;
});
FieldSeparator.displayName = "FieldSeparator";

interface FieldErrorProps extends React.ComponentPropsWithoutRef<"div"> {
  errors?: Array<{ message?: string } | undefined>;
}

const FieldError = React.forwardRef<React.ElementRef<"div">, FieldErrorProps>(
  ({ className, errors, children, ...props }, ref) => {
    const errorMessages = errors?.filter((e) => e?.message).map((e) => e!.message);
    const body = errorMessages?.length ? errorMessages : children;

    if (!body) return null;

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        className={cn("text-destructive text-sm font-medium", className)}
        {...props}
      >
        {Array.isArray(body) ? (
          <ul className="list-inside list-disc space-y-1">
            {body.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        ) : (
          body
        )}
      </div>
    );
  }
);
FieldError.displayName = "FieldError";

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
