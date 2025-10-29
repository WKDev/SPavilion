"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { WebRTCManager } from "@/lib/webrtc"
import { HeatmapOverlay } from "./heatmap-overlay"
import { Loader2 } from "lucide-react"
import { useStore, useCameraAreaStore } from "@/lib/store"

type ViewOption = "video" | "heatmap" | "surveillance"

// Fixed reference resolution (matches heatmap resolution from detection service)
const REFERENCE_WIDTH = 1920
const REFERENCE_HEIGHT = 1080

// Color map for surveillance areas (matching camera-area-selector)
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

export function StreamViewer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null!)
  const surveillanceCanvasRef = useRef<HTMLCanvasElement>(null)
  const webrtcRef = useRef<WebRTCManager | null>(null)

  // Load saved settings from localStorage
  const [selectedViews, setSelectedViews] = useState<ViewOption[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stream-viewer-viewmode")
      return saved ? JSON.parse(saved) : ["video"]
    }
    return ["video"]
  })

  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get time range from global store
  const timeRangeState = useStore((state) => state.timeRange)

  // Get camera areas from store
  const { areas } = useCameraAreaStore()

  // Overlay opacity (0-100, maps to 0-1 for HeatmapVisualization)
  const [opacity, setOpacity] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stream-viewer-opacity")
      return saved ? parseInt(saved, 10) : 60
    }
    return 60
  })

  // Convert global time range state to { from, to } format for HeatmapOverlay with useMemo
  const timeRange = useMemo(() => {
    const fromDate = new Date(timeRangeState.fromDate)
    const [fromHour, fromMinute] = timeRangeState.fromTime.split(":").map(Number)
    fromDate.setHours(fromHour, fromMinute, 0, 0)

    const toDate = new Date(timeRangeState.toDate)
    const [toHour, toMinute] = timeRangeState.toTime.split(":").map(Number)
    toDate.setHours(toHour, toMinute, 59, 999)

    return { from: fromDate, to: toDate }
  }, [timeRangeState.fromDate, timeRangeState.toDate, timeRangeState.fromTime, timeRangeState.toTime])

  // Save selectedViews to localStorage when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("stream-viewer-viewmode", JSON.stringify(selectedViews))
    }
  }, [selectedViews])

  // Save opacity to localStorage when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("stream-viewer-opacity", opacity.toString())
    }
  }, [opacity])

  useEffect(() => {
    // Initialize WebRTC connection
    const initWebRTC = async () => {
      if (!videoRef.current) return

      setIsConnecting(true)
      setError(null)

      try {
        webrtcRef.current = new WebRTCManager()
        await webrtcRef.current.connect(videoRef.current, () => {
          console.log("[v0] Stream received, ready to play")
          setIsConnected(true)
        })
      } catch (err) {
        console.error("[v0] WebRTC connection error:", err)
        setError(err instanceof Error ? err.message : "Failed to connect to camera")
        setIsConnected(false)
      } finally {
        setIsConnecting(false)
      }
    }

    initWebRTC()

    // Cleanup on unmount
    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.disconnect()
      }
    }
  }, [])

  // Helper function to convert reference resolution (1920x1080) to canvas coordinates
  // All boxes are stored in reference resolution (1920x1080) for consistency with heatmap
  const referenceToCanvas = (box: { x1: number; y1: number; x2: number; y2: number }, canvas: HTMLCanvasElement) => {
    const scaleX = canvas.width / REFERENCE_WIDTH
    const scaleY = canvas.height / REFERENCE_HEIGHT
    return {
      x1: box.x1 * scaleX,
      y1: box.y1 * scaleY,
      x2: box.x2 * scaleX,
      y2: box.y2 * scaleY,
    }
  }

  // Draw surveillance areas on canvas
  useEffect(() => {
    if (!surveillanceCanvasRef.current || !videoRef.current || !selectedViews.includes("surveillance"))
      return

    const canvas = surveillanceCanvasRef.current
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

      // Draw surveillance areas (read-only, no interaction)
      areas.forEach((area) => {
        if (!area.visible) return // Skip if not visible

        // Use the custom color field, fallback to colorCode mapping
        const customColor = area.color || COLOR_MAP[area.colorCode]?.stroke || "#ef4444"
        const color = {
          stroke: customColor,
          fill: `${customColor}26`, // Add 15% opacity (26 in hex)
        }

        area.box.forEach((box) => {
          // Convert from reference resolution (1920x1080) to canvas coordinates for display
          const canvasBox = referenceToCanvas(box, canvas)

          // Set colors and styles
          if (!area.enabled) {
            // Disabled state: dashed border, semi-transparent
            ctx.strokeStyle = color.stroke
            ctx.lineWidth = 2
            ctx.fillStyle = color.fill.replace("0.15", "0.05")
            ctx.setLineDash([5, 5])
          } else {
            ctx.strokeStyle = color.stroke
            ctx.lineWidth = 2
            ctx.fillStyle = color.fill
            ctx.setLineDash([])
          }

          const width = canvasBox.x2 - canvasBox.x1
          const height = canvasBox.y2 - canvasBox.y1

          ctx.fillRect(canvasBox.x1, canvasBox.y1, width, height)
          ctx.strokeRect(canvasBox.x1, canvasBox.y1, width, height)
          ctx.setLineDash([]) // Reset dash

          // Draw area nickname in center without background
          const centerX = (canvasBox.x1 + canvasBox.x2) / 2
          const centerY = (canvasBox.y1 + canvasBox.y2) / 2

          ctx.font = "bold 14px sans-serif"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"

          // Draw text with stroke for visibility
          ctx.strokeStyle = "#000000"
          ctx.lineWidth = 3
          ctx.strokeText(area.nickname, centerX, centerY)

          ctx.fillStyle = color.stroke
          ctx.fillText(area.nickname, centerX, centerY)
        })
      })

      requestAnimationFrame(draw)
    }

    draw()
  }, [areas, selectedViews])

  // Helper to toggle view selection
  const handleViewToggle = (value: string[]) => {
    setSelectedViews(value as ViewOption[])
  }

  // Check if specific views are enabled
  const showVideo = selectedViews.includes("video")
  const showHeatmap = selectedViews.includes("heatmap")
  const showSurveillance = selectedViews.includes("surveillance")

  return (
    <Card className="flex flex-col gap-4 p-4">
      {/* Header: ViewMode Toggle + Conditional Controls */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: View Mode Toggle - Multiple selection like checkboxes */}
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">보기:</Label>
          <ToggleGroup
            type="multiple"
            value={selectedViews}
            onValueChange={handleViewToggle}
          >
            <ToggleGroupItem value="video" aria-label="Video">
              영상
            </ToggleGroupItem>
            <ToggleGroupItem value="heatmap" aria-label="Heatmap">
              히트맵
            </ToggleGroupItem>
            <ToggleGroupItem value="surveillance" aria-label="Surveillance Area">
              감시영역
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Right: Conditional Controls based on ViewMode */}
        <div className="flex items-center gap-4">
          {/* Heatmap opacity slider (when heatmap is visible) */}
          {showHeatmap && (
            <div className="flex items-center gap-2">
              <Label htmlFor="opacity-slider" className="whitespace-nowrap text-sm">
                Opacity
              </Label>
              <Slider
                id="opacity-slider"
                value={[opacity]}
                min={0}
                max={100}
                step={5}
                className="w-24"
                onValueChange={([value]) => setOpacity(value)}
              />
              <span className="text-xs text-muted-foreground w-8">{opacity}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Stream Display */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {/* Loading State */}
        {isConnecting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connecting to camera...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isConnecting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-destructive">Connection Failed</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-contain ${!showVideo ? "hidden" : ""}`}
        />

        {/* Heatmap Canvas */}
        {showHeatmap && (
          <HeatmapOverlay
            canvasRef={canvasRef}
            isOverlay={showVideo} // Overlay mode if video is also shown
            isConnected={isConnected}
            timeRange={timeRange}
            opacity={opacity / 100} // Convert 0-100 to 0-1 scale
          />
        )}

        {/* Surveillance Area Canvas (read-only, no interaction) */}
        {showSurveillance && (
          <canvas
            ref={surveillanceCanvasRef}
            className="absolute inset-0 h-full w-full pointer-events-none"
          />
        )}

        {/* Connection Status Indicator */}
        {isConnected && !error && (
          <div className="absolute right-2 top-2 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-muted-foreground">Live</span>
          </div>
        )}
      </div>
    </Card>
  )
}
