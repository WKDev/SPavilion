"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import type { HeatmapData } from "@/lib/api"

interface HeatmapVisualizationProps {
  data: HeatmapData[]
  mode: "overlay" | "standalone"
  className?: string
}

export function HeatmapVisualization({ data, mode, className = "" }: HeatmapVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
      : { top: 20, right: 30, bottom: 40, left: 50 }

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

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove()

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

    // Calculate max value for color scale
    const maxValue = d3.max(Array.from(gridMap.values())) || 1

    // Color scale
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxValue])

    // Cell dimensions (scaled from FHD reference)
    const cellWidth = CELL_SIZE * scale
    const cellHeight = CELL_SIZE * scale

    // Render grid cells
    const cells = svg
      .selectAll("rect")
      .data(Array.from(gridMap.entries()))
      .enter()
      .append("rect")
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
      .attr("fill", (d) => color(d[1]))
      .attr("stroke", mode === "overlay" ? "none" : "white")
      .attr("stroke-width", mode === "overlay" ? 0 : 0.5)
      .attr("rx", mode === "overlay" ? 0 : 1)
      .style("opacity", (d) => {
        if (d[1] === 0) return 0
        return mode === "overlay" ? 0.6 : 0.8
      })

    // Tooltips
    cells
      .append("title")
      .text((d) => {
        const [gridX, gridY] = d[0].split(',').map(Number)
        const pixelX = gridX * CELL_SIZE
        const pixelY = gridY * CELL_SIZE
        return `Grid: (${gridX}, ${gridY})\nPixel: (${pixelX}, ${pixelY})\nHits: ${d[1]}`
      })

    // Standalone mode: Add axes, legend, and stats
    if (mode === "standalone") {
      // X axis (FHD pixel coordinates)
      const xScale = d3.scaleLinear()
        .domain([0, VIDEO_WIDTH])
        .range([0, width])

      svg
        .append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(10))
        .selectAll("text")
        .style("font-size", "12px")

      // Y axis (FHD pixel coordinates)
      const yScale = d3.scaleLinear()
        .domain([VIDEO_HEIGHT, 0])
        .range([height, 0])

      svg
        .append("g")
        .call(d3.axisLeft(yScale).ticks(10))
        .selectAll("text")
        .style("font-size", "12px")

      // Axis labels
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 5)
        .style("text-anchor", "middle")
        .text("X Position (FHD pixels)")
        .attr("fill", "currentColor")
        .style("font-size", "14px")

      svg
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 15)
        .attr("x", 0 - height / 2)
        .style("text-anchor", "middle")
        .text("Y Position (FHD pixels)")
        .attr("fill", "currentColor")
        .style("font-size", "14px")

      // Color legend
      const legendWidth = 20
      const legendHeight = 200
      const legendScale = d3
        .scaleLinear()
        .domain([0, maxValue])
        .range([legendHeight, 0])

      const legend = svg.append("g").attr("transform", `translate(${width + 10}, 20)`)

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

      // Statistics info
      const stats = svg.append("g").attr("transform", `translate(10, 20)`)

      stats
        .append("text")
        .text(`FHD Resolution: ${VIDEO_WIDTH} × ${VIDEO_HEIGHT}`)
        .style("font-size", "12px")
        .attr("fill", "currentColor")

      stats
        .append("text")
        .attr("y", 15)
        .text(`Grid Size: ${gridCols} × ${gridRows}`)
        .style("font-size", "12px")
        .attr("fill", "currentColor")

      stats
        .append("text")
        .attr("y", 30)
        .text(`Cell Size: ${CELL_SIZE}px`)
        .style("font-size", "12px")
        .attr("fill", "currentColor")

      stats
        .append("text")
        .attr("y", 45)
        .text(`Total Hits: ${data.reduce((sum, d) => sum + d.value, 0)}`)
        .style("font-size", "12px")
        .attr("fill", "currentColor")

      stats
        .append("text")
        .attr("y", 60)
        .text(`Max Hits: ${maxValue}`)
        .style("font-size", "12px")
        .attr("fill", "currentColor")
    }
  }, [data, mode])

  return (
    <div
      ref={containerRef}
      className={`w-full ${mode === "overlay" ? "h-full" : ""} ${className}`}
    >
      <svg ref={svgRef} className="w-full" />
    </div>
  )
}
