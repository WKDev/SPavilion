"use client"

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { TimeRangeSelector } from "@/components/usage/time-range-selector"

export function Header() {
  const pathname = usePathname()

  // Show TimeRangeSelector on pages that use time-based data
  const showTimeRangeSelector = pathname === "/dashboard" || pathname === "/usage"

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        {/* <h1 className="text-xl font-semibold">주 화면</h1> */}
      </div>
      <div className="flex items-center gap-4">
        {showTimeRangeSelector && <TimeRangeSelector />}
      </div>
    </header>
  )
}
