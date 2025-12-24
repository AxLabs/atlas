/**
 * Form Error Utilities
 *
 * Helper functions for working with react-hook-form errors.
 */

import type { FieldErrors } from "react-hook-form";

/**
 * Extract error message for a specific field from react-hook-form errors.
 *
 * @param errors - React-hook-form errors object
 * @param name - Field name (supports nested paths like "user.email")
 * @returns Error message string, or undefined if no error
 *
 * @example
 * ```tsx
 * const errors = form.formState.errors;
 * const emailError = getFieldErrorMessage(errors, "email");
 * // => "Invalid email format"
 * ```
 */
export function getFieldErrorMessage(errors: FieldErrors, name: string): string | undefined {
  // Split nested path (e.g., "user.email" => ["user", "email"])
  const keys = name.split(".");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = errors;

  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }

  // Return message if it exists
  return current?.message as string | undefined;
}
