"use client"

import type { ReactNode } from "react"
import { usePLCPolling } from "@/hooks/use-plc-polling"

interface PLCPollingProviderProps {
  children: ReactNode
  enabled?: boolean
  interval?: number
}

export function PLCPollingProvider({ children, enabled = true, interval = 1000 }: PLCPollingProviderProps) {
  usePLCPolling(enabled, interval)

  return <>{children}</>
}
