"use client"

import { useState, useEffect, Fragment } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"
import { InputPopover } from "./input-popover"
import { AddressRangeSelector } from "./address-range-selector"
import { cn } from "@/lib/utils"
import { usePLCPolling } from "@/hooks/use-plc-polling"

export function PLCDebug() {
  const { plc, updateCoil, updateRegister } = useStore()
  const { setCoilRange, setRegisterRange, error: pollingError } = usePLCPolling()

  // Display mode states
  const [columnCount, setColumnCount] = useState<10 | 16>(10)
  const [addressDisplayMode, setAddressDisplayMode] = useState<"decimal" | "hex">("decimal")
  const [registerDisplayMode, setRegisterDisplayMode] = useState<"decimal" | "hex">("decimal")

  // 주소 범위 상태
  const [coilRange, setLocalCoilRange] = useState(() => {
    if (typeof window === "undefined") {
      return { start: 0, count: 20 }
    }
    try {
      const saved = window.localStorage.getItem("plc-debug-coil-range")
      return saved ? JSON.parse(saved) : { start: 0, count: 20 }
    } catch (e) {
      console.error("Failed to parse coil range from localStorage", e)
      return { start: 0, count: 20 }
    }
  })
  const [registerRange, setLocalRegisterRange] = useState(() => {
    if (typeof window === "undefined") {
      return { start: 0, count: 20 }
    }
    try {
      const saved = window.localStorage.getItem("plc-debug-register-range")
      return saved ? JSON.parse(saved) : { start: 0, count: 20 }
    } catch (e) {
      console.error("Failed to parse register range from localStorage", e)
      return { start: 0, count: 20 }
    }
  })
  
  // error state can be retrieved from usePLCPolling hook if needed in the future
  const [writeError, setWriteError] = useState<string | null>(null) 

  // localStorage persistence
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("plc-debug-coil-range", JSON.stringify(coilRange))
      } catch (e) {
        console.error("Failed to save coil range to localStorage", e)
      }
    }
  }, [coilRange])

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("plc-debug-register-range", JSON.stringify(registerRange))
      } catch (e) {
        console.error("Failed to save register range to localStorage", e)
      }
    }
  }, [registerRange])

  // Initial setup for polling ranges
  useEffect(() => {
    setCoilRange(coilRange.start, coilRange.count)
    setRegisterRange(registerRange.start, registerRange.count)
  }, [setCoilRange, setRegisterRange, coilRange.start, coilRange.count, registerRange.start, registerRange.count])

  // Helper function for hex formatting with 0x prefix and 4 digits
  const formatHex = (value: number): string => {
    return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`
  }

  const handleCoilRangeChange = (start: number, count: number) => {
    setLocalCoilRange({ start, count });
    setCoilRange(start, count); // Update global polling service range
  };

  const handleRegisterRangeChange = (start: number, count: number) => {
    setLocalRegisterRange({ start, count });
    setRegisterRange(start, count); // Update global polling service range
  };

  const handleCoilClick = async (address: number) => {
    const newValue = !plc.coils[address]
    updateCoil(address, newValue)

    try {
      setWriteError(null);
      await api.setPLCCoil(address, newValue)
    } catch (error) {
      console.error("Failed to set coil:", error)
      setWriteError(`Failed to set coil ${address}: ${error instanceof Error ? error.message : "Check console"}`);
      updateCoil(address, !newValue) // Revert on error
    }
  }

  const handleRegisterChange = async (address: number, value: number) => {
    const oldValue = plc.registers[address];
    updateRegister(address, value)

    try {
      setWriteError(null);
      await api.setPLCRegister(address, value)
    } catch (error) {
      console.error("Failed to set register:", error)
      setWriteError(`Failed to set register ${address}: ${error instanceof Error ? error.message : "Check console"}`);
      updateRegister(address, oldValue); // Revert on error
    }
  }

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {(pollingError || writeError) && (
        <Card>
          <CardContent className="pt-4">
            {pollingError && <div className="text-destructive text-sm font-semibold">Polling Error: {pollingError.message || String(pollingError)}</div>}
            {writeError && <div className="text-destructive text-sm">{writeError}</div>}
          </CardContent>
        </Card>
      )}

      {/* PLC Status */}
      <Card>
        <CardHeader>
          <CardTitle>PLC 세부 정보</CardTitle>
          <CardDescription>PLC 코일과 레지스터 상태 모니터링 및 제어</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Coils Section */}
            <div className="space-y-3">
              {/* Coil Address Range Selector */}
              <AddressRangeSelector
                title="코일 주소"
                description="범위 선택 (최대 2000)"
                onRangeChange={handleCoilRangeChange}
                defaultStart={coilRange.start}
                defaultCount={coilRange.count}
                maxAddress={65535}
              />

              {/* Coil Status Display */}
              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-end">
                  <div className="flex items-end gap-4 justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">열 개수:</Label>
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
                      <Label className="text-xs text-muted-foreground">주소 표시 방식:</Label>
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
                    {/* {loading && <div className="text-xs text-blue-600">Loading...</div>} */}
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
                      <Fragment key={`coil-row-${rowIndex}`}>
                        {/* Row header */}
                        <Button
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
                            >
                              {isOn ? "1" : "0"}
                            </Button>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Registers Section */}
            <div className="space-y-3">
              {/* Register Address Range Selector */}
              <AddressRangeSelector
                title="레지스터 주소"
                description="레지스터 주소 범위 선택 (최대 2000)"
                onRangeChange={handleRegisterRangeChange}
                defaultStart={registerRange.start}
                defaultCount={registerRange.count}
                maxAddress={65535}
              />

              {/* Register Status Display */}
              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-end">
                  {/* <h4 className="text-xs font-medium">
                    Range: {addressDisplayMode === "hex" ? formatHex(registerRange.start) : registerRange.start}-
                    {addressDisplayMode === "hex" ? formatHex(registerRange.start + registerRange.count - 1) : registerRange.start + registerRange.count - 1}
                  </h4> */}
                  <div className="flex items-end gap-4 justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">열 개수:</Label>
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
                      <Label className="text-xs text-muted-foreground">주소 표시 방식:</Label>
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
                      <Label className="text-xs text-muted-foreground">값 표시 방식:</Label>
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
                    {/* {loading && <div className="text-xs text-blue-600">Loading...</div>} */}
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
                      <Fragment key={`register-row-${rowIndex}`}>
                        {/* Row header */}
                        <Button
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
                              >
                                {displayValue}
                              </Button>
                            </InputPopover>
                          )
                        })}
                      </Fragment>
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
