"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TMButton } from "@/components/device/tm-button"
import { useStore, useShortcutStore } from "@/lib/store"
import { api } from "@/lib/api"
import { ShortcutsManager } from "@/components/device/shortcuts-manager"
import { Settings } from "lucide-react"

export function DevMan() {
  const { plc } = useStore()
  const { shortcuts } = useShortcutStore()
  const [isManagerOpen, setIsManagerOpen] = useState(false)

  /**
   * Shortcut toggle handler
   */
  const handleToggleShortcut = async (shortcut: typeof shortcuts[0]) => {
    try {
      if (shortcut.stateType === "coil") {
        const currentValue = plc.coils[shortcut.statusAddr] || false
        await api.setPLCCoil(shortcut.commandAddr, !currentValue)
      } else if (shortcut.stateType === "register") {
        const currentValue = plc.registers[shortcut.statusAddr] || 0
        const newValue = currentValue === 0 ? shortcut.stateValue : 0
        await api.setPLCRegister(shortcut.commandAddr, newValue)
      }
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

      <Dialog open={isManagerOpen} onOpenChange={setIsManagerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device Control Settings</DialogTitle>
            <DialogDescription>
              Create and manage custom buttons to control PLC coils and registers
            </DialogDescription>
          </DialogHeader>
          <ShortcutsManager />
        </DialogContent>
      </Dialog>
    </>
  )
}
