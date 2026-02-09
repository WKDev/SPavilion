"use client"

import { useMemo } from "react"
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, TimeScale, Tooltip, Legend } from "chart.js"
import "chartjs-adapter-date-fns"
import { Bar } from "react-chartjs-2"
import type { HistogramData } from "@/lib/api"
import {
  startOfMinute,
  startOfHour,
  startOfDay,
  startOfWeek,
  startOfMonth,
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  addMonths,
} from "date-fns"

ChartJS.register(BarElement, CategoryScale, LinearScale, TimeScale, Tooltip, Legend)

interface HistogramProps {
  data: HistogramData[]
  startDate: Date
  endDate: Date
}

type TimeUnit = "minute" | "hour" | "day" | "week" | "month"

function getInterval(startDate: Date, endDate: Date): { unit: TimeUnit; step: number } {
  const timeRangeHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
  const timeRangeDays = timeRangeHours / 24

  if (timeRangeHours <= 1) return { unit: "minute", step: 10 }
  if (timeRangeHours <= 6) return { unit: "hour", step: 1 }
  if (timeRangeHours <= 24) return { unit: "hour", step: 1 }
  if (timeRangeDays <= 7) return { unit: "day", step: 1 }
  if (timeRangeDays <= 30) return { unit: "day", step: 1 }
  if (timeRangeDays <= 90) return { unit: "week", step: 1 }
  return { unit: "month", step: 1 }
}

function getBucketFunctions(unit: TimeUnit) {
  switch (unit) {
    case "minute":
      return { startOf: startOfMinute, add: addMinutes }
    case "hour":
      return { startOf: startOfHour, add: addHours }
    case "day":
      return { startOf: startOfDay, add: addDays }
    case "week":
      return { startOf: startOfWeek, add: addWeeks }
    case "month":
      return { startOf: startOfMonth, add: addMonths }
  }
}

const CHART_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
]

export function Histogram({ data, startDate, endDate }: HistogramProps) {
  const { labels, datasets } = useMemo(() => {
    if (!data || data.length === 0) {
      return { labels: [], datasets: [] }
    }

    const devices = Array.from(new Set(data.map((d) => d.device)))
    const { unit, step } = getInterval(startDate, endDate)
    const { startOf, add } = getBucketFunctions(unit)

    const labels: Date[] = []
    let current = startOf(startDate)
    while (current <= endDate) {
      labels.push(current)
      current = add(current, unit === "minute" ? step : 1)
    }
    const labelTimes = labels.map((l) => l.getTime())

    const datasets = devices.map((device, i) => {
      const deviceData = data.filter((d) => d.device === device)
      const buckets = new Map<number, number>()
      for (const item of deviceData) {
        const timestamp = new Date(item.timestamp)
        const bucketTime = startOf(timestamp).getTime()
        const currentVal = buckets.get(bucketTime) || 0
        buckets.set(bucketTime, currentVal + item.value)
      }
      const datasetData = labelTimes.map((time) => buckets.get(time) || 0)
      return {
        label: device,
        data: datasetData,
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
      }
    })

    return { labels, datasets }
  }, [data, startDate, endDate])

  const chartData = {
    labels,
    datasets,
  }

  const { unit, step } = getInterval(startDate, endDate)

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "time" as const,
        time: {
          unit: unit,
          stepSize: step,
          tooltipFormat: "yyyy-MM-dd HH:mm",
          displayFormats: {
            minute: "HH:mm",
            hour: "HH:mm",
            day: "MM/dd",
            week: "MM/dd",
            month: "yyyy/MM",
          },
        },
        min: startDate.toISOString(),
        max: endDate.toISOString(),
        ticks: {
          autoSkip: true,
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Usage Value",
        },
        grid: {
          color: "hsl(var(--border))",
        },
      },
    },
    plugins: {
      legend: {
        position: "top" as const,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
  }

  return (
    <div className="w-full h-[200px]">
      <Bar data={chartData} options={options} />
    </div>
  )
}
