"use client"

/**
 * PLC 및 장치 상태 글로벌 폴링 훅
 * 실시간으로 모든 상태를 폴링하여 Zustand store를 업데이트합니다.
 */

import { useEffect, useRef, useState } from "react"
import { useStore, type DeviceState } from "@/lib/store"
import { GlobalPollingService } from "@/lib/device-polling"
import { toUiDeviceId } from "@/lib/device-mapper"
import type { AllDeviceStatus } from "@/lib/api"

// Make the polling service a singleton so it persists across component re-renders
let globalPollingService: GlobalPollingService | null = null;

export function usePLCPolling(enabled = true, interval = 100) {
  // Use individual selectors to ensure stable references
  const updateDevice = useStore((state) => state.updateDevice)
  const updateCoil = useStore((state) => state.updateCoil)
  const updateRegister = useStore((state) => state.updateRegister)
  const setPolling = useStore((state) => state.setPolling)
  const [error, setError] = useState<Error | null>(null)
  
  // useRef to hold a stable reference to the singleton instance for this hook instance
  const pollingServiceRef = useRef<GlobalPollingService | null>(null);
  // Store callbacks in ref to avoid recreating the service on every render
  const callbacksRef = useRef<{
    updateDevice: typeof updateDevice
    updateCoil: typeof updateCoil
    updateRegister: typeof updateRegister
  }>({
    updateDevice,
    updateCoil,
    updateRegister,
  })

  // Update callbacks ref when store functions change
  useEffect(() => {
    callbacksRef.current = { updateDevice, updateCoil, updateRegister }
  }, [updateDevice, updateCoil, updateRegister])

  useEffect(() => {
    if (!enabled) {
      if (pollingServiceRef.current) {
        pollingServiceRef.current.stop();
        setPolling(false);
      }
      return;
    }

    if (!globalPollingService) {
      globalPollingService = new GlobalPollingService(
        (status: AllDeviceStatus, coilStart: number, registerStart: number) => {
          // Update device statuses using ref callbacks to avoid stale closures
          Object.entries(status.devices).forEach(([kind, isOn]) => {
            const deviceId = toUiDeviceId(kind as any)
            // Only update if device exists in DeviceState (skip 'display' which is not in DeviceState)
            const validDeviceIds: (keyof DeviceState)[] = [
              "heat",
              "fan",
              "btsp",
              "light-red",
              "light-green",
              "light-blue",
              "light-white",
            ]
            if (validDeviceIds.includes(deviceId as keyof DeviceState)) {
              callbacksRef.current.updateDevice(deviceId as keyof DeviceState, { isOn, progress: 0 })
            }
          })

          // Update PLC coils and registers
          status.coils.forEach((value, index) =>
            callbacksRef.current.updateCoil(coilStart + index, value)
          )
          status.registers.forEach((value, index) =>
            callbacksRef.current.updateRegister(registerStart + index, value)
          )

          setError(null)
        },
        (err: Error) => {
          setError(err)
          console.error("Global polling error:", err)
        }
      )
    }
    
    pollingServiceRef.current = globalPollingService;
    pollingServiceRef.current.start(interval)
    setPolling(true)

    return () => {
      // 컴포넌트가 언마운트되어도 폴링을 중지하지 않습니다.
      // 앱 전체에서 하나의 폴링 서비스가 계속 실행됩니다.
    }
  }, [enabled, interval, setPolling])

  return {
    isActive: pollingServiceRef.current?.isActive() || false,
    error,
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
    // Expose range setters to components
    setCoilRange: (start: number, count: number) => {
      pollingServiceRef.current?.setCoilRange(start, count);
    },
    setRegisterRange: (start: number, count: number) => {
      pollingServiceRef.current?.setRegisterRange(start, count);
    }
  }
}
