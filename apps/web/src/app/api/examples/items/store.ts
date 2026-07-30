/**
 * In-memory store for reference example items.
 *
 * @module api/examples/items/store
 */

export interface ExampleItem {
  id: string;
  title: string;
  description?: string;
  status: "open" | "closed";
  createdAt: string;
}

let items: ExampleItem[] = [
  {
    id: "item-1",
    title: "Configure development environment",
    description: "Set up local dev with environment variables",
    status: "closed",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "item-2",
    title: "Implement authentication flow",
    description: "OAuth with PKCE and session cookies",
    status: "closed",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "item-3",
    title: "Build React Query patterns",
    description: "Typed hooks with query key factories",
    status: "open",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

let nextId = 4;

export function getItems(): ExampleItem[] {
  return [...items];
}

export function getItem(id: string): ExampleItem | undefined {
  return items.find((item) => item.id === id);
}

export function createItem(data: { title: string; description?: string }): ExampleItem {
  const newItem: ExampleItem = {
    id: `item-${nextId++}`,
    title: data.title,
    description: data.description,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  return newItem;
}

export function updateItem(
  id: string,
  data: Partial<Pick<ExampleItem, "title" | "description" | "status">>
): ExampleItem | null {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const existingItem = items[index];
  if (!existingItem) return null;

  const updatedItem: ExampleItem = { ...existingItem, ...data };
  items[index] = updatedItem;
  return updatedItem;
}

export function toggleItemStatus(id: string): ExampleItem | null {
  const item = items.find((entry) => entry.id === id);
  if (!item) return null;

  item.status = item.status === "open" ? "closed" : "open";
  return item;
}

export function resetStore(): void {
  items = [
    {
      id: "item-1",
      title: "Configure development environment",
      description: "Set up local dev with environment variables",
      status: "closed",
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: "item-2",
      title: "Implement authentication flow",
      description: "OAuth with PKCE and session cookies",
      status: "closed",
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "item-3",
      title: "Build React Query patterns",
      description: "Typed hooks with query key factories",
      status: "open",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];
  nextId = 4;
}
