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
  maxAddr: string
  stateValue: string
}

// Default shortcuts configuration based on PLC addresses (all decimal)
// Status Read: 0-7, Control Write: 16-23, Max Timer: 20-27
const DEFAULT_SHORTCUTS = [
  {
    buttonTitle: "열선",
    stateType: "register" as const,
    statusAddr: 0,   // D0000: current timer
    commandAddr: 16, // D0016: command coil
    maxAddr: 20,     // D0020: max timer
  },
  {
    buttonTitle: "팬1",
    stateType: "register" as const,
    statusAddr: 1,
    commandAddr: 17,
    maxAddr: 21,
  },
  {
    buttonTitle: "팬2",
    stateType: "register" as const,
    statusAddr: 2,
    commandAddr: 18,
    maxAddr: 22,
  },
  {
    buttonTitle: "블루투스 스피커",
    stateType: "register" as const,
    statusAddr: 3,
    commandAddr: 19,
    maxAddr: 23,
  },
  {
    buttonTitle: "적색 LED",
    stateType: "register" as const,
    statusAddr: 4,
    commandAddr: 20,
    maxAddr: 24,
  },
  {
    buttonTitle: "녹색 LED",
    stateType: "register" as const,
    statusAddr: 5,
    commandAddr: 21,
    maxAddr: 25,
  },
  {
    buttonTitle: "청색 LED",
    stateType: "register" as const,
    statusAddr: 6,
    commandAddr: 22,
    maxAddr: 26,
  },
  {
    buttonTitle: "백색 LED",
    stateType: "register" as const,
    statusAddr: 7,
    commandAddr: 23,
    maxAddr: 27,
  },
]

export function ShortcutsManager() {
  const { shortcuts, addShortcut, updateShortcut, removeShortcut } = useShortcutStore()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null)
  const [formData, setFormData] = useState<ShortcutFormData>({
    buttonTitle: "",
    stateType: "register",
    statusAddr: "0",
    commandAddr: "16",
    maxAddr: "32",
    stateValue: "600",
  })

  const handleFormChange = (field: keyof ShortcutFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddShortcut = () => {
    const statusAddr = parseInt(formData.statusAddr, 10)
    const commandAddr = parseInt(formData.commandAddr, 10)
    const maxAddr = formData.maxAddr ? parseInt(formData.maxAddr, 10) : undefined
    const stateValue = formData.stateValue ? parseInt(formData.stateValue, 10) : undefined

    if (isNaN(statusAddr) || isNaN(commandAddr)) {
      alert("Invalid address")
      return
    }

    addShortcut({
      buttonTitle: formData.buttonTitle || "Unnamed",
      stateType: formData.stateType,
      statusAddr,
      commandAddr,
      maxAddr: maxAddr && !isNaN(maxAddr) ? maxAddr : undefined,
      stateValue: stateValue && !isNaN(stateValue) ? stateValue : undefined,
    })

    // Reset form
    setFormData({
      buttonTitle: "",
      stateType: "register",
      statusAddr: "0",
      commandAddr: "16",
      maxAddr: "32",
      stateValue: "",
    })
    setIsAddDialogOpen(false)
  }

  const handleEditShortcut = () => {
    if (!editingShortcut) return

    const statusAddr = parseInt(formData.statusAddr, 10)
    const commandAddr = parseInt(formData.commandAddr, 10)
    const maxAddr = formData.maxAddr ? parseInt(formData.maxAddr, 10) : undefined
    const stateValue = formData.stateValue ? parseInt(formData.stateValue, 10) : undefined

    if (isNaN(statusAddr) || isNaN(commandAddr)) {
      alert("Invalid address")
      return
    }

    updateShortcut(editingShortcut.id, {
      buttonTitle: formData.buttonTitle || "Unnamed",
      stateType: formData.stateType,
      statusAddr,
      commandAddr,
      maxAddr: maxAddr && !isNaN(maxAddr) ? maxAddr : undefined,
      stateValue: stateValue && !isNaN(stateValue) ? stateValue : undefined,
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
      maxAddr: shortcut.maxAddr?.toString() || "",
      stateValue: shortcut.stateValue?.toString() || "",
    })
  }

  const handleLoadDefaults = () => {
    const confirmMessage = shortcuts.length > 0
      ? "기존 shortcuts를 모두 삭제하고 기본값으로 재설정하시겠습니까?"
      : "기본 shortcuts(열선, 팬1, 팬2, BTSP, 적/녹/청/백 LED)를 추가하시겠습니까?"

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
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="add-max-addr">최대값 register 주소 (Read)</Label>
                        <Input
                          id="add-max-addr"
                          type="number"
                          value={formData.maxAddr}
                          onChange={(e) => handleFormChange("maxAddr", e.target.value)}
                          placeholder="32 (0x20)"
                          min={0}
                          max={999}
                        />
                        <p className="text-xs text-muted-foreground">PLC에서 최대 타이머 값을 읽을 주소</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="add-value">최대값 Fallback (seconds)</Label>
                        <Input
                          id="add-value"
                          type="number"
                          value={formData.stateValue}
                          onChange={(e) => handleFormChange("stateValue", e.target.value)}
                          placeholder="600 (10분)"
                          min={0}
                        />
                        <p className="text-xs text-muted-foreground">maxAddr가 0이면 이 값 사용</p>
                      </div>
                    </>
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
                  {shortcut.stateType === "register" && shortcut.maxAddr !== undefined && ` • Max: ${shortcut.maxAddr}`}
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
                                <>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-max-addr">최대값 register 주소 (Read)</Label>
                                    <Input
                                      id="edit-max-addr"
                                      type="number"
                                      value={formData.maxAddr}
                                      onChange={(e) => handleFormChange("maxAddr", e.target.value)}
                                      min={0}
                                      max={999}
                                    />
                                    <p className="text-xs text-muted-foreground">PLC에서 최대 타이머 값을 읽을 주소</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-value">최대값 Fallback (seconds)</Label>
                                    <Input
                                      id="edit-value"
                                      type="number"
                                      value={formData.stateValue}
                                      onChange={(e) => handleFormChange("stateValue", e.target.value)}
                                      min={0}
                                    />
                                    <p className="text-xs text-muted-foreground">maxAddr가 0이면 이 값 사용</p>
                                  </div>
                                </>
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
