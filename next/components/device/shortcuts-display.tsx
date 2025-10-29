"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TMButton } from "@/components/device/tm-button"
import { useShortcutStore, type Shortcut } from "@/lib/store"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"
import { PLCPollingService } from "@/lib/plc-polling"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Settings } from "lucide-react"
import { ShortcutsManager } from "./shortcuts-manager"
import { useState } from "react"

export function ShortcutsDisplay() {
  const { shortcuts } = useShortcutStore()
  const { plc } = useStore()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Map command addresses to device kinds based on ModbusService mapping
  const getDeviceKindFromCommandAddr = (commandAddr: number): string | null => {
    const CONTROL_START_ADDR = 0x10
    const deviceOrder = [
      "heat",
      "fan", 
      "btsp",
      "light_red",
      "light_green",
      "light_blue",
      "light_white",
      "display"
    ]
    
    const deviceIndex = commandAddr - CONTROL_START_ADDR
    if (deviceIndex >= 0 && deviceIndex < deviceOrder.length) {
      return deviceOrder[deviceIndex]
    }
    return null
  }

  const handleToggleShortcut = async (shortcut: Shortcut) => {
    try {
      // Use momentary switch for rising edge detection
      const deviceKind = getDeviceKindFromCommandAddr(shortcut.commandAddr)
      
      if (deviceKind) {
        console.log(`[ShortcutsDisplay] Executing momentary switch for ${deviceKind} (commandAddr: ${shortcut.commandAddr})`)
        await api.momentarySwitch(deviceKind)
        console.log(`[ShortcutsDisplay] Momentary switch completed for ${deviceKind}`)
      } else {
        console.error(`[ShortcutsDisplay] Invalid command address: ${shortcut.commandAddr}`)
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
    } catch (error) {
      console.error("Failed to toggle shortcut:", error)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Device Control</CardTitle>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Shortcut Settings</DialogTitle>
                  <DialogDescription>
                    Create and manage custom buttons to control PLC coils and registers
                  </DialogDescription>
                </DialogHeader>
                <ShortcutsManager />
              </DialogContent>
            </Dialog>
            </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 overflow-y-auto">
        {shortcuts.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              No shortcuts configured. Click Settings to add shortcuts.
            </p>
          </div>
        ) : (
          shortcuts.map((shortcut) => (
            <TMButton
              key={shortcut.id}
              title={shortcut.buttonTitle}
              stateType={shortcut.stateType}
              statusAddr={shortcut.statusAddr}
              commandAddr={shortcut.commandAddr}
              stateValue={shortcut.stateValue}
              onToggle={() => handleToggleShortcut(shortcut)}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
