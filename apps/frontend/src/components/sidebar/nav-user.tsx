import { useState } from 'react'
import {
  ChevronsUpDown,
  LogOut,
  Moon,
  Settings,
  Sun,
  Monitor,
} from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTheme } from '@/contexts/theme-provider'
import { SettingsDialog } from './settings-dialog'

const user = {
  name: 'Admin',
  email: 'admin@chronos.dev',
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { setTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">A</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                <Settings className="mr-2 size-4" />
                设置
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun className="mr-2 size-4 dark:hidden" />
                  <Moon className="mr-2 hidden size-4 dark:block" />
                  主题
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => setTheme('light')}>
                    <Sun className="mr-2 size-4" />
                    浅色
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTheme('dark')}>
                    <Moon className="mr-2 size-4" />
                    深色
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTheme('system')}>
                    <Monitor className="mr-2 size-4" />
                    跟随系统
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 size-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
