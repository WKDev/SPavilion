"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TMButton } from "@/components/device/tm-button"
import { useStore, useShortcutStore, type Shortcut } from "@/lib/store"
import { api } from "@/lib/api"
import { ShortcutsManager } from "@/components/device/shortcuts-manager"
import { Settings } from "lucide-react"

export function DevMan() {
  const { plc, triggerUsageHistRefresh } = useStore()
  const { shortcuts } = useShortcutStore()
  const [isManagerOpen, setIsManagerOpen] = useState(false)

  // Map command addresses to backend-compatible device kinds
  // Note: Backend only accepts: heat, fan, btsp, light_red, light_green, light_blue, light_white, display
  // For fan2 (address 0x12), return null to use direct register control
  const getDeviceKindFromCommandAddr = (commandAddr: number): string | null => {
    const CONTROL_START_ADDR = 0x10
    const deviceOrder: (string | null)[] = [
      "heat",       // 0x10
      "fan",        // 0x11 - backend only has "fan", not "fan1"
      null,         // 0x12 - fan2 uses direct register control (no backend device kind)
      "btsp",       // 0x13
      "light_red",  // 0x14
      "light_green",// 0x15
      "light_blue", // 0x16
      "light_white",// 0x17
    ]

    const deviceIndex = commandAddr - CONTROL_START_ADDR
    if (deviceIndex >= 0 && deviceIndex < deviceOrder.length) {
      return deviceOrder[deviceIndex]
    }
    return null
  }

  /**
   * Shortcut toggle handler
   */
  const handleToggleShortcut = async (shortcut: Shortcut) => {
    try {
      // Use momentary switch for rising edge detection
      const deviceKind = getDeviceKindFromCommandAddr(shortcut.commandAddr)

      if (deviceKind) {
        console.log(`[DevMan] Executing momentary switch for ${deviceKind} (commandAddr: ${shortcut.commandAddr})`)
        await api.momentarySwitch(deviceKind)
        console.log(`[DevMan] Momentary switch completed for ${deviceKind}`)
      } else {
        console.error(`[DevMan] Invalid command address: ${shortcut.commandAddr}`)
        // Fallback to original behavior for invalid addresses
        if (shortcut.stateType === "coil") {
          const currentValue = plc.coils[shortcut.statusAddr] || false
          await api.setPLCCoil(shortcut.commandAddr, !currentValue)
        } else {
          const currentValue = plc.registers[shortcut.statusAddr] || 0
          const newValue = currentValue === 0 ? shortcut.stateValue : 0
          await api.setPLCRegister(shortcut.commandAddr, newValue)
        }
      }
      triggerUsageHistRefresh()
    } catch (error) {
      console.error("Failed to toggle shortcut:", error)
    }
  }

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Device Control</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsManagerOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          {shortcuts.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                No shortcuts configured. Click Settings to add shortcuts.
              </p>
            </div>
          ) : (
            <div 
              className="grid gap-2"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))'
              }}
            >
              {shortcuts.map((shortcut) => (
                <TMButton
                  key={shortcut.id}
                  title={shortcut.buttonTitle}
                  stateType={shortcut.stateType}
                  statusAddr={shortcut.statusAddr}
                  commandAddr={shortcut.commandAddr}
                  maxAddr={shortcut.maxAddr}
                  stateValue={shortcut.stateValue}
                  onToggle={() => handleToggleShortcut(shortcut)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isManagerOpen} onOpenChange={setIsManagerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>장치 제어 설정</DialogTitle>
            <DialogDescription>
              coil / register에 따른 버튼 정의
            </DialogDescription>
          </DialogHeader>
          <ShortcutsManager />
        </DialogContent>
      </Dialog>
    </>
  )
}
