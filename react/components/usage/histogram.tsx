"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import type { HistogramData } from "@/lib/api"

interface HistogramProps {
  data: HistogramData[]
}

export function Histogram({ data }: HistogramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return

    const container = containerRef.current
    const margin = { top: 20, right: 30, bottom: 40, left: 50 }
    const width = container.clientWidth - margin.left - margin.right
    const height = 300 - margin.top - margin.bottom

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove()

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    const parseTime = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ")
    const dataWithDates = data.map((d) => ({
      ...d,
      date: parseTime(d.timestamp) || new Date(),
    }))

    // Group data by device and time bucket
    const devices = Array.from(new Set(data.map((d) => d.device)))
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(devices)

    // Create time buckets (aggregate by hour or appropriate interval)
    const timeBuckets = d3.timeHour.every(1)
    const bucketedData = d3.rollup(
      dataWithDates,
      (v) => d3.sum(v, (d) => d.value),
      (d) => timeBuckets?.floor(d.date) || d.date,
      (d) => d.device,
    )

    // Flatten the bucketed data
    const flatData: Array<{ date: Date; device: string; value: number }> = []
    bucketedData.forEach((deviceMap, date) => {
      deviceMap.forEach((value, device) => {
        flatData.push({ date, device, value })
      })
    })

    // Create scales
    const x = d3
      .scaleBand()
      .domain(Array.from(new Set(flatData.map((d) => d.date.toISOString()))).sort())
      .range([0, width])
      .padding(0.1)

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(flatData, (d) => d.value) || 0])
      .nice()
      .range([height, 0])

    // Add X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(x).tickFormat((d) => {
          const date = new Date(d as string)
          return d3.timeFormat("%H:%M")(date)
        }),
      )
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")

    // Add Y axis
    svg.append("g").call(d3.axisLeft(y))

    // Add Y axis label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("Usage Value")
      .attr("fill", "currentColor")

    // Group bars by time bucket
    const barWidth = x.bandwidth() / devices.length

    // Add bars for each device
    devices.forEach((device, i) => {
      const deviceData = flatData.filter((d) => d.device === device)

      svg
        .selectAll(`.bar-${device}`)
        .data(deviceData)
        .enter()
        .append("rect")
        .attr("class", `bar-${device}`)
        .attr("x", (d) => (x(d.date.toISOString()) || 0) + barWidth * i)
        .attr("y", (d) => y(d.value))
        .attr("width", barWidth)
        .attr("height", (d) => height - y(d.value))
        .attr("fill", color(device))
        .append("title")
        .text((d) => `${device}\n${d3.timeFormat("%Y-%m-%d %H:%M")(d.date)}\nValue: ${d.value}`)
    })
    // </CHANGE>

    // Add legend
    const legend = svg
      .selectAll(".legend")
      .data(devices)
      .enter()
      .append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => `translate(0,${i * 20})`)

    legend
      .append("rect")
      .attr("x", width - 18)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", (d) => color(d))

    legend
      .append("text")
      .attr("x", width - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("text-anchor", "end")
      .text((d) => d)
      .attr("fill", "currentColor")
  }, [data])

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  )
}
