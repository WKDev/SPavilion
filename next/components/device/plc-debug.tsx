"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"
import { InputPopover } from "./input-popover"
import { AddressRangeSelector } from "./address-range-selector"
import { cn } from "@/lib/utils"

export function PLCDebug() {
  const { plc, updateCoil, updateRegister } = useStore()
  const [plcHost, setPlcHost] = useState("localhost")
  const [plcPort, setPlcPort] = useState("502")
  const [registerDisplayMode, setRegisterDisplayMode] = useState<"decimal" | "hex">("decimal")
  
  // 주소 범위 상태
  const [coilRange, setCoilRange] = useState({ start: 0, count: 100 })
  const [registerRange, setRegisterRange] = useState({ start: 0, count: 100 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PLC 상태 로딩
  const loadPLCState = async (type: 'coils' | 'registers', start: number, count: number) => {
    setLoading(true)
    setError(null)
    
    try {
      if (type === 'coils') {
        const response = await api.getPLCCoils(start, count)
        response.data.forEach((value, index) => {
          updateCoil(start + index, value)
        })
      } else {
        const response = await api.getPLCRegisters(start, count)
        response.data.forEach((value, index) => {
          updateRegister(start + index, value)
        })
      }
    } catch (err) {
      console.error(`Failed to fetch ${type}:`, err)
      setError(`Failed to load ${type}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // 초기 로딩
  useEffect(() => {
    loadPLCState('coils', coilRange.start, coilRange.count)
    loadPLCState('registers', registerRange.start, registerRange.count)
  }, [])

  const handleCoilRangeChange = (start: number, count: number) => {
    setCoilRange({ start, count })
    loadPLCState('coils', start, count)
  }

  const handleRegisterRangeChange = (start: number, count: number) => {
    setRegisterRange({ start, count })
    loadPLCState('registers', start, count)
  }

  const handleCoilClick = async (address: number) => {
    const newValue = !plc.coils[address]
    updateCoil(address, newValue)

    try {
      await api.setPLCCoil(address, newValue)
    } catch (error) {
      console.error("Failed to set coil:", error)
      updateCoil(address, !newValue) // Revert on error
    }
  }

  const handleRegisterChange = async (address: number, value: number) => {
    updateRegister(address, value)

    try {
      await api.setPLCRegister(address, value)
    } catch (error) {
      console.error("Failed to set register:", error)
      // 에러 발생 시 이전 값으로 복원 (현재는 단순히 로그만 출력)
    }
  }

  return (
    <div className="space-y-4">
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
                value={plcHost}
                onChange={(e) => setPlcHost(e.target.value)}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plc-port">Port</Label>
              <Input id="plc-port" value={plcPort} onChange={(e) => setPlcPort(e.target.value)} placeholder="502" />
            </div>
          </div>
          <Button>Connect</Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-destructive text-sm">{error}</div>
          </CardContent>
        </Card>
      )}

      {/* PLC Status */}
      <Card>
        <CardHeader>
          <CardTitle>PLC Status</CardTitle>
          <CardDescription>Monitor and control PLC coils and registers</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="coils">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="coils">Coils</TabsTrigger>
              <TabsTrigger value="registers">Registers</TabsTrigger>
            </TabsList>

            <TabsContent value="coils" className="space-y-4">
              {/* Coil Address Range Selector */}
              <AddressRangeSelector
                title="Coil Address Range"
                description="Select the coil address range to query (Max 2000 addresses per request)"
                onRangeChange={handleCoilRangeChange}
                defaultStart={coilRange.start}
                defaultCount={coilRange.count}
                maxAddress={65535}
              />

              {/* Coil Status Display */}
              <div className="rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    Coil Status ({coilRange.start}-{coilRange.start + coilRange.count - 1})
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Click to toggle</p>
                    {loading && <div className="text-xs text-blue-600">Loading...</div>}
                  </div>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: coilRange.count }, (_, index) => {
                    const address = coilRange.start + index
                    const isOn = plc.coils[address] || false
                    return (
                      <Button
                        key={address}
                        onClick={() => handleCoilClick(address)}
                        className={cn(
                          "h-8 w-full p-0 text-xs",
                          isOn ? "bg-green-600 hover:bg-green-700" : "bg-muted hover:bg-muted/80",
                        )}
                        variant={isOn ? "default" : "outline"}
                        title={`Coil ${address}: ${isOn ? "ON" : "OFF"}`}
                        disabled={loading}
                      >
                        {address}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="registers" className="space-y-4">
              {/* Register Address Range Selector */}
              <AddressRangeSelector
                title="Register Address Range"
                description="Select the register address range to query (Max 2000 addresses per request)"
                onRangeChange={handleRegisterRangeChange}
                defaultStart={registerRange.start}
                defaultCount={registerRange.count}
                maxAddress={65535}
              />

              {/* Register Status Display */}
              <div className="rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    Register Status ({registerRange.start}-{registerRange.start + registerRange.count - 1})
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Display:</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRegisterDisplayMode(registerDisplayMode === "decimal" ? "hex" : "decimal")}
                    >
                      {registerDisplayMode === "decimal" ? "DEC" : "HEX"}
                    </Button>
                    {loading && <div className="text-xs text-blue-600">Loading...</div>}
                  </div>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: registerRange.count }, (_, index) => {
                    const address = registerRange.start + index
                    const value = plc.registers[address] || 0
                    return (
                      <InputPopover
                        key={address}
                        title={`Register ${address}`}
                        address={address}
                        value={value}
                        onConfirm={(newValue) => handleRegisterChange(address, newValue)}
                      >
                        <Button
                          className={cn(
                            "h-8 w-full p-0 text-xs",
                            value !== 0 ? "bg-green-600 hover:bg-green-700" : "bg-muted hover:bg-muted/80",
                          )}
                          variant={value !== 0 ? "default" : "outline"}
                          title={`Register ${address}: ${value}`}
                          disabled={loading}
                        >
                          {address}
                        </Button>
                      </InputPopover>
                    )
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
