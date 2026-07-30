/**
 * Example API types for the reference items feature.
 *
 * @module features/examples/types
 */

export interface ExampleItem {
  id: string;
  title: string;
  description?: string;
  status: "open" | "closed";
  createdAt: string;
}

export interface ExampleItemsListResponse {
  data: ExampleItem[];
  meta: {
    total: number;
    mode: string;
  };
}

export interface CreateExampleItemRequest {
  title: string;
  description?: string;
}

export type ExampleMode = "success" | "empty" | "error" | "slow";
