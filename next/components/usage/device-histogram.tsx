"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import type { HistogramData } from "@/lib/api"

interface DeviceHistogramProps {
  data: HistogramData[]
  deviceName: string
  startDate: Date
  endDate: Date
}

export function DeviceHistogram({ data, deviceName, startDate, endDate }: DeviceHistogramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !startDate || !endDate) return

    const container = containerRef.current
    const margin = { top: 20, right: 30, bottom: 40, left: 50 }
    const width = container.clientWidth - margin.left - margin.right
    const height = 250 - margin.top - margin.bottom

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove()

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Calculate time range and determine appropriate tick interval
    const timeRange = endDate.getTime() - startDate.getTime()
    const timeRangeHours = timeRange / (1000 * 60 * 60)
    const timeRangeDays = timeRange / (1000 * 60 * 60 * 24)

    let tickInterval: d3.TimeInterval | null = null
    let tickFormat: (date: Date) => string = d3.timeFormat("%H:%M")

    if (timeRangeHours <= 1) {
      tickInterval = d3.timeMinute.every(10)
      tickFormat = d3.timeFormat("%H:%M")
    } else if (timeRangeHours <= 24) {
      tickInterval = d3.timeHour.every(1)
      tickFormat = d3.timeFormat("%H:%M")
    } else if (timeRangeDays <= 7) {
      tickInterval = d3.timeDay.every(1)
      tickFormat = d3.timeFormat("%m/%d")
    } else if (timeRangeDays <= 14) {
      tickInterval = d3.timeDay.every(1)
      tickFormat = d3.timeFormat("%m/%d")
    } else if (timeRangeDays <= 30) {
      tickInterval = d3.timeDay.every(1)
      tickFormat = d3.timeFormat("%m/%d")
    } else {
      if (timeRangeDays <= 90) {
        tickInterval = d3.timeDay.every(7)
        tickFormat = d3.timeFormat("%m/%d")
      } else if (timeRangeDays <= 365) {
        tickInterval = d3.timeMonth.every(1)
        tickFormat = d3.timeFormat("%Y/%m")
      } else {
        tickInterval = d3.timeMonth.every(3)
        tickFormat = d3.timeFormat("%Y/%m")
      }
    }

    const parseTime = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ")
    const dataWithDates = data.map((d) => ({
      ...d,
      date: parseTime(d.timestamp) || new Date(),
    }))

    // Bucket data by time interval
    const bucketedData = d3.rollup(
      dataWithDates,
      (v) => d3.sum(v, (d) => d.value),
      (d) => tickInterval?.floor(d.date) || d.date,
    )

    // Generate all ticks in the query range
    const allTicks: Date[] = []
    if (tickInterval) {
      let current = tickInterval.floor(startDate)
      while (current <= endDate) {
        allTicks.push(new Date(current))
        current = tickInterval.offset(current, 1)
      }
    }

    // Create flat data with all ticks
    const flatData = allTicks.map(tick => ({
      date: tick,
      value: bucketedData.get(tick) || 0
    }))

    // Create scales
    const x = d3
      .scaleBand()
      .domain(allTicks.map(d => d.toISOString()))
      .range([0, width])
      .padding(0.2)

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(flatData, (d) => d.value) || 1])
      .nice()
      .range([height, 0])

    // Add X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(x).tickFormat((d) => {
          const date = new Date(d as string)
          return tickFormat(date)
        }),
      )
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")

    // Add Y axis
    svg.append("g").call(d3.axisLeft(y).ticks(5))

    // Add Y axis label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Count")
      .attr("fill", "currentColor")

    // Add bars
    svg
      .selectAll(".bar")
      .data(flatData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.date.toISOString()) || 0)
      .attr("y", (d) => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d.value))
      .attr("fill", "hsl(var(--primary))")
      .attr("opacity", 0.8)
      .append("title")
      .text((d) => `${deviceName}\n${d3.timeFormat("%Y-%m-%d %H:%M")(d.date)}\nCount: ${d.value}`)
  }, [data, deviceName, startDate, endDate])

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  )
}
