"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TMButton } from "@/components/device/tm-button"
import { useShortcutStore, type Shortcut } from "@/lib/store"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"
import { Pencil, Trash2, Plus, RotateCcw } from "lucide-react"

interface ShortcutFormData {
  buttonTitle: string
  stateType: "coil" | "register"
  statusAddr: string
  commandAddr: string
  stateValue: string
}

// Default shortcuts configuration based on PLC addresses
// Status Read: 0x00-0x07, Control Write: 0x10-0x17
const DEFAULT_SHORTCUTS = [
  {
    buttonTitle: "Heat",
    stateType: "coil" as const,
    statusAddr: 0x00,  // Read from 0x00
    commandAddr: 0x10, // Write to 0x10
    stateValue: 600,   // 10 minutes
  },
  {
    buttonTitle: "Fan",
    stateType: "coil" as const,
    statusAddr: 0x01,  // Read from 0x01
    commandAddr: 0x11, // Write to 0x11
    stateValue: 600,   // 10 minutes
  },
  {
    buttonTitle: "BTSP",
    stateType: "coil" as const,
    statusAddr: 0x02,  // Read from 0x02
    commandAddr: 0x12, // Write to 0x12
    stateValue: 3600,  // 1 hour
  },
  {
    buttonTitle: "Light Red",
    stateType: "coil" as const,
    statusAddr: 0x03,  // Read from 0x03
    commandAddr: 0x13, // Write to 0x13
    stateValue: 3600,  // 1 hour
  },
  {
    buttonTitle: "Light Green",
    stateType: "coil" as const,
    statusAddr: 0x04,  // Read from 0x04
    commandAddr: 0x14, // Write to 0x14
    stateValue: 3600,  // 1 hour
  },
  {
    buttonTitle: "Light Blue",
    stateType: "coil" as const,
    statusAddr: 0x05,  // Read from 0x05
    commandAddr: 0x15, // Write to 0x15
    stateValue: 3600,  // 1 hour
  },
  {
    buttonTitle: "Light White",
    stateType: "coil" as const,
    statusAddr: 0x06,  // Read from 0x06
    commandAddr: 0x16, // Write to 0x16
    stateValue: 3600,  // 1 hour
  },
  {
    buttonTitle: "Display",
    stateType: "coil" as const,
    statusAddr: 0x07,  // Read from 0x07
    commandAddr: 0x17, // Write to 0x17
    stateValue: 0,     // Manual toggle (no timer)
  },
]

export function ShortcutsManager() {
  const { shortcuts, addShortcut, updateShortcut, removeShortcut } = useShortcutStore()
  const { plc } = useStore()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null)
  const [formData, setFormData] = useState<ShortcutFormData>({
    buttonTitle: "",
    stateType: "coil",
    statusAddr: "0",
    commandAddr: "16",
    stateValue: "600",
  })

  const handleFormChange = (field: keyof ShortcutFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddShortcut = () => {
    const statusAddr = parseInt(formData.statusAddr, 10)
    const commandAddr = parseInt(formData.commandAddr, 10)
    const stateValue = parseInt(formData.stateValue, 10)

    if (isNaN(statusAddr) || isNaN(commandAddr) || isNaN(stateValue)) {
      alert("Invalid address or value")
      return
    }

    addShortcut({
      buttonTitle: formData.buttonTitle || "Unnamed",
      stateType: formData.stateType,
      statusAddr,
      commandAddr,
      stateValue,
    })

    // Reset form
    setFormData({
      buttonTitle: "",
      stateType: "coil",
      statusAddr: "0",
      commandAddr: "16",
      stateValue: "600",
    })
    setIsAddDialogOpen(false)
  }

  const handleEditShortcut = () => {
    if (!editingShortcut) return

    const statusAddr = parseInt(formData.statusAddr, 10)
    const commandAddr = parseInt(formData.commandAddr, 10)
    const stateValue = parseInt(formData.stateValue, 10)

    if (isNaN(statusAddr) || isNaN(commandAddr) || isNaN(stateValue)) {
      alert("Invalid address or value")
      return
    }

    updateShortcut(editingShortcut.id, {
      buttonTitle: formData.buttonTitle || "Unnamed",
      stateType: formData.stateType,
      statusAddr,
      commandAddr,
      stateValue,
    })

    setEditingShortcut(null)
  }

  const openEditDialog = (shortcut: Shortcut) => {
    setEditingShortcut(shortcut)
    setFormData({
      buttonTitle: shortcut.buttonTitle,
      stateType: shortcut.stateType,
      statusAddr: shortcut.statusAddr.toString(),
      commandAddr: shortcut.commandAddr.toString(),
      stateValue: shortcut.stateValue.toString(),
    })
  }

  const handleToggleShortcut = async (shortcut: Shortcut) => {
    try {
      if (shortcut.stateType === "coil") {
        // Read current state from statusAddr, write command to commandAddr
        const currentValue = plc.coils[shortcut.statusAddr] || false
        await api.setPLCCoil(shortcut.commandAddr, !currentValue)
      } else {
        // For register, toggle between 0 and stateValue (max timer value)
        // Read current state from statusAddr, write command to commandAddr
        const currentValue = plc.registers[shortcut.statusAddr] || 0
        const newValue = currentValue === 0 ? shortcut.stateValue : 0
        await api.setPLCRegister(shortcut.commandAddr, newValue)
      }
    } catch (error) {
      console.error("Failed to toggle shortcut:", error)
    }
  }

  const handleLoadDefaults = () => {
    const confirmMessage = shortcuts.length > 0
      ? "기존 shortcuts를 모두 삭제하고 기본값으로 재설정하시겠습니까?"
      : "기본 shortcuts(Heat, Fan, BTSP, R, G, B, W, Display)를 추가하시겠습니까?"

    if (!confirm(confirmMessage)) {
      return
    }

    // Clear existing shortcuts by removing all
    shortcuts.forEach((shortcut) => {
      removeShortcut(shortcut.id)
    })

    // Add all default shortcuts
    DEFAULT_SHORTCUTS.forEach((defaultShortcut) => {
      addShortcut(defaultShortcut)
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Shortcuts</CardTitle>
              <CardDescription>Create custom buttons to control PLC coils and registers</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleLoadDefaults}>
                <RotateCcw className="mr-2 h-4 w-4" />
                기본값 설정
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Shortcut
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Shortcut</DialogTitle>
                  <DialogDescription>Create a custom button to control a PLC coil or register</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-title">Button Title</Label>
                    <Input
                      id="add-title"
                      value={formData.buttonTitle}
                      onChange={(e) => handleFormChange("buttonTitle", e.target.value)}
                      placeholder="e.g., Emergency Stop"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-type">State Type</Label>
                    <Select value={formData.stateType} onValueChange={(value) => handleFormChange("stateType", value)}>
                      <SelectTrigger id="add-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coil">Coil (Boolean)</SelectItem>
                        <SelectItem value="register">Register (Timer)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="add-status-addr">Status Address (Read)</Label>
                      <Input
                        id="add-status-addr"
                        type="number"
                        value={formData.statusAddr}
                        onChange={(e) => handleFormChange("statusAddr", e.target.value)}
                        placeholder="0-999"
                        min={0}
                        max={999}
                      />
                      <p className="text-xs text-muted-foreground">Address to read state from</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-cmd-addr">Command Address (Write)</Label>
                      <Input
                        id="add-cmd-addr"
                        type="number"
                        value={formData.commandAddr}
                        onChange={(e) => handleFormChange("commandAddr", e.target.value)}
                        placeholder="0-999"
                        min={0}
                        max={999}
                      />
                      <p className="text-xs text-muted-foreground">Address to write commands to</p>
                    </div>
                  </div>
                  {formData.stateType === "register" && (
                    <div className="space-y-2">
                      <Label htmlFor="add-value">Max Timer Value (seconds)</Label>
                      <Input
                        id="add-value"
                        type="number"
                        value={formData.stateValue}
                        onChange={(e) => handleFormChange("stateValue", e.target.value)}
                        placeholder="600 (10 minutes)"
                        min={0}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddShortcut}>Add Shortcut</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          </div>
        </CardHeader>
        <CardContent>
          {shortcuts.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">No shortcuts yet. Click "Add Shortcut" to create one.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {shortcuts.map((shortcut) => (
                <Card key={shortcut.id} className="relative">
                  <CardContent className="pt-6">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <TMButton
                          title={shortcut.buttonTitle}
                          stateType={shortcut.stateType}
                          statusAddr={shortcut.statusAddr}
                          commandAddr={shortcut.commandAddr}
                          stateValue={shortcut.stateValue}
                          onToggle={() => handleToggleShortcut(shortcut)}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {shortcut.stateType === "coil" ? "Coil" : "Register"} R:{shortcut.statusAddr} W:{shortcut.commandAddr}
                      </span>
                      <div className="ml-auto flex gap-1">
                        <Dialog
                          open={editingShortcut?.id === shortcut.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingShortcut(null)
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditDialog(shortcut)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Shortcut</DialogTitle>
                              <DialogDescription>Update the shortcut configuration</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-title">Button Title</Label>
                                <Input
                                  id="edit-title"
                                  value={formData.buttonTitle}
                                  onChange={(e) => handleFormChange("buttonTitle", e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-type">State Type</Label>
                                <Select
                                  value={formData.stateType}
                                  onValueChange={(value) => handleFormChange("stateType", value)}
                                >
                                  <SelectTrigger id="edit-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="coil">Coil (Boolean)</SelectItem>
                                    <SelectItem value="register">Register (Timer)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-status-addr">Status Address (Read)</Label>
                                  <Input
                                    id="edit-status-addr"
                                    type="number"
                                    value={formData.statusAddr}
                                    onChange={(e) => handleFormChange("statusAddr", e.target.value)}
                                    min={0}
                                    max={999}
                                  />
                                  <p className="text-xs text-muted-foreground">Address to read state from</p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-cmd-addr">Command Address (Write)</Label>
                                  <Input
                                    id="edit-cmd-addr"
                                    type="number"
                                    value={formData.commandAddr}
                                    onChange={(e) => handleFormChange("commandAddr", e.target.value)}
                                    min={0}
                                    max={999}
                                  />
                                  <p className="text-xs text-muted-foreground">Address to write commands to</p>
                                </div>
                              </div>
                              {formData.stateType === "register" && (
                                <div className="space-y-2">
                                  <Label htmlFor="edit-value">Max Timer Value (seconds)</Label>
                                  <Input
                                    id="edit-value"
                                    type="number"
                                    value={formData.stateValue}
                                    onChange={(e) => handleFormChange("stateValue", e.target.value)}
                                    min={0}
                                  />
                                </div>
                              )}
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingShortcut(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleEditShortcut}>Save Changes</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete shortcut "${shortcut.buttonTitle}"?`)) {
                              removeShortcut(shortcut.id)
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
