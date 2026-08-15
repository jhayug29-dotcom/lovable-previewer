import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data instantly, refresh quietly in the background.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Warm the next page (code + data) as soon as a link is hovered/focused.
    defaultPreload: "intent",
    defaultPreloadDelay: 60,
    defaultPreloadStaleTime: 30_000,
    defaultStaleTime: 30_000,
  });

  return router;
};
