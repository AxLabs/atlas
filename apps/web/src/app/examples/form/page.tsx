"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  applyServerFieldErrors,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  getFormErrorMessage,
  Input,
  Textarea,
  useZodForm,
} from "@atlas/ui";

import { useCreateExampleItem } from "@/features/examples";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";

const createItemSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be at most 100 characters"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
});

type CreateItemFormData = z.infer<typeof createItemSchema>;

export default function FormExamplePage() {
  const router = useRouter();
  const createItem = useCreateExampleItem();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(createItemSchema, {
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const onSubmit = async (data: CreateItemFormData) => {
    setServerError(null);

    try {
      await createItem.mutateAsync(data);
      notify.success("Item created");
      router.push("/examples/data?mode=success");
    } catch (error) {
      if (!applyServerFieldErrors(form, error)) {
        const message = getFormErrorMessage(error);
        setServerError(message);
        notify.error(message, {
          description:
            error instanceof ApiError ? `Reference: ${error.shape.correlationId}` : undefined,
        });
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Forms & validation</h1>
        <p className="text-muted-foreground">
          Zod schema validation with server field error mapping via the shared API client.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create item</CardTitle>
          <CardDescription>Submit invalid data to see client validation in action.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {serverError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a title" autoComplete="off" {...field} />
                    </FormControl>
                    <FormDescription>3–100 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description" rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={createItem.isPending}>
                  {createItem.isPending ? "Creating..." : "Create item"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/examples/data")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
