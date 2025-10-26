import type React from "react"
import { AppSidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { SidebarProvider } from "@/components/ui/sidebar"
import { PLCPollingProvider } from "@/components/providers/plc-polling-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PLCPollingProvider enabled={true} interval={1000}>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <Header />
            <main className="flex-1 overflow-auto p-3">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </PLCPollingProvider>
  )
}
