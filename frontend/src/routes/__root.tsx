import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

// import { NotFound } from "@/components/not-found";
// import { Toaster } from "@/components/ui/sonner";
// import { ThemeProvider } from "@/contexts/theme-provider";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
  // notFoundComponent: NotFound,
});

function RootComponent() {
  return <Outlet />;

  // return (
  //   <ThemeProvider defaultTheme="system" storageKey="theme">
  //     <Outlet />
  //     <Toaster position="top-center" />
  //     <TanStackRouterDevtools position="bottom-right" />
  //   </ThemeProvider>
  // );
}
