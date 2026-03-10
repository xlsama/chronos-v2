import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceGrid } from "@/components/connections/service-grid";
import { ServiceMap } from "@/components/connections/service-map";
import { connectionQueries } from "@/lib/queries/connections";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/_app/connections/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(connectionQueries.list()),
  pendingComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const { data: connections } = useSuspenseQuery(connectionQueries.list());

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-medium">连接管理</h1>
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Service</TabsTrigger>
          <TabsTrigger value="service-map">Service Map</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="mt-4 space-y-4">
          <ServiceGrid connections={connections} />
        </TabsContent>
        <TabsContent value="service-map" className="mt-4">
          <ServiceMap />
        </TabsContent>
      </Tabs>
    </div>
  );
}
