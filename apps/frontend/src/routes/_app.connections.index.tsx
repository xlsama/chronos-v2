import { useMemo, useState } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Connection } from "@chronos/shared";
import { Library, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConnectionImportDialog } from "@/components/connections/connection-import-dialog";
import { ServiceGrid } from "@/components/connections/service-grid";
import { ServiceMapEditor, ServiceMapEmpty } from "@/components/connections/service-map";
import { connectionQueries } from "@/lib/queries/connections";
import { serviceMapQueries, useCreateServiceMap, useUpdateServiceMap, useDeleteServiceMap } from "@/lib/queries/service-maps";
import { Spinner } from "@/components/ui/spinner";
import type { ServiceMapGraph } from "@chronos/shared";

const EMPTY_SERVICE_MAPS: never[] = [];

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
  const { data: connections } = useSuspenseQuery({
    ...connectionQueries.list(),
    refetchInterval: (query) => {
      const data = query.state.data as Connection[] | undefined
      return data?.some((c) => c.mcpStatus === 'registering') ? 3000 : false
    },
  });
  const { data: serviceMaps = EMPTY_SERVICE_MAPS } = useQuery(serviceMapQueries.list());
  const [search, setSearch] = useState("");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

  const createMap = useCreateServiceMap();
  const updateMap = useUpdateServiceMap();
  const deleteMap = useDeleteServiceMap();

  const filtered = useMemo(() => {
    if (!search.trim()) return connections;
    const q = search.toLowerCase();
    return connections.filter(
      (c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q),
    );
  }, [connections, search]);

  // Auto-select first map if none selected
  const activeMapId = selectedMapId ?? serviceMaps[0]?.id ?? null;
  const activeMap = serviceMaps.find((m) => m.id === activeMapId);

  const handleCreateMap = async (name: string) => {
    try {
      const result = await createMap.mutateAsync({
        name,
        graph: { nodes: [], edges: [] },
      });
      setSelectedMapId(result.id);
      toast.success("Service Map 已创建");
    } catch {
      toast.error("创建失败");
    }
  };

  const handleSaveGraph = async (graph: ServiceMapGraph) => {
    if (!activeMapId) return;
    try {
      await updateMap.mutateAsync({ id: activeMapId, data: { graph } });
      toast.success("已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  const handleDeleteMap = async () => {
    if (!activeMapId) return;
    try {
      await deleteMap.mutateAsync(activeMapId);
      setSelectedMapId(null);
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <Tabs defaultValue="services" className="flex h-full flex-col">
      {/* 固定 Header 区域 */}
      <div className="shrink-0 space-y-4 p-6 pb-4">
        <h1 className="text-xl font-medium">连接管理</h1>
        <TabsList>
          <TabsTrigger value="services">Service</TabsTrigger>
          <TabsTrigger value="service-map">Service Map</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="搜索服务..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ConnectionImportDialog
            trigger={(
              <Button variant="outline">
                <Library className="size-4" />
                从知识库导入
              </Button>
            )}
          />
          <Button asChild>
            <Link to="/connections/create">
              <Plus className="size-4" />
              添加服务
            </Link>
          </Button>
        </div>
      </div>

      {/* 可滚动内容区域 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <TabsContent value="services" className="mt-0">
          <ServiceGrid connections={filtered} search={search} />
        </TabsContent>
        <TabsContent value="service-map" className="mt-0 flex h-full flex-col gap-3">
          {serviceMaps.length > 0 ? (
            <>
              {/* Map selector */}
              <div className="flex items-center gap-2">
                <Select
                  value={activeMapId ?? undefined}
                  onValueChange={setSelectedMapId}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="选择 Service Map" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceMaps.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const name = prompt("输入 Service Map 名称")
                    if (name?.trim()) handleCreateMap(name.trim())
                  }}
                >
                  <Plus className="mr-1 size-3.5" />
                  新建
                </Button>

                {activeMapId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="mr-1 size-3.5" />
                        删除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                          删除后无法恢复，确定要删除 "{activeMap?.name}" 吗？
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMap}>删除</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {/* Map editor */}
              {activeMap && (
                <div className="min-h-0 flex-1 rounded-lg border">
                  <ServiceMapEditor
                    key={activeMap.id}
                    serviceMap={activeMap}
                    onSave={handleSaveGraph}
                    saving={updateMap.isPending}
                  />
                </div>
              )}
            </>
          ) : (
            <ServiceMapEmpty onCreate={handleCreateMap} />
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}
