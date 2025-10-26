"use client"

/**
 * PLC 폴링 훅
 * 실시간으로 장치 상태를 폴링하여 Zustand store를 업데이트합니다.
 *
 * 현재는 Device 상태만 폴링 (GET /api/devices)
 * 추후 백엔드에 PLC Coils/Registers 엔드포인트가 추가되면 확장 가능
 */

import { useEffect, useRef, useState } from "react"
import { useStore } from "@/lib/store"
import { DevicePollingService } from "@/lib/device-polling"
import { PLCPollingService } from "@/lib/plc-polling"
import type { Device } from "@/lib/types"

export function usePLCPolling(enabled = true, interval = 1000) {
  const { updateDevice, setPolling } = useStore()
  const devicePollingRef = useRef<DevicePollingService | null>(null)
  const plcPollingRef = useRef<PLCPollingService | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Device Polling Service (실제 API 연동)
    devicePollingRef.current = new DevicePollingService(
      (devices: Device[]) => {
        // 장치 상태를 Zustand store에 업데이트
        devices.forEach((device) => {
          updateDevice(device.id, {
            isOn: device.isOn,
            progress: device.progress,
          })
        })
        // 에러 초기화
        setError(null)
      },
      (err: Error) => {
        // 에러 처리
        setError(err)
        console.error("Device polling error:", err)
      }
    )

    // Start device polling
    devicePollingRef.current.start(interval)
    setPolling(true)

    // PLC Coils/Registers 폴링 (실제 API 연동)
    plcPollingRef.current = new PLCPollingService((coils, registers) => {
      // PLC 상태를 Zustand store에 업데이트
      coils.forEach((value, index) => {
        updateCoil(index, value)
      })
      registers.forEach((value, index) => {
        updateRegister(index, value)
      })
    })

    // Start PLC polling
    plcPollingRef.current.start(interval)

    // Cleanup on unmount
    return () => {
      if (devicePollingRef.current) {
        devicePollingRef.current.stop()
        setPolling(false)
      }
      if (plcPollingRef.current) {
        plcPollingRef.current.stop()
      }
    }
  }, [enabled, interval, updateDevice, setPolling])

  return {
    isActive: devicePollingRef.current?.isActive() || false,
    error,
    stop: () => {
      devicePollingRef.current?.stop()
      plcPollingRef.current?.stop()
      setPolling(false)
    },
    start: () => {
      devicePollingRef.current?.start(interval)
      setPolling(true)
    },
    setInterval: (newInterval: number) => {
      devicePollingRef.current?.setInterval(newInterval)
    },
  }
}
