"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { usePLCPolling } from "@/hooks/use-plc-polling"
import { useStore } from "@/lib/store"
import { CameraAreaSelector } from "@/components/settings/camera-area-selector"
import { Camera } from "lucide-react"

export default function SettingsPage() {
  const isPolling = useStore((state) => state.isPolling)
  const [pollingInterval, setPollingInterval] = useState(1000)
  const [pollingEnabled, setPollingEnabled] = useState(true)
  const polling = usePLCPolling(pollingEnabled, pollingInterval)

  const handleIntervalChange = () => {
    polling.setInterval(pollingInterval)
  }

  const handleTogglePolling = (enabled: boolean) => {
    setPollingEnabled(enabled)
    if (enabled) {
      polling.start()
    } else {
      polling.stop()
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your PLC dashboard preferences</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* PLC Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>PLC Connection</CardTitle>
            <CardDescription>Configure PLC device location and port</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plc-host">Host</Label>
                <Input
                  id="plc-host"
                  defaultValue="localhost"
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plc-port">Port</Label>
                <Input
                  id="plc-port"
                  defaultValue="502"
                  placeholder="502"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plc-baud">Baud Rate</Label>
              <Input
                id="plc-baud"
                defaultValue="9600"
                placeholder="9600"
              />
              <p className="text-xs text-muted-foreground">Serial communication baud rate (for Modbus RTU)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plc-device">Device Path</Label>
              <Input
                id="plc-device"
                defaultValue="/dev/ttyUSB0"
                placeholder="/dev/ttyUSB0"
              />
              <p className="text-xs text-muted-foreground">Serial device path for PLC connection</p>
            </div>
            <Button>Connect</Button>
          </CardContent>
        </Card>

        {/* PLC Polling Settings */}
        <Card>
          <CardHeader>
            <CardTitle>PLC Polling</CardTitle>
            <CardDescription>PLC 통신을 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Polling</Label>
                <p className="text-xs text-muted-foreground">Automatically fetch PLC status</p>
              </div>
              <Switch checked={pollingEnabled} onCheckedChange={handleTogglePolling} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="polling-interval">Polling Interval (ms)</Label>
              <div className="flex gap-2">
                <Input
                  id="polling-interval"
                  type="number"
                  value={pollingInterval}
                  onChange={(e) => setPollingInterval(Number(e.target.value))}
                  min={100}
                  max={10000}
                  step={100}
                />
                <Button onClick={handleIntervalChange}>Apply</Button>
              </div>
              <p className="text-xs text-muted-foreground">Recommended: 1000ms (1 second)</p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <span className={`text-sm ${isPolling ? "text-green-600" : "text-muted-foreground"}`}>
                  {isPolling ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WebRTC Settings */}
        <Card>
          <CardHeader>
            <CardTitle>WebRTC Streaming</CardTitle>
            <CardDescription>Configure camera stream settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webrtc-url">카메라 경로</Label>
              <Input
                id="webrtc-url"
                type="text"
                defaultValue={process.env.NEXT_PUBLIC_WEBRTC_URL || "http://localhost:8889"}
                placeholder="http://localhost:8889"
              />
              <p className="text-xs text-muted-foreground">URL of the MediaMTX server</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stream-path">Stream Path</Label>
              <Input id="stream-path" type="text" defaultValue="/camera/" placeholder="/camera/" />
              <p className="text-xs text-muted-foreground">Path to the camera stream</p>
            </div>
          </CardContent>
        </Card>

        {/* API Settings */}
        <Card>
          <CardHeader>
            <CardTitle>API 구성</CardTitle>
            <CardDescription>데이터 관리/조회를 위한 API 경로를 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">API Base URL</Label>
              <Input
                id="api-url"
                type="text"
                defaultValue={process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"}
                placeholder="http://localhost:3000/api"
              />
                     </div>

            <Button variant="outline" className="w-full bg-transparent">
              Test Connection
            </Button>
          </CardContent>
        </Card>

        {/* Camera Area Settings */}
        <Card>
          <CardHeader>
            <CardTitle>카메라 감시 영역</CardTitle>
            <CardDescription>카메라 스트림에서 감시할 영역을 지정합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full" variant="outline">
                  <Camera className="mr-2 h-4 w-4" />
                  감시 영역 설정
                </Button>
              </DialogTrigger>
              <DialogContent className="overflow-auto">
                <CameraAreaSelector />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
