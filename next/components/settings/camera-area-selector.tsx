"use client"

import { useEffect, useRef, useState } from "react"
import { WebRTCManager } from "@/lib/webrtc"
import { useCameraAreaStore, type AreaBox, type CameraArea } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, Edit2, Check, X, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

// Color map with 10 distinct colors
const COLOR_MAP: Record<number, { stroke: string; fill: string; name: string }> = {
  1: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.15)", name: "Red" },
  2: { stroke: "#22c55e", fill: "rgba(34, 197, 94, 0.15)", name: "Green" },
  3: { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.15)", name: "Blue" },
  4: { stroke: "#a855f7", fill: "rgba(168, 85, 247, 0.15)", name: "Purple" },
  5: { stroke: "#f97316", fill: "rgba(249, 115, 22, 0.15)", name: "Orange" },
  6: { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.15)", name: "Cyan" },
  7: { stroke: "#ec4899", fill: "rgba(236, 72, 153, 0.15)", name: "Magenta" },
  8: { stroke: "#eab308", fill: "rgba(234, 179, 8, 0.15)", name: "Yellow" },
  9: { stroke: "#f43f5e", fill: "rgba(244, 63, 94, 0.15)", name: "Pink" },
  10: { stroke: "#14b8a6", fill: "rgba(20, 184, 166, 0.15)", name: "Teal" },
}

type InteractionMode = "none" | "draw" | "move" | "resize"
type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w"

export function CameraAreaSelector() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const webrtcRef = useRef<WebRTCManager | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("none")
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentBox, setCurrentBox] = useState<AreaBox | null>(null)

  // Area management
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(null)
  const [editingAreaIndex, setEditingAreaIndex] = useState<number | null>(null)
  const [editingNickname, setEditingNickname] = useState("")
  const [newAreaNickname, setNewAreaNickname] = useState("")
  const [drawingForAreaIndex, setDrawingForAreaIndex] = useState<number | null>(null)
  const [hoveredBox, setHoveredBox] = useState<{ areaIndex: number; boxIndex: number } | null>(null)

  // Dragging and resizing state
  const [draggedBox, setDraggedBox] = useState<{ areaIndex: number; boxIndex: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [resizingBox, setResizingBox] = useState<{
    areaIndex: number
    boxIndex: number
    handle: ResizeHandle
  } | null>(null)

  // Collapsible state for area list
  const [collapsedAreas, setCollapsedAreas] = useState<Set<number>>(new Set())

  const { areas, addArea, updateArea, removeArea } = useCameraAreaStore()

  // Get next available color code
  const getNextColorCode = (): number => {
    const usedCodes = new Set(areas.map((area) => area.colorCode))
    for (let i = 1; i <= 10; i++) {
      if (!usedCodes.has(i)) return i
    }
    // If all colors are used, cycle back
    return (areas.length % 10) + 1
  }

  // Initialize WebRTC
  useEffect(() => {
    const initWebRTC = async () => {
      if (!videoRef.current) return

      try {
        webrtcRef.current = new WebRTCManager()
        await webrtcRef.current.connect(videoRef.current, () => {
          setIsConnected(true)
        })
      } catch (err) {
        console.error("WebRTC connection error:", err)
      }
    }

    initWebRTC()

    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.disconnect()
      }
    }
  }, [])

  // Check if point is inside a box
  const isPointInBox = (x: number, y: number, box: AreaBox): boolean => {
    return x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2
  }

  // Get resize handle at point
  const getResizeHandle = (x: number, y: number, box: AreaBox): ResizeHandle | null => {
    const threshold = 10
    const onLeft = Math.abs(x - box.x1) < threshold
    const onRight = Math.abs(x - box.x2) < threshold
    const onTop = Math.abs(y - box.y1) < threshold
    const onBottom = Math.abs(y - box.y2) < threshold

    if (onTop && onLeft) return "nw"
    if (onTop && onRight) return "ne"
    if (onBottom && onLeft) return "sw"
    if (onBottom && onRight) return "se"
    if (onTop) return "n"
    if (onBottom) return "s"
    if (onLeft) return "w"
    if (onRight) return "e"
    return null
  }

  // Constrain box to canvas boundaries
  const constrainBox = (box: AreaBox, canvas: HTMLCanvasElement): AreaBox => {
    return {
      x1: Math.max(0, Math.min(box.x1, canvas.width)),
      y1: Math.max(0, Math.min(box.y1, canvas.height)),
      x2: Math.max(0, Math.min(box.x2, canvas.width)),
      y2: Math.max(0, Math.min(box.y2, canvas.height)),
    }
  }

  // Draw areas on canvas
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = () => {
      // Match canvas size to video display size
      const rect = video.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw existing areas
      areas.forEach((area, areaIndex) => {
        if (!area.visible) return // Skip if not visible

        const isSelected = selectedAreaIndex === areaIndex
        const color = COLOR_MAP[area.colorCode] || COLOR_MAP[1]

        area.box.forEach((box, boxIndex) => {
          const isHovered = hoveredBox?.areaIndex === areaIndex && hoveredBox?.boxIndex === boxIndex
          const isDragging = draggedBox?.areaIndex === areaIndex && draggedBox?.boxIndex === boxIndex
          const isResizing =
            resizingBox?.areaIndex === areaIndex && resizingBox?.boxIndex === boxIndex

          // Set colors and styles
          if (!area.enabled) {
            // Disabled state: dashed border, semi-transparent
            ctx.strokeStyle = color.stroke
            ctx.lineWidth = 2
            ctx.fillStyle = color.fill.replace("0.15", "0.05")
            ctx.setLineDash([5, 5])
          } else if (isHovered || isDragging || isResizing) {
            ctx.strokeStyle = "#fbbf24" // Yellow highlight for hover
            ctx.lineWidth = 4
            ctx.fillStyle = "rgba(251, 191, 36, 0.2)"
            ctx.setLineDash([])
          } else if (isSelected) {
            ctx.strokeStyle = color.stroke
            ctx.lineWidth = 3
            ctx.fillStyle = color.fill
            ctx.setLineDash([])
          } else {
            ctx.strokeStyle = color.stroke
            ctx.lineWidth = 2
            ctx.fillStyle = color.fill
            ctx.setLineDash([])
          }

          const width = box.x2 - box.x1
          const height = box.y2 - box.y1

          ctx.fillRect(box.x1, box.y1, width, height)
          ctx.strokeRect(box.x1, box.y1, width, height)
          ctx.setLineDash([]) // Reset dash

          // Draw area nickname in center without background
          const centerX = (box.x1 + box.x2) / 2
          const centerY = (box.y1 + box.y2) / 2

          ctx.font = "bold 14px sans-serif"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"

          // Draw text with stroke for visibility
          ctx.strokeStyle = "#000000"
          ctx.lineWidth = 3
          ctx.strokeText(area.nickname, centerX, centerY)

          ctx.fillStyle = color.stroke
          ctx.fillText(area.nickname, centerX, centerY)

          // Draw delete button (top-right corner)
          if (isHovered || isDragging) {
            const btnX = box.x2 - 8
            const btnY = box.y1 + 8
            const btnRadius = 8

            // Circle background
            ctx.fillStyle = "rgba(239, 68, 68, 0.9)"
            ctx.beginPath()
            ctx.arc(btnX, btnY, btnRadius, 0, 2 * Math.PI)
            ctx.fill()

            // X icon
            ctx.strokeStyle = "#ffffff"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(btnX - 4, btnY - 4)
            ctx.lineTo(btnX + 4, btnY + 4)
            ctx.moveTo(btnX + 4, btnY - 4)
            ctx.lineTo(btnX - 4, btnY + 4)
            ctx.stroke()
          }

          // Draw resize handles
          if (isSelected || isHovered) {
            const handleSize = 8
            ctx.fillStyle = area.enabled ? "#3b82f6" : "#94a3b8"
            const handles = [
              { x: box.x1, y: box.y1 },
              { x: box.x2, y: box.y1 },
              { x: box.x1, y: box.y2 },
              { x: box.x2, y: box.y2 },
              { x: (box.x1 + box.x2) / 2, y: box.y1 },
              { x: (box.x1 + box.x2) / 2, y: box.y2 },
              { x: box.x1, y: (box.y1 + box.y2) / 2 },
              { x: box.x2, y: (box.y1 + box.y2) / 2 },
            ]
            handles.forEach((h) => {
              ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
            })
          }
        })
      })

      // Draw current drawing box
      if (currentBox && drawingForAreaIndex !== null) {
        ctx.strokeStyle = "#f59e0b"
        ctx.lineWidth = 2
        ctx.fillStyle = "rgba(245, 158, 11, 0.1)"
        ctx.setLineDash([])

        const width = currentBox.x2 - currentBox.x1
        const height = currentBox.y2 - currentBox.y1

        ctx.fillRect(currentBox.x1, currentBox.y1, width, height)
        ctx.strokeRect(currentBox.x1, currentBox.y1, width, height)
      }

      requestAnimationFrame(draw)
    }

    draw()
  }, [areas, selectedAreaIndex, currentBox, hoveredBox, draggedBox, resizingBox, drawingForAreaIndex])

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check for delete button click first
    for (let areaIndex = areas.length - 1; areaIndex >= 0; areaIndex--) {
      const area = areas[areaIndex]
      if (!area.visible) continue

      for (let boxIndex = area.box.length - 1; boxIndex >= 0; boxIndex--) {
        const box = area.box[boxIndex]
        const btnX = box.x2 - 8
        const btnY = box.y1 + 8
        const btnRadius = 8
        const dist = Math.sqrt((x - btnX) ** 2 + (y - btnY) ** 2)

        if (dist <= btnRadius) {
          handleRemoveBox(areaIndex, boxIndex)
          return
        }
      }
    }

    // Check for resize handle
    for (let areaIndex = areas.length - 1; areaIndex >= 0; areaIndex--) {
      const area = areas[areaIndex]
      if (!area.visible) continue

      for (let boxIndex = area.box.length - 1; boxIndex >= 0; boxIndex--) {
        const box = area.box[boxIndex]
        const handle = getResizeHandle(x, y, box)
        if (handle) {
          setInteractionMode("resize")
          setResizingBox({ areaIndex, boxIndex, handle })
          setSelectedAreaIndex(areaIndex)
          return
        }
      }
    }

    // Check for drag (inside box)
    for (let areaIndex = areas.length - 1; areaIndex >= 0; areaIndex--) {
      const area = areas[areaIndex]
      if (!area.visible) continue

      for (let boxIndex = area.box.length - 1; boxIndex >= 0; boxIndex--) {
        const box = area.box[boxIndex]
        if (isPointInBox(x, y, box)) {
          setInteractionMode("move")
          setDraggedBox({ areaIndex, boxIndex })
          setDragOffset({ x: x - box.x1, y: y - box.y1 })
          setSelectedAreaIndex(areaIndex)
          return
        }
      }
    }

    // Start drawing new box
    if (drawingForAreaIndex !== null) {
      setInteractionMode("draw")
      setStartPoint({ x, y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Update hover state
    let newHoveredBox: { areaIndex: number; boxIndex: number } | null = null
    for (let areaIndex = areas.length - 1; areaIndex >= 0; areaIndex--) {
      const area = areas[areaIndex]
      if (!area.visible) continue

      for (let boxIndex = area.box.length - 1; boxIndex >= 0; boxIndex--) {
        const box = area.box[boxIndex]
        if (isPointInBox(x, y, box)) {
          newHoveredBox = { areaIndex, boxIndex }
          break
        }
      }
      if (newHoveredBox) break
    }
    setHoveredBox(newHoveredBox)

    // Update cursor
    if (interactionMode === "none") {
      let cursor = "default"
      for (let areaIndex = areas.length - 1; areaIndex >= 0; areaIndex--) {
        const area = areas[areaIndex]
        if (!area.visible) continue

        for (let boxIndex = area.box.length - 1; boxIndex >= 0; boxIndex--) {
          const box = area.box[boxIndex]
          const handle = getResizeHandle(x, y, box)
          if (handle) {
            const cursorMap: Record<ResizeHandle, string> = {
              nw: "nw-resize",
              ne: "ne-resize",
              sw: "sw-resize",
              se: "se-resize",
              n: "n-resize",
              s: "s-resize",
              w: "w-resize",
              e: "e-resize",
            }
            cursor = cursorMap[handle]
            break
          } else if (isPointInBox(x, y, box)) {
            cursor = "move"
            break
          }
        }
        if (cursor !== "default") break
      }
      if (drawingForAreaIndex !== null) cursor = "crosshair"
      canvas.style.cursor = cursor
    }

    // Handle interactions
    if (interactionMode === "draw" && startPoint && drawingForAreaIndex !== null) {
      setCurrentBox({
        x1: Math.min(startPoint.x, x),
        y1: Math.min(startPoint.y, y),
        x2: Math.max(startPoint.x, x),
        y2: Math.max(startPoint.y, y),
      })
    } else if (interactionMode === "move" && draggedBox && dragOffset) {
      const area = areas[draggedBox.areaIndex]
      const box = area.box[draggedBox.boxIndex]
      const width = box.x2 - box.x1
      const height = box.y2 - box.y1

      const newBox = constrainBox(
        {
          x1: x - dragOffset.x,
          y1: y - dragOffset.y,
          x2: x - dragOffset.x + width,
          y2: y - dragOffset.y + height,
        },
        canvas
      )

      const updatedBoxes = [...area.box]
      updatedBoxes[draggedBox.boxIndex] = newBox
      updateArea(draggedBox.areaIndex, { ...area, box: updatedBoxes })
    } else if (interactionMode === "resize" && resizingBox) {
      const area = areas[resizingBox.areaIndex]
      const box = area.box[resizingBox.boxIndex]
      let newBox = { ...box }

      const { handle } = resizingBox
      if (handle.includes("n")) newBox.y1 = y
      if (handle.includes("s")) newBox.y2 = y
      if (handle.includes("w")) newBox.x1 = x
      if (handle.includes("e")) newBox.x2 = x

      // Ensure min size and correct order
      if (newBox.x1 > newBox.x2) {
        ;[newBox.x1, newBox.x2] = [newBox.x2, newBox.x1]
      }
      if (newBox.y1 > newBox.y2) {
        ;[newBox.y1, newBox.y2] = [newBox.y2, newBox.y1]
      }

      newBox = constrainBox(newBox, canvas)

      const updatedBoxes = [...area.box]
      updatedBoxes[resizingBox.boxIndex] = newBox
      updateArea(resizingBox.areaIndex, { ...area, box: updatedBoxes })
    }
  }

  const handleMouseUp = () => {
    if (interactionMode === "draw" && currentBox && drawingForAreaIndex !== null) {
      // Add box to the area
      const area = areas[drawingForAreaIndex]
      if (area) {
        const canvas = canvasRef.current
        if (canvas) {
          const constrainedBox = constrainBox(currentBox, canvas)
          updateArea(drawingForAreaIndex, {
            ...area,
            box: [...area.box, constrainedBox],
          })
        }
      }
      setCurrentBox(null)
      setStartPoint(null)
    }

    setInteractionMode("none")
    setDraggedBox(null)
    setDragOffset(null)
    setResizingBox(null)
  }

  // Create new area
  const handleCreateArea = () => {
    if (!newAreaNickname.trim()) return

    addArea({
      nickname: newAreaNickname,
      box: [],
      colorCode: getNextColorCode(),
      enabled: true,
      visible: true,
    })
    setNewAreaNickname("")
  }

  // Start editing nickname
  const handleStartEdit = (index: number) => {
    setEditingAreaIndex(index)
    setEditingNickname(areas[index].nickname)
  }

  // Save edited nickname
  const handleSaveEdit = () => {
    if (editingAreaIndex === null || !editingNickname.trim()) return

    const area = areas[editingAreaIndex]
    updateArea(editingAreaIndex, {
      ...area,
      nickname: editingNickname,
    })
    setEditingAreaIndex(null)
    setEditingNickname("")
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingAreaIndex(null)
    setEditingNickname("")
  }

  // Remove specific box from area
  const handleRemoveBox = (areaIndex: number, boxIndex: number) => {
    const area = areas[areaIndex]
    updateArea(areaIndex, {
      ...area,
      box: area.box.filter((_, i) => i !== boxIndex),
    })
  }

  // Toggle area collapsed state
  const toggleAreaCollapsed = (areaIndex: number) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaIndex)) {
        next.delete(areaIndex)
      } else {
        next.add(areaIndex)
      }
      return next
    })
  }

  // Toggle area visibility
  const toggleAreaVisibility = (areaIndex: number) => {
    const area = areas[areaIndex]
    updateArea(areaIndex, {
      ...area,
      visible: !area.visible,
    })
  }

  // Toggle area enabled state
  const toggleAreaEnabled = (areaIndex: number) => {
    const area = areas[areaIndex]
    updateArea(areaIndex, {
      ...area,
      enabled: !area.enabled,
    })
  }

  return (
    <div className="grid grid-cols-3 gap-8">
      {/* Left: Video Stream with Overlay */}
      <div className="col-span-2 space-y-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (interactionMode !== "none") handleMouseUp()
            }}
          />
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <p className="text-sm text-muted-foreground">카메라 연결 중...</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Area List and Controls */}
      <div className="col-span-1 space-y-2 flex flex-col">
        <div>
          <h3 className="text-lg font-semibold">감시 영역 관리</h3>
        </div>

        {/* Create New Area */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              id="new-area-nickname"
              placeholder="감시 영역 이름 기입 (최대 10자)"
              value={newAreaNickname}
              onChange={(e) => setNewAreaNickname(e.target.value.slice(0, 10))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateArea()
              }}
            />
            <Button onClick={handleCreateArea} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Area List - Scrollable */}
        <div className="h-[600px] overflow-y-auto space-y-2 pr-2">
          {areas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 영역이 없습니다</p>
          ) : (
            areas.map((area, areaIndex) => {
              const color = COLOR_MAP[area.colorCode] || COLOR_MAP[1]
              const isCollapsed = collapsedAreas.has(areaIndex)
              return (
                <div
                  key={areaIndex}
                  className={cn(
                    "rounded-lg border p-3 space-y-2",
                    selectedAreaIndex === areaIndex && "border-primary bg-primary/5"
                  )}
                  style={{
                    borderColor: selectedAreaIndex === areaIndex ? color.stroke : undefined,
                  }}
                >
                  {/* Area Header */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      className="flex items-center gap-2 flex-1 text-left"
                      onClick={() => toggleAreaCollapsed(areaIndex)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color.stroke }} />
                      {editingAreaIndex === areaIndex ? (
                        <Input
                          value={editingNickname}
                          onChange={(e) => setEditingNickname(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit()
                            if (e.key === "Escape") handleCancelEdit()
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-medium text-sm">{area.nickname}</span>
                      )}
                    </button>

                    <div className="flex gap-1">
                      {editingAreaIndex === areaIndex ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleSaveEdit}
                            className="h-8 w-8"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="h-8 w-8"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleAreaVisibility(areaIndex)}
                            className="h-8 w-8"
                            title={area.visible ? "Hide on video" : "Show on video"}
                          >
                            {area.visible ? (
                              <Eye className="h-3 w-3" />
                            ) : (
                              <EyeOff className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStartEdit(areaIndex)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeArea(areaIndex)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {!isCollapsed && (
                    <>
                      {/* Enable/Disable Toggle */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <Label htmlFor={`area-enabled-${areaIndex}`} className="text-xs text-muted-foreground cursor-pointer">
                          영역 활성화
                        </Label>
                        <Switch
                          id={`area-enabled-${areaIndex}`}
                          checked={area.enabled}
                          onCheckedChange={() => toggleAreaEnabled(areaIndex)}
                        />
                      </div>

                      {/* Box Count */}
                      <p className="text-xs text-muted-foreground">{area.box.length}개의 사각형</p>

                      {/* Add Box Button */}
                      {editingAreaIndex !== areaIndex && (
                        <Button
                          size="sm"
                          variant={drawingForAreaIndex === areaIndex ? "default" : "outline"}
                          className="w-full"
                          onClick={() =>
                            setDrawingForAreaIndex(
                              drawingForAreaIndex === areaIndex ? null : areaIndex
                            )
                          }
                        >
                          {drawingForAreaIndex === areaIndex ? "그리기 종료" : "영역 추가"}
                        </Button>
                      )}

                      {/* Box List */}
                      {area.box.length > 0 && (
                        <div className="space-y-1 pt-2 border-t">
                          {area.box.map((box, boxIndex) => (
                            <div
                              key={boxIndex}
                              className={cn(
                                "flex items-center justify-between text-xs p-1 rounded transition-colors",
                                hoveredBox?.areaIndex === areaIndex &&
                                  hoveredBox?.boxIndex === boxIndex
                                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                                  : "hover:bg-muted"
                              )}
                              onMouseEnter={() => setHoveredBox({ areaIndex, boxIndex })}
                              onMouseLeave={() => setHoveredBox(null)}
                            >
                              <span className="text-muted-foreground">
                                {boxIndex + 1}: ({Math.round(box.x1)}, {Math.round(box.y1)}) - (
                                {Math.round(box.x2)}, {Math.round(box.y2)})
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveBox(areaIndex, boxIndex)}
                                className="h-5 w-5"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
