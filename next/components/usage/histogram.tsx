"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import type { HistogramData } from "@/lib/api"

interface HistogramProps {
  data: HistogramData[]
  startDate: Date
  endDate: Date
}

export function Histogram({ data, startDate, endDate }: HistogramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !startDate || !endDate) return

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

    // Calculate time range and determine appropriate tick interval
    const timeRange = endDate.getTime() - startDate.getTime()
    const timeRangeHours = timeRange / (1000 * 60 * 60)
    const timeRangeDays = timeRange / (1000 * 60 * 60 * 24)

    let tickInterval: d3.TimeInterval | null = null
    let tickFormat: (date: Date) => string = d3.timeFormat("%H:%M")

    if (timeRangeHours <= 1) {
      // 1시간 이하: 10분 단위
      tickInterval = d3.timeMinute.every(10)
      tickFormat = d3.timeFormat("%H:%M")
    } else if (timeRangeHours <= 24) {
      // 24시간 이하: 1시간 단위
      tickInterval = d3.timeHour.every(1)
      tickFormat = d3.timeFormat("%H:%M")
    } else if (timeRangeDays <= 7) {
      // 7일 이하: 1일 단위
      tickInterval = d3.timeDay.every(1)
      tickFormat = d3.timeFormat("%m/%d")
    } else if (timeRangeDays <= 14) {
      // 2주 이하: 1일 단위
      tickInterval = d3.timeDay.every(1)
      tickFormat = d3.timeFormat("%m/%d")
    } else if (timeRangeDays <= 30) {
      // 30일 이하: 1일 단위
      tickInterval = d3.timeDay.every(1)
      tickFormat = d3.timeFormat("%m/%d")
    } else {
      // 커스텀 범위: 자동 설정
      if (timeRangeDays <= 90) {
        tickInterval = d3.timeDay.every(7) // 주 단위
        tickFormat = d3.timeFormat("%m/%d")
      } else if (timeRangeDays <= 365) {
        tickInterval = d3.timeMonth.every(1) // 월 단위
        tickFormat = d3.timeFormat("%Y/%m")
      } else {
        tickInterval = d3.timeMonth.every(3) // 분기 단위
        tickFormat = d3.timeFormat("%Y/%m")
      }
    }

    const parseTime = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ")
    const dataWithDates = data.map((d) => ({
      ...d,
      date: parseTime(d.timestamp) || new Date(),
    }))

    // Group data by device and time bucket
    const devices = Array.from(new Set(data.map((d) => d.device)))
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(devices)

    // Create time buckets using the determined interval
    const bucketedData = d3.rollup(
      dataWithDates,
      (v) => d3.sum(v, (d) => d.value),
      (d) => tickInterval?.floor(d.date) || d.date,
      (d) => d.device,
    )

    // Flatten the bucketed data
    const flatData: Array<{ date: Date; device: string; value: number }> = []
    bucketedData.forEach((deviceMap, date) => {
      deviceMap.forEach((value, device) => {
        flatData.push({ date, device, value })
      })
    })

    // Generate all ticks in the query range
    const allTicks: Date[] = []
    if (tickInterval) {
      let current = tickInterval.floor(startDate)
      while (current <= endDate) {
        allTicks.push(new Date(current))
        current = tickInterval.offset(current, 1)
      }
    }

    // Create scales using the full query range
    const x = d3
      .scaleBand()
      .domain(allTicks.map(d => d.toISOString()))
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
          return tickFormat(date)
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
      // Create data for all ticks, filling missing data with 0
      const deviceData = allTicks.map(tick => {
        const existingData = flatData.find(d => 
          d.device === device && 
          tickInterval ? tickInterval.floor(d.date).getTime() === tick.getTime() : d.date.getTime() === tick.getTime()
        )
        return {
          date: tick,
          device,
          value: existingData?.value || 0
        }
      })

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
  }, [data, startDate, endDate])

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  )
}
