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
import { cn } from "@/lib/utils"

export function PLCDebug() {
  const { plc, updateCoil, updateRegister } = useStore()
  const [plcHost, setPlcHost] = useState("localhost")
  const [plcPort, setPlcPort] = useState("502")
  const [registerDisplayMode, setRegisterDisplayMode] = useState<"decimal" | "hex">("decimal")

  // Fetch initial PLC state
  useEffect(() => {
    const fetchPLCState = async () => {
      try {
        const [coils, registers] = await Promise.all([api.getPLCCoils(), api.getPLCRegisters()])
        coils.forEach((value, index) => updateCoil(index, value))
        registers.forEach((value, index) => updateRegister(index, value))
      } catch (error) {
        console.error("[v0] Failed to fetch PLC state:", error)
      }
    }

    fetchPLCState()
  }, [])

  const handleCoilClick = async (address: number) => {
    const newValue = !plc.coils[address]
    updateCoil(address, newValue)

    try {
      await api.setPLCCoil(address, newValue)
    } catch (error) {
      console.error("[v0] Failed to set coil:", error)
      updateCoil(address, !newValue) // Revert on error
    }
  }

  const handleRegisterChange = async (address: number, value: number) => {
    updateRegister(address, value)

    try {
      await api.setPLCRegister(address, value)
    } catch (error) {
      console.error("[v0] Failed to set register:", error)
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
              <div className="rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Coil Status (0-999)</h3>
                  <p className="text-xs text-muted-foreground">Click to toggle</p>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {plc.coils.slice(0, 1000).map((isOn, index) => (
                    <Button
                      key={index}
                      onClick={() => handleCoilClick(index)}
                      className={cn(
                        "h-8 w-full p-0 text-xs",
                        isOn ? "bg-green-600 hover:bg-green-700" : "bg-muted hover:bg-muted/80",
                      )}
                      variant={isOn ? "default" : "outline"}
                      title={`Coil ${index}: ${isOn ? "ON" : "OFF"}`}
                    >
                      {index}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="registers" className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Register Status (0-999)</h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Display:</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRegisterDisplayMode(registerDisplayMode === "decimal" ? "hex" : "decimal")}
                    >
                      {registerDisplayMode === "decimal" ? "DEC" : "HEX"}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {plc.registers.slice(0, 1000).map((value, index) => (
                    <InputPopover
                      key={index}
                      title={`Register ${index}`}
                      address={index}
                      value={value}
                      onConfirm={(newValue) => handleRegisterChange(index, newValue)}
                    >
                      <Button
                        className={cn(
                          "h-8 w-full p-0 text-xs",
                          value !== 0 ? "bg-green-600 hover:bg-green-700" : "bg-muted hover:bg-muted/80",
                        )}
                        variant={value !== 0 ? "default" : "outline"}
                        title={`Register ${index}: ${value}`}
                      >
                        {index}
                      </Button>
                    </InputPopover>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
