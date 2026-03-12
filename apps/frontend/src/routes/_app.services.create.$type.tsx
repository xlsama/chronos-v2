import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ConnectionType } from "@chronos/shared";
import { ServiceCreateBreadcrumb } from "@/components/ops/service-create-breadcrumb";
import { ServiceIcon } from "@/components/ops/service-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useServicesLayout } from "@/contexts/services-layout-context";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateService } from "@/lib/queries/ops";
import { SERVICE_TYPE_META } from "@/lib/constants/service-types";
import {
  buildConnectionConfig,
  connectionConfigFields,
  createConnectionFormDefaultValues,
  createConnectionFormSchema,
  type ConnectionFormValues,
} from "@/lib/schemas/connection";

export const Route = createFileRoute("/_app/services/create/$type")({
  component: CreateServiceFormPage,
});

function CreateServiceFormPage() {
  const { type } = Route.useParams();
  const connectionType = type as ConnectionType;
  const { activeProjectId } = useServicesLayout();
  const navigate = useNavigate();
  const createService = useCreateService();

  const meta = SERVICE_TYPE_META[connectionType];
  const fields = connectionConfigFields[connectionType] ?? [];

  const form = useForm<ConnectionFormValues>({
    defaultValues: createConnectionFormDefaultValues(connectionType),
    validators: { onSubmit: createConnectionFormSchema(connectionType) },
    onSubmit: async ({ value }) => {
      if (!activeProjectId) return;

      await createService.mutateAsync({
        projectId: activeProjectId,
        name: `${meta?.label ?? connectionType}-${Date.now()}`,
        type: connectionType,
        config: buildConnectionConfig(value, connectionType),
      });

      void navigate({ to: "/services" });
    },
  });

  return (
    <div className="flex flex-col gap-6 pb-14 md:pb-20">
      <ServiceCreateBreadcrumb currentLabel={meta?.label ?? connectionType} type={connectionType} />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/services/create">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <ServiceIcon type={connectionType} className="size-8" />
        <h2 className="text-lg font-semibold">{meta?.label ?? connectionType}</h2>
      </div>

      <Card className="w-full max-w-3xl">
        <CardContent className="pt-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
            className="flex flex-col gap-6"
          >
            {fields.length > 0 ? (
              <FieldGroup>
                {fields.map((configField) => (
                  <form.Field
                    key={configField.key}
                    name={configField.key as keyof ConnectionFormValues}
                    children={(field) => {
                      const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel>{configField.label}</FieldLabel>
                          <FieldContent>
                            {configField.type === "textarea" ? (
                              <Textarea
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(event) => field.handleChange(event.target.value)}
                                aria-invalid={isInvalid}
                                placeholder={configField.placeholder}
                                rows={4}
                                className="font-mono text-xs"
                              />
                            ) : (
                              <Input
                                type={
                                  configField.type === "password" ? "password" : configField.type
                                }
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(event) => field.handleChange(event.target.value)}
                                aria-invalid={isInvalid}
                                placeholder={configField.placeholder}
                              />
                            )}
                            {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                          </FieldContent>
                        </Field>
                      );
                    }}
                  />
                ))}
              </FieldGroup>
            ) : null}

            <div className="flex justify-end gap-2 border-t pt-6">
              <Button type="button" variant="outline" asChild>
                <Link to="/services/create">取消</Link>
              </Button>
              <Button type="submit" disabled={createService.isPending || !activeProjectId}>
                创建服务
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
