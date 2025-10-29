"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"
import { InputPopover } from "./input-popover"
import { AddressRangeSelector } from "./address-range-selector"
import { cn } from "@/lib/utils"

export function PLCDebug() {
  const { plc, updateCoil, updateRegister } = useStore()

  // Display mode states
  const [columnCount, setColumnCount] = useState<10 | 16>(10)
  const [addressDisplayMode, setAddressDisplayMode] = useState<"decimal" | "hex">("decimal")
  const [registerDisplayMode, setRegisterDisplayMode] = useState<"decimal" | "hex">("decimal")

  // 주소 범위 상태
  const [coilRange, setCoilRange] = useState({ start: 0, count: 100 })
  const [registerRange, setRegisterRange] = useState({ start: 0, count: 100 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper function for hex formatting with 0x prefix and 4 digits
  const formatHex = (value: number): string => {
    return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`
  }

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
          <CardTitle>PLC Debug</CardTitle>
          <CardDescription>Monitor and control PLC coils and registers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Coils Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Coils</h3>

              {/* Coil Address Range Selector */}
              <AddressRangeSelector
                title="Coil Address"
                description="Select range (Max 2000)"
                onRangeChange={handleCoilRangeChange}
                defaultStart={coilRange.start}
                defaultCount={coilRange.count}
                maxAddress={65535}
              />

              {/* Coil Status Display */}
              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-medium">
                    Range: {addressDisplayMode === "hex" ? formatHex(coilRange.start) : coilRange.start}-
                    {addressDisplayMode === "hex" ? formatHex(coilRange.start + coilRange.count - 1) : coilRange.start + coilRange.count - 1}
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Columns:</Label>
                      <div className="flex border rounded">
                        <Button
                          variant={columnCount === 10 ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setColumnCount(10)}
                          className="h-6 px-2 text-xs rounded-r-none"
                        >
                          10
                        </Button>
                        <Button
                          variant={columnCount === 16 ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setColumnCount(16)}
                          className="h-6 px-2 text-xs rounded-l-none border-l"
                        >
                          16
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Addr:</Label>
                      <div className="flex border rounded">
                        <Button
                          variant={addressDisplayMode === "decimal" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setAddressDisplayMode("decimal")}
                          className="h-6 px-2 text-xs rounded-r-none"
                        >
                          DEC
                        </Button>
                        <Button
                          variant={addressDisplayMode === "hex" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setAddressDisplayMode("hex")}
                          className="h-6 px-2 text-xs rounded-l-none border-l"
                        >
                          HEX
                        </Button>
                      </div>
                    </div>
                    {loading && <div className="text-xs text-blue-600">Loading...</div>}
                  </div>
                </div>
                <div className={cn("grid gap-1", columnCount === 10 ? "grid-cols-11" : "grid-cols-17")}>
                  {/* Column headers */}
                  <div></div>
                  {Array.from({ length: columnCount }, (_, i) => (
                    <Button
                      key={`col-${i}`}
                      variant="ghost"
                      disabled
                      className="h-6 w-full p-0 text-[10px] font-medium opacity-60"
                    >
                      +{i}
                    </Button>
                  ))}

                  {/* Data rows with row headers */}
                  {Array.from({ length: Math.ceil(coilRange.count / columnCount) }, (_, rowIndex) => {
                    const rowStart = coilRange.start + rowIndex * columnCount
                    return (
                      <>
                        {/* Row header */}
                        <Button
                          key={`row-${rowIndex}`}
                          variant="ghost"
                          disabled
                          className="h-8 w-full p-0 text-[10px] font-medium opacity-60"
                        >
                          {addressDisplayMode === "hex" ? formatHex(rowStart) : rowStart}
                        </Button>

                        {/* Data cells */}
                        {Array.from({ length: columnCount }, (_, colIndex) => {
                          const index = rowIndex * columnCount + colIndex
                          if (index >= coilRange.count) {
                            return <div key={`empty-${index}`} />
                          }
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
                              title={`Coil ${addressDisplayMode === "hex" ? formatHex(address) : address}: ${isOn ? "ON" : "OFF"}`}
                              disabled={loading}
                            >
                              {isOn ? "1" : "0"}
                            </Button>
                          )
                        })}
                      </>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Registers Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Registers</h3>

              {/* Register Address Range Selector */}
              <AddressRangeSelector
                title="Register Address"
                description="Select range (Max 2000)"
                onRangeChange={handleRegisterRangeChange}
                defaultStart={registerRange.start}
                defaultCount={registerRange.count}
                maxAddress={65535}
              />

              {/* Register Status Display */}
              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-medium">
                    Range: {addressDisplayMode === "hex" ? formatHex(registerRange.start) : registerRange.start}-
                    {addressDisplayMode === "hex" ? formatHex(registerRange.start + registerRange.count - 1) : registerRange.start + registerRange.count - 1}
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Columns:</Label>
                      <div className="flex border rounded">
                        <Button
                          variant={columnCount === 10 ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setColumnCount(10)}
                          className="h-6 px-2 text-xs rounded-r-none"
                        >
                          10
                        </Button>
                        <Button
                          variant={columnCount === 16 ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setColumnCount(16)}
                          className="h-6 px-2 text-xs rounded-l-none border-l"
                        >
                          16
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Addr:</Label>
                      <div className="flex border rounded">
                        <Button
                          variant={addressDisplayMode === "decimal" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setAddressDisplayMode("decimal")}
                          className="h-6 px-2 text-xs rounded-r-none"
                        >
                          DEC
                        </Button>
                        <Button
                          variant={addressDisplayMode === "hex" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setAddressDisplayMode("hex")}
                          className="h-6 px-2 text-xs rounded-l-none border-l"
                        >
                          HEX
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Value:</Label>
                      <div className="flex border rounded">
                        <Button
                          variant={registerDisplayMode === "decimal" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setRegisterDisplayMode("decimal")}
                          className="h-6 px-2 text-xs rounded-r-none"
                        >
                          DEC
                        </Button>
                        <Button
                          variant={registerDisplayMode === "hex" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setRegisterDisplayMode("hex")}
                          className="h-6 px-2 text-xs rounded-l-none border-l"
                        >
                          HEX
                        </Button>
                      </div>
                    </div>
                    {loading && <div className="text-xs text-blue-600">Loading...</div>}
                  </div>
                </div>
                <div className={cn("grid gap-1", columnCount === 10 ? "grid-cols-11" : "grid-cols-17")}>
                  {/* Column headers */}
                  <div></div>
                  {Array.from({ length: columnCount }, (_, i) => (
                    <Button
                      key={`col-${i}`}
                      variant="ghost"
                      disabled
                      className="h-6 w-full p-0 text-[10px] font-medium opacity-60"
                    >
                      +{i}
                    </Button>
                  ))}

                  {/* Data rows with row headers */}
                  {Array.from({ length: Math.ceil(registerRange.count / columnCount) }, (_, rowIndex) => {
                    const rowStart = registerRange.start + rowIndex * columnCount
                    return (
                      <>
                        {/* Row header */}
                        <Button
                          key={`row-${rowIndex}`}
                          variant="ghost"
                          disabled
                          className="h-8 w-full p-0 text-[10px] font-medium opacity-60"
                        >
                          {addressDisplayMode === "hex" ? formatHex(rowStart) : rowStart}
                        </Button>

                        {/* Data cells */}
                        {Array.from({ length: columnCount }, (_, colIndex) => {
                          const index = rowIndex * columnCount + colIndex
                          if (index >= registerRange.count) {
                            return <div key={`empty-${index}`} />
                          }
                          const address = registerRange.start + index
                          const value = plc.registers[address] || 0
                          const displayValue = registerDisplayMode === "hex" ? formatHex(value) : value
                          return (
                            <InputPopover
                              key={address}
                              title={`Register ${addressDisplayMode === "hex" ? formatHex(address) : address}`}
                              address={address}
                              value={value}
                              onConfirm={(newValue) => handleRegisterChange(address, newValue)}
                            >
                              <Button
                                className={cn(
                                  "h-8 w-full p-0 text-[10px]",
                                  value !== 0 ? "bg-green-600 hover:bg-green-700" : "bg-muted hover:bg-muted/80",
                                )}
                                variant={value !== 0 ? "default" : "outline"}
                                title={`Register ${addressDisplayMode === "hex" ? formatHex(address) : address}: ${displayValue}`}
                                disabled={loading}
                              >
                                {displayValue}
                              </Button>
                            </InputPopover>
                          )
                        })}
                      </>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
