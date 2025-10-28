"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import type { HeatmapData } from "@/lib/api"

interface HeatmapVisualizationProps {
  data: HeatmapData[]
  mode: "overlay" | "standalone"
  className?: string
  opacity?: number // 0-1 scale, default 0.6 for overlay, 0.8 for standalone
}

export function HeatmapVisualization({ data, mode, className = "", opacity }: HeatmapVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Default opacity: 0.6 for overlay, 0.8 for standalone
  const effectiveOpacity = opacity ?? (mode === "overlay" ? 0.6 : 0.8)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const container = containerRef.current

    // FHD resolution reference - consistent for both modes
    const VIDEO_WIDTH = 1920
    const VIDEO_HEIGHT = 1080
    const CELL_SIZE = 32

    // Mode-specific margins
    const margin = mode === "overlay"
      ? { top: 0, right: 0, bottom: 0, left: 0 }
      : { top: 60, right: 80, bottom: 20, left: 20 }

    // Get container dimensions with fallback
    const containerWidth = container.clientWidth || 800
    const containerHeight = container.clientHeight || 600

    // Calculate scale to fit container while preserving aspect ratio
    const availableWidth = containerWidth - margin.left - margin.right
    const availableHeight = containerHeight - margin.top - margin.bottom

    const scale = Math.min(
      availableWidth / VIDEO_WIDTH,
      availableHeight / VIDEO_HEIGHT
    )

    // Calculate actual drawable dimensions
    const width = VIDEO_WIDTH * scale
    const height = VIDEO_HEIGHT * scale

    // Clear previous chart and tooltips
    d3.select(svgRef.current).selectAll("*").remove()
    d3.select(container).selectAll(".heatmap-tooltip").remove()

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Grid size calculation (FHD resolution basis)
    const gridCols = Math.floor(VIDEO_WIDTH / CELL_SIZE)  // 60
    const gridRows = Math.floor(VIDEO_HEIGHT / CELL_SIZE) // 33

    // Convert data to grid map (aggregate by grid cell)
    const gridMap = new Map<string, number>()
    data.forEach(d => {
      const gridX = Math.floor(d.x / CELL_SIZE)
      const gridY = Math.floor(d.y / CELL_SIZE)
      const key = `${gridX},${gridY}`
      gridMap.set(key, (gridMap.get(key) || 0) + d.value)
    })

    // Generate complete grid data (all cells including zeros)
    const completeGridData: Array<[string, number]> = []
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const key = `${col},${row}`
        const value = gridMap.get(key) || 0
        completeGridData.push([key, value])
      }
    }

    // Calculate max value for color scale (excluding zeros)
    const maxValue = d3.max(Array.from(gridMap.values())) || 1

    // Color scale
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxValue])

    // Cell dimensions (scaled from FHD reference)
    const cellWidth = CELL_SIZE * scale
    const cellHeight = CELL_SIZE * scale

    // Add border outline for the entire heatmap area
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "none")
      .attr("stroke", "#9ca3af") // gray-400
      .attr("stroke-width", 2)
      .style("pointer-events", "none")

    // Render grid cells (all 60×33 cells, including zeros)
    const cells = svg
      .selectAll("rect.heatmap-cell")
      .data(completeGridData)
      .enter()
      .append("rect")
      .attr("class", "heatmap-cell")
      .attr("x", (d) => {
        const [gridX] = d[0].split(',').map(Number)
        return gridX * cellWidth
      })
      .attr("y", (d) => {
        const [, gridY] = d[0].split(',').map(Number)
        return gridY * cellHeight
      })
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", (d) => d[1] === 0 ? "transparent" : color(d[1]))
      .attr("stroke", mode === "overlay" ? "none" : (d) => d[1] === 0 ? "none" : "white")
      .attr("stroke-width", mode === "overlay" ? 0 : 0.5)
      .attr("rx", mode === "overlay" ? 0 : 1)
      .style("opacity", (d) => {
        if (d[1] === 0) return 0
        return effectiveOpacity
      })
      .style("cursor", "pointer")

    // Create tooltip div
    const tooltip = d3
      .select(container)
      .append("div")
      .attr("class", "heatmap-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "8px 12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("white-space", "nowrap")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)")

    // Add hover interactions
    cells
      .on("mouseenter", function (_event, d) {
        const [gridX, gridY] = d[0].split(',').map(Number)
        const pixelX = gridX * CELL_SIZE
        const pixelY = gridY * CELL_SIZE

        // Highlight the cell
        d3.select(this)
          .attr("stroke", mode === "overlay" ? "#3b82f6" : "#3b82f6") // blue-500
          .attr("stroke-width", 2)

        // Show tooltip
        tooltip
          .style("visibility", "visible")
          .html(`
            <div style="line-height: 1.5;">
              <div><strong>Grid:</strong> (${gridX}, ${gridY})</div>
              <div><strong>Pixel:</strong> (${pixelX}, ${pixelY})</div>
              <div><strong>Hits:</strong> ${d[1]}</div>
            </div>
          `)
      })
      .on("mousemove", function (event) {
        tooltip
          .style("top", (event.pageY - 10) + "px")
          .style("left", (event.pageX + 10) + "px")
      })
      .on("mouseleave", function () {
        // Remove highlight
        d3.select(this)
          .attr("stroke", mode === "overlay" ? "none" : "white")
          .attr("stroke-width", mode === "overlay" ? 0 : 0.5)

        // Hide tooltip
        tooltip.style("visibility", "hidden")
      })

    // Add cell value labels in standalone mode (only for cells with hits > 0)
    if (mode === "standalone" && cellWidth >= 20 && cellHeight >= 20) {
      svg
        .selectAll("text.cell-value")
        .data(completeGridData.filter(d => d[1] > 0))
        .enter()
        .append("text")
        .attr("class", "cell-value")
        .attr("x", (d) => {
          const [gridX] = d[0].split(',').map(Number)
          return gridX * cellWidth + cellWidth / 2
        })
        .attr("y", (d) => {
          const [, gridY] = d[0].split(',').map(Number)
          return gridY * cellHeight + cellHeight / 2
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .text((d) => d[1])
        .style("font-size", `${Math.min(cellWidth, cellHeight) * 0.4}px`)
        .style("font-weight", "600")
        .attr("fill", (d) => {
          // Use white text for dark cells, black for light cells
          const luminance = d3.hsl(color(d[1])).l
          return luminance > 0.6 ? "black" : "white"
        })
        .style("pointer-events", "none")
    }

    // Standalone mode: Add legend and stats
    if (mode === "standalone") {

      // Color legend
      const legendWidth = 20
      const legendHeight = 200
      const legendScale = d3
        .scaleLinear()
        .domain([0, maxValue])
        .range([legendHeight, 0])

      const legend = svg.append("g").attr("transform", `translate(${width + 10}, ${height / 2 - legendHeight / 2})`)

      // Gradient
      const defs = svg.append("defs")
      const gradient = defs
        .append("linearGradient")
        .attr("id", "heatmap-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%")

      gradient.append("stop").attr("offset", "0%").attr("stop-color", d3.interpolateYlOrRd(0))
      gradient.append("stop").attr("offset", "100%").attr("stop-color", d3.interpolateYlOrRd(1))

      legend
        .append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#heatmap-gradient)")

      legend.append("g").call(d3.axisRight(legendScale).ticks(5))

      // Legend title
      legend
        .append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -10)
        .style("text-anchor", "middle")
        .text("Hits")
        .style("font-size", "12px")
        .attr("fill", "currentColor")

      // Statistics info - positioned at top
      const stats = svg.append("g").attr("transform", `translate(10, -40)`)

      const statsText = [
        `FHD: ${VIDEO_WIDTH}×${VIDEO_HEIGHT} | Grid: ${gridCols}×${gridRows} | Cell: ${CELL_SIZE}px | Total: ${data.reduce((sum, d) => sum + d.value, 0)} | Max: ${maxValue}`
      ]

      stats
        .append("text")
        .text(statsText[0])
        .style("font-size", "13px")
        .style("font-weight", "500")
        .attr("fill", "currentColor")
    }
  }, [data, mode, effectiveOpacity])

  return (
    <div
      ref={containerRef}
      className={`w-full ${mode === "overlay" ? "h-full" : "min-h-[700px]"} ${className}`}
    >
      <svg ref={svgRef} className="w-full" />
    </div>
  )
}
