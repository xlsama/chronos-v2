import {
  BookOpen,
  Inbox,
  LayoutDashboard,
  Map,
  Zap,
} from 'lucide-react'
import { Link, useMatchRoute } from '@tanstack/react-router'

import { ModeToggle } from '@/components/theme-toggle'
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
} from '@/components/ui/sidebar'

const navItems = [
  { title: '收件箱', icon: Inbox, to: '/inbox' as const, disabled: false },
  { title: '仪表盘', icon: LayoutDashboard, to: '/' as const, disabled: true },
  { title: '运行手册', icon: BookOpen, to: '/' as const, disabled: true },
  { title: '拓扑', icon: Map, to: '/' as const, disabled: true },
  { title: '技能', icon: Zap, to: '/' as const, disabled: true },
]

export function AppSidebar() {
  const matchRoute = useMatchRoute()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold">
            C
          </div>
          <span className="text-lg font-semibold">Chronos</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={!item.disabled}
                    isActive={!item.disabled && !!matchRoute({ to: item.to, fuzzy: true })}
                    disabled={item.disabled}
                    tooltip={item.title}
                  >
                    {item.disabled ? (
                      <span className="opacity-50">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </span>
                    ) : (
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between px-2">
          <ModeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
