import {
  BookOpen,
  Cable,
  Inbox,
} from 'lucide-react'
import { Link, useMatchRoute } from '@tanstack/react-router'

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
} from '@/components/ui/sidebar'
import { NavUser } from '@/components/sidebar/nav-user'
import { LogoFull, LogoIcon } from '@/components/logo'

const mainNav = [
  { title: '收件箱', icon: Inbox, to: '/inbox' as const },
]

const platformNav = [
  { title: '连接', icon: Cable, to: '/connections' as const },
  { title: '运行手册', icon: BookOpen, to: '/runbooks' as const },
]

export function AppSidebar() {
  const matchRoute = useMatchRoute()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarHeaderContent />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>主要</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={!!matchRoute({ to: item.to, fuzzy: true })}
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
          <SidebarGroupLabel>平台</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={!!matchRoute({ to: item.to, fuzzy: true })}
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
  )
}

function SidebarHeaderContent() {
  const { state } = useSidebar()

  return (
    <div className="flex items-center justify-between px-1 py-1">
      {state === 'expanded' ? (
        <>
          <LogoFull className="h-6 w-auto" />
          <SidebarTrigger />
        </>
      ) : (
        <SidebarTrigger className="mx-auto">
          <LogoIcon className="size-5" />
        </SidebarTrigger>
      )}
    </div>
  )
}
