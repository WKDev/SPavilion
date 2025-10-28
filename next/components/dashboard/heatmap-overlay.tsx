"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { api, type HeatmapData } from "@/lib/api"
import { HeatmapVisualization } from "@/components/heatmap/heatmap-visualization"

interface HeatmapOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  isOverlay: boolean
  isConnected: boolean
}

export function HeatmapOverlay({ canvasRef, isOverlay, isConnected }: HeatmapOverlayProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([])

  // Fetch heatmap data
  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const data = await api.getHeatmap()
        setHeatmapData(data)
      } catch (error) {
        console.error("[v0] Failed to fetch heatmap data:", error)
      }
    }

    fetchHeatmap()
    // Refresh heatmap every 5 seconds
    const interval = setInterval(fetchHeatmap, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className={`absolute inset-0 ${isOverlay ? "pointer-events-none" : ""}`}
      style={{
        background: isOverlay ? "transparent" : "hsl(var(--muted))",
      }}
    >
      {!isConnected && heatmapData.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading heatmap data...</p>
        </div>
      ) : (
        <HeatmapVisualization data={heatmapData} mode="overlay" />
      )}
    </div>
  )
}
