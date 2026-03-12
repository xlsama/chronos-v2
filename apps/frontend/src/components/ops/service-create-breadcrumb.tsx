import { Link } from "@tanstack/react-router";
import type { ConnectionType } from "@chronos/shared";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SERVICE_TYPE_META } from "@/lib/constants/service-types";
import { ServiceIcon } from "./service-icon";

type ServiceCreateBreadcrumbProps = {
  currentLabel: string;
  type?: ConnectionType;
};

export function ServiceCreateBreadcrumb(props: ServiceCreateBreadcrumbProps) {
  const typeMeta = props.type ? SERVICE_TYPE_META[props.type] : undefined;

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-y-2 text-xs sm:text-sm">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/services">服务</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/services/create">新建服务</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="inline-flex items-center gap-2">
            {typeMeta ? <ServiceIcon type={props.type!} className="size-3.5 opacity-80" /> : null}
            <span>{props.currentLabel}</span>
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
