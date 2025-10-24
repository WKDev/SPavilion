"use client"

import { useEffect, useRef } from "react"
import { useStore } from "@/lib/store"
import { PLCPollingService } from "@/lib/plc-polling"

export function usePLCPolling(enabled = true, interval = 1000) {
  const { updateCoil, updateRegister, setPolling } = useStore()
  const pollingServiceRef = useRef<PLCPollingService | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Create polling service
    pollingServiceRef.current = new PLCPollingService((coils, registers) => {
      // Update store with new data
      coils.forEach((value, index) => {
        updateCoil(index, value)
      })
      registers.forEach((value, index) => {
        updateRegister(index, value)
      })
    })

    // Start polling
    pollingServiceRef.current.start(interval)
    setPolling(true)

    // Cleanup on unmount
    return () => {
      if (pollingServiceRef.current) {
        pollingServiceRef.current.stop()
        setPolling(false)
      }
    }
  }, [enabled, interval, updateCoil, updateRegister, setPolling])

  return {
    isActive: pollingServiceRef.current?.isActive() || false,
    stop: () => {
      pollingServiceRef.current?.stop()
      setPolling(false)
    },
    start: () => {
      pollingServiceRef.current?.start(interval)
      setPolling(true)
    },
    setInterval: (newInterval: number) => {
      pollingServiceRef.current?.setInterval(newInterval)
    },
  }
}
