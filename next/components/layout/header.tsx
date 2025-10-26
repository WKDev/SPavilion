"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store"
import { Activity } from "lucide-react"

export function Header() {
  const isPolling = useStore((state) => state.isPolling)

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <h1 className="text-xl font-semibold">SPav</h1>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant={isPolling ? "default" : "secondary"} className="gap-2">
          <Activity className={`h-3 w-3 ${isPolling ? "animate-pulse" : ""}`} />
          {isPolling ? "Polling Active" : "Polling Inactive"}
        </Badge>
      </div>
    </header>
  )
}
