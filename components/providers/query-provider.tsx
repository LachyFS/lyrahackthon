"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: 5 minutes - data is fresh for this duration
            staleTime: 5 * 60 * 1000,
            // Cache time: 30 minutes - unused data stays in cache
            gcTime: 30 * 60 * 1000,
            // Retry failed requests up to 2 times
            retry: 2,
            // Don't refetch on window focus by default (can override per query)
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
