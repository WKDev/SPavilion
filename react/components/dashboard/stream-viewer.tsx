"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { WebRTCManager } from "@/lib/webrtc"
import { HeatmapOverlay } from "./heatmap-overlay"
import { Loader2 } from "lucide-react"

type ViewMode = "video" | "heatmap" | "overlay"

export function StreamViewer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const webrtcRef = useRef<WebRTCManager | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("video")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Initialize WebRTC connection
    const initWebRTC = async () => {
      if (!videoRef.current) return

      setIsConnecting(true)
      setError(null)

      try {
        webrtcRef.current = new WebRTCManager()
        await webrtcRef.current.connect(videoRef.current, (stream) => {
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

  return (
    <Card className="flex h-[400px] flex-col gap-4 p-4">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Camera Stream</h2>
        <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)}>
          <ToggleGroupItem value="video" aria-label="Video only">
            Video
          </ToggleGroupItem>
          <ToggleGroupItem value="heatmap" aria-label="Heatmap only">
            Heatmap
          </ToggleGroupItem>
          <ToggleGroupItem value="overlay" aria-label="Video with heatmap overlay">
            Overlay
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Stream Display */}
      <div className="relative flex-1 overflow-hidden rounded-lg bg-muted">
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
          className={`h-full w-full object-contain ${viewMode === "heatmap" ? "hidden" : ""}`}
        />

        {/* Heatmap Canvas */}
        {(viewMode === "heatmap" || viewMode === "overlay") && (
          <HeatmapOverlay canvasRef={canvasRef} isOverlay={viewMode === "overlay"} isConnected={isConnected} />
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
