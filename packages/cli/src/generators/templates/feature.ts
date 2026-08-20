import type { FeatureNaming } from "../naming";

export interface FeatureTemplateContext {
  naming: FeatureNaming;
  openApiEnabled: boolean;
}

export interface FeatureTemplateOptions {
  query?: boolean;
  mutation?: boolean;
  form?: boolean;
  tests?: boolean;
}

export function renderFeatureComponent(context: FeatureTemplateContext): string {
  return `export function ${context.naming.pascal}Feature() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">${context.naming.pascal}</h1>
      <p className="text-muted-foreground">
        Implement product-specific UI and behavior in this feature module.
      </p>
    </section>
  );
}
`;
}

function renderFeatureIndexHeader(context: FeatureTemplateContext): string {
  return `/**
 * Product feature module: ${context.naming.kebab}
 *
 * Keep domain logic in this module. Routes under src/app should remain thin and
 * import from this public boundary.
 */
`;
}

export function renderFeatureIndex(context: FeatureTemplateContext): string {
  return `${renderFeatureIndexHeader(context)}
export { ${context.naming.pascal}Feature } from "./components/${context.naming.pascal}Feature";
`;
}

export function renderFeatureKeys(context: FeatureTemplateContext): string {
  return `import { createQueryKeys } from "@/lib/react-query/keys";

export const ${context.naming.camel}Keys = createQueryKeys("${context.naming.kebab}");
`;
}

export function renderFeatureQueries(context: FeatureTemplateContext): string {
  if (context.openApiEnabled) {
    return `"use client";

import { useQuery } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";

import { ${context.naming.camel}Keys } from "./keys";

import type { ApiError } from "@/lib/api/errors";

async function fetch${context.naming.pascal}List(): Promise<unknown> {
  throw new Error("Implement ${context.naming.kebab} list fetching with the product API contract.");
}

/**
 * Query hook scaffold for ${context.naming.kebab}.
 *
 * Wire this hook to a typed OpenAPI client method once the resource contract exists.
 */
export function use${context.naming.pascal}List() {
  return useQuery<unknown, ApiError>({
    queryKey: ${context.naming.camel}Keys.lists(),
    queryFn: async () => {
      try {
        return await fetch${context.naming.pascal}List();
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}
`;
  }

  return `"use client";

import { useQuery } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";

import { ${context.naming.camel}Keys } from "./keys";

import type { ApiError } from "@/lib/api/errors";

async function fetch${context.naming.pascal}List(): Promise<unknown> {
  throw new Error("Implement ${context.naming.kebab} list fetching with the product API contract.");
}

/**
 * Query hook scaffold for ${context.naming.kebab}.
 *
 * Replace fetch${context.naming.pascal}List with the product-specific API contract.
 */
export function use${context.naming.pascal}List() {
  return useQuery<unknown, ApiError>({
    queryKey: ${context.naming.camel}Keys.lists(),
    queryFn: async () => {
      try {
        return await fetch${context.naming.pascal}List();
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}
`;
}

export function renderFeatureMutations(context: FeatureTemplateContext): string {
  if (context.openApiEnabled) {
    return `"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";

import { ${context.naming.camel}Keys } from "./keys";

import type { ApiError } from "@/lib/api/errors";

async function create${context.naming.pascal}(_input: unknown): Promise<unknown> {
  throw new Error("Implement ${context.naming.kebab} mutation with the product API contract.");
}

/**
 * Mutation hook scaffold for ${context.naming.kebab}.
 *
 * Wire this hook to a typed OpenAPI client method once the resource contract exists.
 */
export function useCreate${context.naming.pascal}() {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiError, unknown>({
    mutationFn: async (input) => {
      try {
        return await create${context.naming.pascal}(input);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ${context.naming.camel}Keys.lists(),
      });
    },
  });
}
`;
  }

  return `"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";

import { ${context.naming.camel}Keys } from "./keys";

import type { ApiError } from "@/lib/api/errors";

async function create${context.naming.pascal}(_input: unknown): Promise<unknown> {
  throw new Error("Implement ${context.naming.kebab} mutation with the product API contract.");
}

/**
 * Mutation hook scaffold for ${context.naming.kebab}.
 *
 * Replace create${context.naming.pascal} with the product-specific API contract.
 */
export function useCreate${context.naming.pascal}() {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiError, unknown>({
    mutationFn: async (input) => {
      try {
        return await create${context.naming.pascal}(input);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ${context.naming.camel}Keys.lists(),
      });
    },
  });
}
`;
}

export function renderFeatureSchema(context: FeatureTemplateContext): string {
  return `import { z } from "zod";

/**
 * Replace this placeholder schema with product-specific fields.
 */
export const ${context.naming.camel}FormSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export type ${context.naming.pascal}FormValues = z.infer<typeof ${context.naming.camel}FormSchema>;
`;
}

export function renderFeatureFormComponent(context: FeatureTemplateContext): string {
  return `"use client";

import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  useZodForm,
} from "@atlas/ui";

import { ${context.naming.camel}FormSchema, type ${context.naming.pascal}FormValues } from "../schema";

export function ${context.naming.pascal}Form() {
  const form = useZodForm(${context.naming.camel}FormSchema, {
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = (_values: ${context.naming.pascal}FormValues) => {
    // TODO: wire to a feature mutation once domain behavior is defined
  };

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
`;
}

export function renderFeatureIndexWithExports(
  context: FeatureTemplateContext,
  options: FeatureTemplateOptions
): string {
  const exports: string[] = [
    `export { ${context.naming.pascal}Feature } from "./components/${context.naming.pascal}Feature";`,
  ];

  if (options.form) {
    exports.push(
      `export { ${context.naming.pascal}Form } from "./components/${context.naming.pascal}Form";`
    );
  }

  if (options.query || options.mutation) {
    exports.push(`export { ${context.naming.camel}Keys } from "./keys";`);
  }

  if (options.mutation) {
    exports.push(`export { useCreate${context.naming.pascal} } from "./mutations";`);
  }

  if (options.query) {
    exports.push(`export { use${context.naming.pascal}List } from "./queries";`);
  }

  if (options.form) {
    exports.push(`export { ${context.naming.camel}FormSchema } from "./schema";`);
  }

  return `${renderFeatureIndexHeader(context)}
${exports.join("\n")}
`;
}

export function renderFeatureKeysTest(context: FeatureTemplateContext): string {
  return `import { ${context.naming.camel}Keys } from "../keys";

describe("${context.naming.kebab} query keys", () => {
  it("creates deterministic list keys", () => {
    expect(${context.naming.camel}Keys.all()).toEqual(["${context.naming.kebab}"]);
    expect(${context.naming.camel}Keys.lists()).toEqual(["${context.naming.kebab}", "list"]);
    expect(${context.naming.camel}Keys.list({ page: 1 })).toEqual(["${context.naming.kebab}", "list", { page: 1 }]);
  });
});
`;
}
