"use client"

/**
 * Device List Component
 * 장치 목록을 표시하고 개별 제어를 제공합니다.
 *
 * API: GET /api/devices, POST /api/devices/control
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TMButton } from "@/components/device/tm-button"
import { api, ApiClientError } from "@/lib/api"
import type { Device } from "@/lib/types"

export function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await api.getDevices()
        setDevices(data)
        setError(null)
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(`장치 조회 실패: ${err.message}`)
        } else {
          setError("장치 조회 중 알 수 없는 에러가 발생했습니다.")
        }
        console.error("Failed to fetch devices:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchDevices()
  }, [])

  const handleToggle = async (device: Device) => {
    try {
      // Use momentary switch for rising edge detection
      // Convert UI device ID to API device kind
      const deviceKindMap: Record<string, string> = {
        'heat': 'heat',
        'fan': 'fan', 
        'btsp': 'btsp',
        'light-red': 'light_red',
        'light-green': 'light_green',
        'light-blue': 'light_blue',
        'light-white': 'light_white',
        'display': 'display'
      }
      
      const deviceKind = deviceKindMap[device.id]
      if (!deviceKind) {
        throw new Error(`Unknown device ID: ${device.id}`)
      }

      console.log(`[DeviceList] Executing momentary switch for ${deviceKind}`)
      await api.momentarySwitch(deviceKind)
      console.log(`[DeviceList] Momentary switch completed for ${deviceKind}`)
    } catch (err) {
      if (err instanceof ApiClientError) {
        console.error(`장치 제어 실패 [${err.statusCode}]:`, err.message)
      } else {
        console.error("장치 제어 실패:", err)
      }
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading devices...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex h-64 flex-col items-center justify-center gap-2">
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground">
            백엔드 서버가 실행 중인지 확인하세요.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {devices.map((device) => (
        <Card key={device.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{device.name}</CardTitle>
                <CardDescription>ID: {device.id}</CardDescription>
              </div>
              <Badge variant={device.status === "online" ? "default" : "secondary"}>{device.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <TMButton
              title={device.isOn ? "Turn Off" : "Turn On"}
              isOn={device.isOn}
              progress={device.progress}
              onToggle={() => handleToggle(device)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
