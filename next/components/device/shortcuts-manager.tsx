"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useShortcutStore, type Shortcut } from "@/lib/store"
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
    buttonTitle: "열선",
    stateType: "register" as const,
    statusAddr: 0x00,  // Read from 0x00
    commandAddr: 0x10, // Write to 0x10
    stateValue: 600,   // 10분
  },
  {
    buttonTitle: "팬",
    stateType: "register" as const,
    statusAddr: 0x01,  // Read from 0x01
    commandAddr: 0x11, // Write to 0x11
    stateValue: 60,   // 10분
  },
  {
    buttonTitle: "블루투스 스피커",
    stateType: "register" as const,
    statusAddr: 0x02,  // Read from 0x02
    commandAddr: 0x12, // Write to 0x12
    stateValue: 3600,  // 1시간
  },
  {
    buttonTitle: "적색 LED",
    stateType: "register" as const,
    statusAddr: 0x03,  // Read from 0x03
    commandAddr: 0x13, // Write to 0x13
    stateValue: 3600,  // 1시간
  },
  {
    buttonTitle: "녹색 LED",
    stateType: "register" as const,
    statusAddr: 0x04,  // Read from 0x04
    commandAddr: 0x14, // Write to 0x14
    stateValue: 3600,  // 1시간
  },
  {
    buttonTitle: "청색 LED",
    stateType: "register" as const,
    statusAddr: 0x05,  // Read from 0x05
    commandAddr: 0x15, // Write to 0x15
    stateValue: 3600,  // 1시간
  },
  {
    buttonTitle: "백색 LED",
    stateType: "register" as const,
    statusAddr: 0x06,  // Read from 0x06
    commandAddr: 0x16, // Write to 0x16
    stateValue: 3600,  // 1 hour
  },

]

export function ShortcutsManager() {
  const { shortcuts, addShortcut, updateShortcut, removeShortcut } = useShortcutStore()
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
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleLoadDefaults}>
            <RotateCcw className="mr-2 h-4 w-4" />
            기본 값 적용
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                버튼 추가
              </Button>
            </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>버튼 추가</DialogTitle>
                  <DialogDescription>장치 제어 버튼을 추가합니다.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-title">버튼 이름</Label>
                    <Input
                      id="add-title"
                      value={formData.buttonTitle}
                      onChange={(e) => handleFormChange("buttonTitle", e.target.value)}
                      placeholder="예) 긴급 정지"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-type">상태 타입</Label>
                    <Select value={formData.stateType} onValueChange={(value) => handleFormChange("stateType", value)}>
                      <SelectTrigger id="add-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coil">코일 (Boolean)</SelectItem>
                        <SelectItem value="register">레지스터 (Timer)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="add-status-addr">상태 {formData.stateType === "coil" ? "coil" : "register"} 주소 (Read)</Label>
                      <Input
                        id="add-status-addr"
                        type="number"
                        value={formData.statusAddr}
                        onChange={(e) => handleFormChange("statusAddr", e.target.value)}
                        placeholder="0-999"
                        min={0}
                        max={999}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-cmd-addr">명령 coil 주소 (Write)</Label>
                      <Input
                        id="add-cmd-addr"
                        type="number"
                        value={formData.commandAddr}
                        onChange={(e) => handleFormChange("commandAddr", e.target.value)}
                        placeholder="0-999"
                        min={0}
                        max={999}
                      />
                    </div>
                  </div>
                  {formData.stateType === "register" && (
                    <div className="space-y-2">
                      <Label htmlFor="add-value">최대 타이머 값 (seconds)</Label>
                      <Input
                        id="add-value"
                        type="number"
                        value={formData.stateValue}
                        onChange={(e) => handleFormChange("stateValue", e.target.value)}
                        placeholder="600 (10분)"
                        min={0}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    취소
                  </Button>
                  <Button onClick={handleAddShortcut}>버튼 추가</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      {shortcuts.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">정의된 버튼이 없습니다. "버튼 추가"를 클릭하여 추가할 수 있습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <div className="font-medium">{shortcut.buttonTitle}</div>
                <div className="text-xs text-muted-foreground">
                  {shortcut.stateType === "coil" ? "Coil" : "Register"} • Read: {shortcut.statusAddr} • Write: {shortcut.commandAddr}
                  {shortcut.stateType === "register" && ` • Timer: ${shortcut.stateValue}s`}
                </div>
              </div>
              <div className="flex gap-1">
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
                              <DialogTitle>버튼 수정</DialogTitle>
                              <DialogDescription>버튼 설정을 수정합니다.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-title">버튼 이름</Label>
                                <Input
                                  id="edit-title"
                                  value={formData.buttonTitle}
                                  onChange={(e) => handleFormChange("buttonTitle", e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-type">상태 정의 방식</Label>
                                <Select
                                  value={formData.stateType}
                                  onValueChange={(value) => handleFormChange("stateType", value)}
                                >
                                  <SelectTrigger id="edit-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="coil">코일 (ON/OFF)</SelectItem>
                                    <SelectItem value="register">레지스터 (시간)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-status-addr">상태 {formData.stateType === "coil" ? "coil" : "register"} 주소</Label>
                                  <Input
                                    id="edit-status-addr"
                                    type="number"
                                    value={formData.statusAddr}
                                    onChange={(e) => handleFormChange("statusAddr", e.target.value)}
                                    min={0}
                                    max={999}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-cmd-addr">명령 보낼 coil 주소</Label>
                                  <Input
                                    id="edit-cmd-addr"
                                    type="number"
                                    value={formData.commandAddr}
                                    onChange={(e) => handleFormChange("commandAddr", e.target.value)}
                                    min={0}
                                    max={999}
                                  />
                                </div>
                              </div>
                              {formData.stateType === "register" && (
                                <div className="space-y-2">
                                  <Label htmlFor="edit-value">최대 타이머 값 (seconds)</Label>
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
                              <Button onClick={handleEditShortcut}>수정 저장</Button>
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
          ))}
        </div>
      )}
    </div>
  )
}
