import { Archive, FolderKanban, Inbox, LibraryBig, ScrollText, Sparkles, Waypoints } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/sidebar/nav-user";
import { LogoFull, LogoIcon } from "@/components/logo";

const mainNav = [
  { title: "收件箱", icon: Inbox, to: "/inbox" as const },
  { title: "项目", icon: FolderKanban, to: "/projects" as const },
];

const platformNav = [
  { title: "知识库", icon: LibraryBig, to: "/knowledge-base" as const },
  { title: "Runbook", icon: ScrollText, to: "/runbooks" as const },
  { title: "Incident History", icon: Archive, to: "/incident-history" as const },
  { title: "Services", icon: Waypoints, to: "/services" as const },
  { title: "Skills", icon: Sparkles, to: "/skills" as const },
];

export function AppSidebar() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarHeaderContent />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.to || pathname.startsWith(item.to + "/")}
                    tooltip={item.title}
                  >
                    <Link to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Context</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.to || pathname.startsWith(item.to + "/")}
                    tooltip={item.title}
                  >
                    <Link to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarHeaderContent() {
  const { state } = useSidebar();

  return (
    <div className="flex items-center justify-between px-1 py-1">
      {state === "expanded" ? (
        <>
          <Link to="/projects">
            <LogoFull className="h-7 w-auto text-foreground" />
          </Link>
          <SidebarTrigger />
        </>
      ) : (
        <SidebarTrigger className="mx-auto">
          <LogoIcon className="size-5 text-foreground" />
        </SidebarTrigger>
      )}
    </div>
  );
}
