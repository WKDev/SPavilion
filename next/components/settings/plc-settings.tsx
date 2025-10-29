"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePLCPolling } from "@/hooks/use-plc-polling"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"

type ProtocolType = "modbusTCP" | "modbusRTU"

export function PLCSettings() {
  const isPolling = useStore((state) => state.isPolling)
  const [pollingInterval, setPollingInterval] = useState(1000)
  const [pollingEnabled, setPollingEnabled] = useState(true)
  const [protocol, setProtocol] = useState<ProtocolType>("modbusRTU")
  
  // Modbus TCP settings
  const [tcpHost, setTcpHost] = useState("localhost")
  const [tcpPort, setTcpPort] = useState("502")
  
  // Modbus RTU settings
  const [rtuDevice, setRtuDevice] = useState("/dev/ttyUSB0")
  const [rtuBaudRate, setRtuBaudRate] = useState("9600")
  
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>("")
  
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

  const handleConnect = async () => {
    setIsConnecting(true)
    setConnectionStatus("Connecting...")
    
    try {
      // Prepare connection settings based on protocol
      const settings: {
        protocol: 'modbusTCP' | 'modbusRTU'
        host?: string
        port?: number
        device?: string
        baudRate?: number
      } = {
        protocol
      }
      
      if (protocol === 'modbusTCP') {
        settings.host = tcpHost
        settings.port = parseInt(tcpPort)
      } else {
        settings.device = rtuDevice
        settings.baudRate = parseInt(rtuBaudRate)
      }
      
      const result = await api.connectPLC(settings)
      setConnectionStatus(result.message)
    } catch (error: any) {
      setConnectionStatus(`Connection failed: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PLC Configuration</CardTitle>
        <CardDescription>Configure PLC connection and polling settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Connection Settings</h3>
          
          {/* Protocol Selection */}
          <div className="space-y-2">
            <Label htmlFor="protocol">Connection Protocol</Label>
            <Select value={protocol} onValueChange={(value) => setProtocol(value as ProtocolType)}>
              <SelectTrigger id="protocol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modbusTCP">Modbus TCP</SelectItem>
                <SelectItem value="modbusRTU">Modbus RTU</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {protocol === "modbusTCP" 
                ? "TCP/IP network connection" 
                : "Serial RS-485/RS-232 connection"}
            </p>
          </div>

          {/* Conditional Fields - Modbus TCP */}
          {protocol === "modbusTCP" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plc-host">Host</Label>
                <Input
                  id="plc-host"
                  value={tcpHost}
                  onChange={(e) => setTcpHost(e.target.value)}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plc-port">Port</Label>
                <Input
                  id="plc-port"
                  type="number"
                  value={tcpPort}
                  onChange={(e) => setTcpPort(e.target.value)}
                  placeholder="502"
                />
              </div>
            </div>
          )}

          {/* Conditional Fields - Modbus RTU */}
          {protocol === "modbusRTU" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="plc-device">Device Path</Label>
                <Input
                  id="plc-device"
                  value={rtuDevice}
                  onChange={(e) => setRtuDevice(e.target.value)}
                  placeholder="/dev/ttyUSB0"
                />
                <p className="text-xs text-muted-foreground">Serial device path for PLC connection</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plc-baud">Baud Rate</Label>
                <Input
                  id="plc-baud"
                  value={rtuBaudRate}
                  onChange={(e) => setRtuBaudRate(e.target.value)}
                  placeholder="9600"
                />
                <p className="text-xs text-muted-foreground">Serial communication baud rate</p>
              </div>
            </>
          )}

          {/* Connection Status */}
          {connectionStatus && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground">{connectionStatus}</p>
            </div>
          )}

          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
        </div>

        {/* Polling Settings */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-sm font-medium">Polling Settings</h3>
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
        </div>
      </CardContent>
    </Card>
  )
}
