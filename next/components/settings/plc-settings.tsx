"use client"

import { useState, useEffect } from "react"
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
  const [protocol, setProtocol] = useState<ProtocolType>("modbusTCP")

  // Modbus TCP settings
  const [tcpHost, setTcpHost] = useState("mock-modbus")
  const [tcpPort, setTcpPort] = useState("502")

  // Modbus RTU settings
  const [rtuDevice, setRtuDevice] = useState("/dev/ttyUSB0")
  const [rtuBaudRate, setRtuBaudRate] = useState("9600")

  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>("")
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  const polling = usePLCPolling(pollingEnabled, pollingInterval)

  // Fetch current connection settings on component mount
  useEffect(() => {
    async function loadCurrentSettings() {
      try {
        setIsLoadingSettings(true)
        const settings = await api.getPLCConnectionSettings()

        // Update state with fetched settings
        setProtocol(settings.protocol)

        if (settings.protocol === "modbusTCP") {
          if (settings.host) setTcpHost(settings.host)
          if (settings.port) setTcpPort(settings.port.toString())
        } else {
          if (settings.device) setRtuDevice(settings.device)
          if (settings.baudRate) setRtuBaudRate(settings.baudRate.toString())
        }

        setConnectionStatus("Loaded saved settings")
      } catch (error: any) {
        console.error("Failed to load connection settings:", error)
        setConnectionStatus(`Failed to load settings: ${error?.message || 'Unknown error'}`)
      } finally {
        setIsLoadingSettings(false)
      }
    }

    loadCurrentSettings()
  }, [])

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
        <CardTitle>PLC 연결 설정</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 grid grid-cols-2 gap-4">
        
        {/* Connection Settings */}
        <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="protocol">연결방식</Label>           
              <Select value={protocol} onValueChange={(value) => setProtocol(value as ProtocolType)}>
              <SelectTrigger id="protocol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modbusTCP">Modbus TCP</SelectItem>
                <SelectItem value="modbusRTU">Modbus RTU</SelectItem>
              </SelectContent>
            </Select>
            </div>
        

          {/* Conditional Fields - Modbus TCP */}
          {protocol === "modbusTCP" && (
              <div className="flex flex-row gap-4">
              <div className="space-y-2">
                <Label htmlFor="plc-host">Host</Label>
                <Input
                  id="plc-host"
                  value={tcpHost}
                  className="w-full"
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
                  className="w-full"
                  onChange={(e) => setTcpPort(e.target.value)}
                  placeholder="502"
                />
              </div>
            </div>
          )}

          {/* Conditional Fields - Modbus RTU */}
          {protocol === "modbusRTU" && (
            <>
              <div className="flex flex-row gap-4">
              <div className="space-y-2">
                <Label htmlFor="plc-device">장치 경로</Label>
                <Input
                  id="plc-device"
                  value={rtuDevice}
                  className="w-full"
                  onChange={(e) => setRtuDevice(e.target.value)}
                  placeholder="/dev/ttyUSB0"
                />
              </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plc-baud">Baud</Label>
                <Input
                  id="plc-baud"
                  value={rtuBaudRate}
                  onChange={(e) => setRtuBaudRate(e.target.value)}
                  placeholder="9600"
                />
              </div>
            </>
          )}

          <Button className="" onClick={handleConnect} disabled={isConnecting || isLoadingSettings}>
            {isLoadingSettings ? "Loading..." : isConnecting ? "Connecting..." : "Connect"}
          </Button>
          </div>

          {/* Connection Status */}
          {connectionStatus && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground">{connectionStatus}</p>
            </div>
          )}

        </div>

        {/* Polling Settings */}
        <div className="space-y-4 border-l pl-4">
          {/* <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Polling</Label>
              <p className="text-xs text-muted-foreground">Automatically fetch PLC status</p>
            </div>
            <Switch checked={pollingEnabled} onCheckedChange={handleTogglePolling} />
          </div> */}

          <div className="space-y-2">
            <Label htmlFor="polling-interval">스캔 주기(ms)</Label>
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
            <p className="text-xs text-muted-foreground">기본값: 1000ms (1s)</p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">PLC 스캔 상태</span>
              <span className={`text-sm ${isPolling ? "text-green-600" : "text-muted-foreground"}`}>
                {isPolling ? "활성" : "비활성"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
