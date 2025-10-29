"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TMButton } from "@/components/device/tm-button"
import { useDevManButtonStore, useStore, type DevManButton, type DeviceState } from "@/lib/store"
import { api } from "@/lib/api"
import { Pencil, Trash2, Plus, RotateCcw } from "lucide-react"

interface ButtonFormData {
  buttonTitle: string
  stateType: "legacy" | "coil" | "register"
  deviceKey: string
  statusAddr: string
  commandAddr: string
  stateValue: string
}

// Default buttons configuration based on legacy device state
const DEFAULT_BUTTONS = [
  {
    buttonTitle: "Heat",
    stateType: "legacy" as const,
    deviceKey: "heat" as keyof DeviceState,
  },
  {
    buttonTitle: "Fan",
    stateType: "legacy" as const,
    deviceKey: "fan" as keyof DeviceState,
  },
  {
    buttonTitle: "BTSP",
    stateType: "legacy" as const,
    deviceKey: "btsp" as keyof DeviceState,
  },
  {
    buttonTitle: "Red Light",
    stateType: "legacy" as const,
    deviceKey: "light-red" as keyof DeviceState,
  },
  {
    buttonTitle: "Green Light",
    stateType: "legacy" as const,
    deviceKey: "light-green" as keyof DeviceState,
  },
  {
    buttonTitle: "Blue Light",
    stateType: "legacy" as const,
    deviceKey: "light-blue" as keyof DeviceState,
  },
  {
    buttonTitle: "White Light",
    stateType: "legacy" as const,
    deviceKey: "light-white" as keyof DeviceState,
  },
]

export function DevManManager() {
  const { buttons, addButton, updateButton, removeButton } = useDevManButtonStore()
  const { devices, updateDevice, plc } = useStore()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingButton, setEditingButton] = useState<DevManButton | null>(null)
  const [formData, setFormData] = useState<ButtonFormData>({
    buttonTitle: "",
    stateType: "legacy",
    deviceKey: "heat",
    statusAddr: "0",
    commandAddr: "16",
    stateValue: "600",
  })

  const handleFormChange = (field: keyof ButtonFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddButton = () => {
    const statusAddr = formData.stateType !== "legacy" ? parseInt(formData.statusAddr, 10) : undefined
    const commandAddr = formData.stateType !== "legacy" ? parseInt(formData.commandAddr, 10) : undefined
    const stateValue = formData.stateType === "register" ? parseInt(formData.stateValue, 10) : undefined

    if (formData.stateType !== "legacy" && (isNaN(statusAddr!) || isNaN(commandAddr!))) {
      alert("Invalid address")
      return
    }

    if (formData.stateType === "register" && isNaN(stateValue!)) {
      alert("Invalid state value")
      return
    }

    addButton({
      buttonTitle: formData.buttonTitle || "Unnamed",
      stateType: formData.stateType,
      deviceKey: formData.stateType === "legacy" ? (formData.deviceKey as keyof DeviceState) : undefined,
      statusAddr,
      commandAddr,
      stateValue,
    })

    // Reset form
    setFormData({
      buttonTitle: "",
      stateType: "legacy",
      deviceKey: "heat",
      statusAddr: "0",
      commandAddr: "16",
      stateValue: "600",
    })
    setIsAddDialogOpen(false)
  }

  const handleEditButton = () => {
    if (!editingButton) return

    const statusAddr = formData.stateType !== "legacy" ? parseInt(formData.statusAddr, 10) : undefined
    const commandAddr = formData.stateType !== "legacy" ? parseInt(formData.commandAddr, 10) : undefined
    const stateValue = formData.stateType === "register" ? parseInt(formData.stateValue, 10) : undefined

    if (formData.stateType !== "legacy" && (isNaN(statusAddr!) || isNaN(commandAddr!))) {
      alert("Invalid address")
      return
    }

    if (formData.stateType === "register" && isNaN(stateValue!)) {
      alert("Invalid state value")
      return
    }

    updateButton(editingButton.id, {
      buttonTitle: formData.buttonTitle || "Unnamed",
      stateType: formData.stateType,
      deviceKey: formData.stateType === "legacy" ? (formData.deviceKey as keyof DeviceState) : undefined,
      statusAddr,
      commandAddr,
      stateValue,
    })

    setEditingButton(null)
  }

  const openEditDialog = (button: DevManButton) => {
    setEditingButton(button)
    setFormData({
      buttonTitle: button.buttonTitle,
      stateType: button.stateType,
      deviceKey: button.deviceKey || "heat",
      statusAddr: button.statusAddr?.toString() || "0",
      commandAddr: button.commandAddr?.toString() || "16",
      stateValue: button.stateValue?.toString() || "600",
    })
  }

  const handleToggleButton = async (button: DevManButton) => {
    try {
      if (button.stateType === "legacy" && button.deviceKey) {
        // Legacy device control using momentary switch for rising edge detection
        const deviceKindMap: Record<string, string> = {
          'heat': 'heat',
          'fan': 'fan', 
          'btsp': 'btsp',
          'light-red': 'light_red',
          'light-green': 'light_green',
          'light-blue': 'light_blue',
          'light-white': 'light_white',
          'display': 'display'
        }
        
        const deviceKind = deviceKindMap[button.deviceKey]
        if (!deviceKind) {
          throw new Error(`Unknown device key: ${button.deviceKey}`)
        }

        console.log(`[DevManManager] Executing momentary switch for ${deviceKind}`)
        await api.momentarySwitch(deviceKind)
        console.log(`[DevManManager] Momentary switch completed for ${deviceKind}`)
      } else if (button.stateType === "coil" && button.statusAddr !== undefined && button.commandAddr !== undefined) {
        // Coil control
        const currentValue = plc.coils[button.statusAddr] || false
        await api.setPLCCoil(button.commandAddr, !currentValue)
      } else if (button.stateType === "register" && button.statusAddr !== undefined && button.commandAddr !== undefined && button.stateValue !== undefined) {
        // Register control
        const currentValue = plc.registers[button.statusAddr] || 0
        const newValue = currentValue === 0 ? button.stateValue : 0
        await api.setPLCRegister(button.commandAddr, newValue)
      }
    } catch (error) {
      console.error("Failed to toggle button:", error)
    }
  }

  const handleLoadDefaults = () => {
    const confirmMessage = buttons.length > 0
      ? "Delete all existing buttons and load default configuration?"
      : "Load default buttons (Heat, Fan, BTSP, Lights)?"

    if (!confirm(confirmMessage)) {
      return
    }

    // Clear existing buttons
    buttons.forEach((button) => {
      removeButton(button.id)
    })

    // Add all default buttons
    DEFAULT_BUTTONS.forEach((defaultButton) => {
      addButton(defaultButton)
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Device Control Buttons</CardTitle>
              <CardDescription>Manage buttons for device control panel</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleLoadDefaults}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Load Defaults
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Button
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Button</DialogTitle>
                    <DialogDescription>Create a custom button for device control</DialogDescription>
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
                          <SelectItem value="legacy">Legacy Device (Heat, Fan, etc.)</SelectItem>
                          <SelectItem value="coil">PLC Coil (Boolean)</SelectItem>
                          <SelectItem value="register">PLC Register (Timer)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.stateType === "legacy" && (
                      <div className="space-y-2">
                        <Label htmlFor="add-device-key">Device</Label>
                        <Select value={formData.deviceKey} onValueChange={(value) => handleFormChange("deviceKey", value)}>
                          <SelectTrigger id="add-device-key">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="heat">Heat</SelectItem>
                            <SelectItem value="fan">Fan</SelectItem>
                            <SelectItem value="btsp">BTSP</SelectItem>
                            <SelectItem value="light-red">Light Red</SelectItem>
                            <SelectItem value="light-green">Light Green</SelectItem>
                            <SelectItem value="light-blue">Light Blue</SelectItem>
                            <SelectItem value="light-white">Light White</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {formData.stateType !== "legacy" && (
                      <>
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
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddButton}>Add Button</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {buttons.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">No buttons yet. Click "Add Button" to create one or "Load Defaults" for default buttons.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {buttons.map((button) => (
                <div key={button.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <TMButton
                      title={button.buttonTitle}
                      stateType={button.stateType}
                      isOn={button.deviceKey ? devices[button.deviceKey].isOn : undefined}
                      progress={button.deviceKey ? devices[button.deviceKey].progress : undefined}
                      statusAddr={button.statusAddr}
                      commandAddr={button.commandAddr}
                      stateValue={button.stateValue}
                      onToggle={() => handleToggleButton(button)}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Dialog
                      open={editingButton?.id === button.id}
                      onOpenChange={(open) => {
                        if (!open) setEditingButton(null)
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(button)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Button</DialogTitle>
                          <DialogDescription>Update the button configuration</DialogDescription>
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
                                <SelectItem value="legacy">Legacy Device (Heat, Fan, etc.)</SelectItem>
                                <SelectItem value="coil">PLC Coil (Boolean)</SelectItem>
                                <SelectItem value="register">PLC Register (Timer)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {formData.stateType === "legacy" && (
                            <div className="space-y-2">
                              <Label htmlFor="edit-device-key">Device</Label>
                              <Select value={formData.deviceKey} onValueChange={(value) => handleFormChange("deviceKey", value)}>
                                <SelectTrigger id="edit-device-key">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="heat">Heat</SelectItem>
                                  <SelectItem value="fan">Fan</SelectItem>
                                  <SelectItem value="btsp">BTSP</SelectItem>
                                  <SelectItem value="light-red">Light Red</SelectItem>
                                  <SelectItem value="light-green">Light Green</SelectItem>
                                  <SelectItem value="light-blue">Light Blue</SelectItem>
                                  <SelectItem value="light-white">Light White</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {formData.stateType !== "legacy" && (
                            <>
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
                            </>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditingButton(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleEditButton}>Save Changes</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete button "${button.buttonTitle}"?`)) {
                          removeButton(button.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
