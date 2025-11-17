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

interface DeviceHistogramProps {
  data: HistogramData[]
  deviceName: string
  startDate: Date
  endDate: Date
}

type TimeUnit = "minute" | "hour" | "day" | "week" | "month"

function getInterval(startDate: Date, endDate: Date): { unit: TimeUnit; step: number } {
  const timeRangeHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
  const timeRangeDays = timeRangeHours / 24

  if (timeRangeHours <= 1) return { unit: "minute", step: 10 }
  if (timeRangeHours <= 24) return { unit: "hour", step: 1 }
  if (timeRangeDays <= 30) return { unit: "day", step: 1 }
  if (timeRangeDays <= 90) return { unit: "week", step: 1 }
  return { unit: "month", step: 1 }
}

function getBucketFunctions(unit: TimeUnit) {
  switch (unit) {
    case "minute":
      return {
        startOf: startOfMinute,
        add: addMinutes,
      }
    case "hour":
      return {
        startOf: startOfHour,
        add: addHours,
      }
    case "day":
      return {
        startOf: startOfDay,
        add: addDays,
      }
    case "week":
      return {
        startOf: startOfWeek,
        add: addWeeks,
      }
    case "month":
      return {
        startOf: startOfMonth,
        add: addMonths,
      }
  }
}

export function DeviceHistogram({ data, deviceName, startDate, endDate }: DeviceHistogramProps) {
  const { labels, values } = useMemo(() => {
    if (!data || data.length === 0) {
      return { labels: [], values: [] }
    }

    const { unit, step } = getInterval(startDate, endDate)
    const { startOf, add } = getBucketFunctions(unit)

    const buckets = new Map<number, number>()
    for (const item of data) {
      const timestamp = new Date(item.timestamp)
      const bucketTime = startOf(timestamp).getTime()
      const currentVal = buckets.get(bucketTime) || 0
      buckets.set(bucketTime, currentVal + item.value)
    }

    const labels: Date[] = []
    const values: number[] = []
    let current = startOf(startDate)
    while (current <= endDate) {
      labels.push(current)
      values.push(buckets.get(current.getTime()) || 0)
      current = add(current, unit === "minute" ? step : 1)
    }
    return { labels, values }
  }, [data, startDate, endDate])

  const chartData = {
    labels,
    datasets: [
      {
        label: deviceName,
        data: values,
        backgroundColor: "hsl(var(--primary))",
        borderColor: "hsl(var(--primary))",
        borderWidth: 1,
        barPercentage: 0.8,
        categoryPercentage: 0.9,
      },
    ],
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
          text: "Count",
        },
        grid: {
          color: "hsl(var(--border))",
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            if (context[0]) {
              return new Date(context[0].parsed.x).toLocaleString()
            }
            return ""
          },
        },
      },
    },
  }

  return (
    <div className="w-full h-[250px]">
      <Bar data={chartData} options={options} />
    </div>
  )
}
