"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorMessage,
  Skeleton,
} from "@thedanielmark/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

interface Post {
  id: number;
  title: string;
  body: string;
}

export default function DemoPage() {
  const [showError, setShowError] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const response = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=3");
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost">← Back to Home</Button>
        </Link>
      </div>

      <h1 className="mb-8 text-4xl font-bold">Component Demo</h1>

      <div className="space-y-8">
        {/* Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardDescription>Various button variants and states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Different alert types</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Default Alert</AlertTitle>
              <AlertDescription>This is a default alert message.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Error Alert</AlertTitle>
              <AlertDescription>This is an error alert message.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTitle>Warning Alert</AlertTitle>
              <AlertDescription>This is a warning alert message.</AlertDescription>
            </Alert>
            <Alert variant="success">
              <AlertTitle>Success Alert</AlertTitle>
              <AlertDescription>This is a success alert message.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Skeletons */}
        <Card>
          <CardHeader>
            <CardTitle>Skeletons</CardTitle>
            <CardDescription>Loading placeholders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-1/2" />
          </CardContent>
        </Card>

        {/* Empty State */}
        <Card>
          <CardHeader>
            <CardTitle>Empty State</CardTitle>
            <CardDescription>Display when no data is available</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No items found"
              description="Get started by creating your first item"
              action={<Button onClick={() => toast.success("Item created!")}>Create Item</Button>}
            />
          </CardContent>
        </Card>

        {/* Error Message */}
        <Card>
          <CardHeader>
            <CardTitle>Error Message</CardTitle>
            <CardDescription>Error display component</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setShowError(!showError)}>Toggle Error</Button>
            <ErrorMessage
              error={showError ? "Something went wrong with your request" : null}
              retry={() => {
                setShowError(false);
                toast.success("Retried successfully!");
              }}
            />
          </CardContent>
        </Card>

        {/* React Query Demo */}
        <Card>
          <CardHeader>
            <CardTitle>React Query Integration</CardTitle>
            <CardDescription>Fetching data with React Query</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : error ? (
              <ErrorMessage error={error as Error} retry={() => refetch()} />
            ) : (
              <div className="space-y-4">
                {data?.map((post) => (
                  <Card key={post.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{post.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">{post.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => refetch()} disabled={isLoading}>
              Refresh Data
            </Button>
          </CardFooter>
        </Card>

        {/* Toast Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Toasts</CardTitle>
            <CardDescription>Toast notifications with Sonner</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => toast.success("Success toast!")}>Success Toast</Button>
              <Button onClick={() => toast.error("Error toast!")} variant="destructive">
                Error Toast
              </Button>
              <Button onClick={() => toast.info("Info toast!")} variant="secondary">
                Info Toast
              </Button>
              <Button onClick={() => toast.warning("Warning toast!")} variant="outline">
                Warning Toast
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
