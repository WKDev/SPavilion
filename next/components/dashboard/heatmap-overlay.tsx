"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { api, type HeatmapData } from "@/lib/api"

interface HeatmapOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  isOverlay: boolean
  isConnected: boolean
}

export function HeatmapOverlay({ canvasRef, isOverlay, isConnected }: HeatmapOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
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

  // Render heatmap using D3
  useEffect(() => {
    if (!containerRef.current || heatmapData.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Clear previous SVG
    d3.select(container).selectAll("svg").remove()

    // Create SVG
    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("position", "absolute")
      .style("top", 0)
      .style("left", 0)

    // Create color scale
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, d3.max(heatmapData, (d) => d.value) || 1])

    // Calculate cell size based on data range
    const xExtent = d3.extent(heatmapData, (d) => d.x) as [number, number]
    const yExtent = d3.extent(heatmapData, (d) => d.y) as [number, number]
    const cellWidth = width / (xExtent[1] - xExtent[0] + 1)
    const cellHeight = height / (yExtent[1] - yExtent[0] + 1)

    // Draw heatmap cells
    svg
      .selectAll("rect")
      .data(heatmapData)
      .enter()
      .append("rect")
      .attr("x", (d) => (d.x - xExtent[0]) * cellWidth)
      .attr("y", (d) => height - (d.y - yExtent[0] + 1) * cellHeight)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", (d) => colorScale(d.value))
      .attr("opacity", isOverlay ? 0.6 : 0.8)
      .attr("rx", 2)

    // Add tooltips
    svg
      .selectAll("rect")
      .append("title")
      .text((d) => `Position: (${d.x}, ${d.y})\nValue: ${d.value}`)
  }, [heatmapData, isOverlay])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${isOverlay ? "pointer-events-none" : ""}`}
      style={{
        background: isOverlay ? "transparent" : "hsl(var(--muted))",
      }}
    >
      {!isConnected && heatmapData.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading heatmap data...</p>
        </div>
      )}
    </div>
  )
}
