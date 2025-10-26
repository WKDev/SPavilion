"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import type { HeatmapData } from "@/lib/api"

interface HeatmapChartProps {
  data: HeatmapData[]
}

export function HeatmapChart({ data }: HeatmapChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return

    const container = containerRef.current
    const margin = { top: 20, right: 30, bottom: 40, left: 50 }
    const width = container.clientWidth - margin.left - margin.right
    const height = 400 - margin.top - margin.bottom

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove()

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Get unique x and y values
    const xValues = Array.from(new Set(data.map((d) => d.x))).sort((a, b) => a - b)
    const yValues = Array.from(new Set(data.map((d) => d.y))).sort((a, b) => a - b)

    // Create scales
    const x = d3.scaleBand().domain(xValues.map(String)).range([0, width]).padding(0.05)

    const y = d3.scaleBand().domain(yValues.map(String)).range([height, 0]).padding(0.05)

    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, d3.max(data, (d) => d.value) || 1])

    // Add X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickValues(xValues.filter((_, i) => i % Math.ceil(xValues.length / 10) === 0).map(String)))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")

    // Add Y axis
    svg
      .append("g")
      .call(d3.axisLeft(y).tickValues(yValues.filter((_, i) => i % Math.ceil(yValues.length / 10) === 0).map(String)))

    // Add X axis label
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom)
      .style("text-anchor", "middle")
      .text("X Position")
      .attr("fill", "currentColor")

    // Add Y axis label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("Y Position")
      .attr("fill", "currentColor")

    // Add heatmap cells
    svg
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (d) => x(String(d.x)) || 0)
      .attr("y", (d) => y(String(d.y)) || 0)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", (d) => color(d.value))
      .attr("rx", 2)
      .append("title")
      .text((d) => `Position: (${d.x}, ${d.y})\nValue: ${d.value}`)

    // Add color legend
    const legendWidth = 20
    const legendHeight = height
    const legendScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) || 1])
      .range([legendHeight, 0])

    const legend = svg.append("g").attr("transform", `translate(${width + 10}, 0)`)

    // Create gradient
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
  }, [data])

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  )
}
