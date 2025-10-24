"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TMButton } from "@/components/device/tm-button"
import { api, type Device } from "@/lib/api"

export function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await api.getDevices()
        setDevices(data)
      } catch (error) {
      } finally {
        setLoading(false)
      }
    }

    fetchDevices()
  }, [])

  const handleToggle = async (device: Device) => {
    try {
      await api.controlDevice(device.id, device.isOn ? "off" : "on")
      setDevices((prev) => prev.map((d) => (d.id === device.id ? { ...d, isOn: !d.isOn } : d)))
    } catch (error) {}
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
