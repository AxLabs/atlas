import { z } from "zod";

export const createUserFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  role: z.enum(["user", "admin"]).default("user"),
});

export const updateUserFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  role: z.enum(["user", "admin"]),
});

export type CreateUserFormData = z.infer<typeof createUserFormSchema>;
export type UpdateUserFormData = z.infer<typeof updateUserFormSchema>;
