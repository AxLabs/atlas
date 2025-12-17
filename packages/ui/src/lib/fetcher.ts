import { useEnv } from "@/providers/env-provider";

export interface FetcherOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function useFetcher() {
  const { NEXT_PUBLIC_API_URL } = useEnv();

  async function fetcher<T>(endpoint: string, options: FetcherOptions = {}): Promise<T> {
    const { params, ...init } = options;

    let url = `${NEXT_PUBLIC_API_URL}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        data.message || `Request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    return response.json();
  }

  return { fetcher, ApiError };
}
