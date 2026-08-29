/**
 * Form Field Wrapper with Automatic A11y
 *
 * Ergonomic accessibility wiring over canonical shadcn Field primitives.
 */

"use client";

import * as React from "react";

import { cn } from "../../lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel } from "../ui/field";

export interface FormFieldProps {
  name: string;
  label: React.ReactNode;
  helpText?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
    "aria-required"?: boolean;
  }) => React.ReactNode;
}

export function FormField({
  name,
  label,
  helpText,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const fieldId = `field-${name}`;
  const helpTextId = helpText && !error ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helpTextId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <Field className={cn(className)} data-field-wrapper>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {required ? (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        ) : null}
      </FieldLabel>

      {children({
        id: fieldId,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
        ...(required && { "aria-required": true }),
      })}

      {helpText && !error ? <FieldDescription id={helpTextId}>{helpText}</FieldDescription> : null}

      {error ? (
        <FieldError id={errorId} role="alert" aria-live="polite">
          {error}
        </FieldError>
      ) : null}
    </Field>
  );
}
