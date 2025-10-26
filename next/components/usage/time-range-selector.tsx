"use client"

import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "custom"

interface TimeRangeSelectorProps {
  onRangeChange: (from: Date, to: Date) => void
}

export function TimeRangeSelector({ onRangeChange }: TimeRangeSelectorProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("24h")
  const [fromDate, setFromDate] = useState<Date>(new Date())
  const [toDate, setToDate] = useState<Date>(new Date())

  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range)
    const now = new Date()
    let from = new Date()

    switch (range) {
      case "1h":
        from = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case "6h":
        from = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        break
      case "24h":
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "custom":
        return // Don't update dates for custom range
    }

    setFromDate(from)
    setToDate(now)
    onRangeChange(from, now)
  }

  const handleCustomDateChange = () => {
    onRangeChange(fromDate, toDate)
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ToggleGroup
        type="single"
        value={selectedRange}
        onValueChange={(value) => value && handleRangeChange(value as TimeRange)}
      >
        <ToggleGroupItem value="1h">1h</ToggleGroupItem>
        <ToggleGroupItem value="6h">6h</ToggleGroupItem>
        <ToggleGroupItem value="24h">24h</ToggleGroupItem>
        <ToggleGroupItem value="7d">7d</ToggleGroupItem>
        <ToggleGroupItem value="30d">30d</ToggleGroupItem>
        <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
      </ToggleGroup>

      {selectedRange === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(fromDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={fromDate} onSelect={(date) => date && setFromDate(date)} />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">to</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(toDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={toDate} onSelect={(date) => date && setToDate(date)} />
            </PopoverContent>
          </Popover>

          <Button onClick={handleCustomDateChange}>Apply</Button>
        </div>
      )}
    </div>
  )
}
