"use client"

import { useEffect } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { useStore, type TimeRange } from "@/lib/store"
import { useState } from "react"
import type { DayPickerProps } from "react-day-picker"

// Korean weekday formatter
const koreanWeekdayFormatter: DayPickerProps["formatters"] = {
  formatWeekdayName: (date) => {
    const days = ["일", "월", "화", "수", "목", "금", "토"]
    return days[date.getDay()]
  },
}

export function TimeRangeSelector() {
  const timeRange = useStore((state) => state.timeRange)
  const setTimeRange = useStore((state) => state.setTimeRange)
  const setCustomTimeRange = useStore((state) => state.setCustomTimeRange)

  // Local state for custom popover
  const [isCustomPopoverOpen, setIsCustomPopoverOpen] = useState(false)
  const [localFromDate, setLocalFromDate] = useState<Date>(timeRange.fromDate)
  const [localToDate, setLocalToDate] = useState<Date>(timeRange.toDate)
  const [localFromTime, setLocalFromTime] = useState<string>(timeRange.fromTime)
  const [localToTime, setLocalToTime] = useState<string>(timeRange.toTime)

  const handleRangeChange = (range: TimeRange) => {
    if (range === "custom") {
      setIsCustomPopoverOpen(true)
    }
    setTimeRange(range)
  }

  const handleCustomDateChange = () => {
    // Combine date and time
    const [fromHour, fromMinute] = localFromTime.split(":").map(Number)
    const [toHour, toMinute] = localToTime.split(":").map(Number)

    const fromDateTime = new Date(localFromDate)
    fromDateTime.setHours(fromHour, fromMinute, 0, 0)

    const toDateTime = new Date(localToDate)
    toDateTime.setHours(toHour, toMinute, 59, 999)

    const label = `${format(fromDateTime, "MM/dd HH:mm")} - ${format(toDateTime, "MM/dd HH:mm")}`

    setCustomTimeRange(localFromDate, localToDate, localFromTime, localToTime, label)
    setIsCustomPopoverOpen(false)
  }

  // Open popover when custom is selected
  useEffect(() => {
    if (timeRange.selectedRange === "custom") {
      setIsCustomPopoverOpen(true)
    }
  }, [timeRange.selectedRange])

  return (
    <div className="flex items-center gap-4 relative">
      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground font-mono whitespace-pre-line">
        {(() => {
          const start = new Date(timeRange.fromDate)
          start.setHours(
            parseInt(timeRange.fromTime.split(":")[0]),
            parseInt(timeRange.fromTime.split(":")[1]),
            0,
            0
          )
          const end = new Date(timeRange.toDate)
          end.setHours(
            parseInt(timeRange.toTime.split(":")[0]),
            parseInt(timeRange.toTime.split(":")[1]),
            59,
            999
          )
          const startStr = format(start, "yy/MM/dd HH:mm")
          const endStr = format(end, "yy/MM/dd HH:mm")
          return (
            <>
              <div>시작: {startStr}</div>
              <div>종료: {endStr}</div>
            </>
          )
        })()}
      </div>

      <ToggleGroup
        type="single"
        value={timeRange.selectedRange}
        onValueChange={(value) => value && handleRangeChange(value as TimeRange)}
      >
        <ToggleGroupItem value="1h">1h</ToggleGroupItem>
        <ToggleGroupItem value="6h">6h</ToggleGroupItem>
        <ToggleGroupItem value="24h">24h</ToggleGroupItem>
        <ToggleGroupItem value="7d">7d</ToggleGroupItem>
        <ToggleGroupItem value="30d">30d</ToggleGroupItem>
        <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
      </ToggleGroup>

      <Popover open={isCustomPopoverOpen} onOpenChange={setIsCustomPopoverOpen}>
        <PopoverTrigger asChild>
          <button className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent className="p-3 w-auto" align="start" side="bottom" sideOffset={8}>
          <div className="flex gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium">Start</label>
              <div className="text-xs font-medium text-center py-1 px-2 bg-muted rounded-md">
                {format(localFromDate, "yyyy년 MM월 dd일")}
              </div>
              <div className="border rounded-md overflow-hidden">
                <Calendar
                  mode="single"
                  selected={localFromDate}
                  onSelect={(date) => date && setLocalFromDate(date)}
                  formatters={koreanWeekdayFormatter}
                  className="p-2"
                  classNames={{
                    months: "flex flex-col",
                    month: "space-y-2",
                    caption: "flex justify-center relative items-center px-1",
                    caption_label: "text-xs font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                    nav_button_previous: "absolute left-0",
                    nav_button_next: "absolute right-0",
                    table: "w-full border-collapse",
                    head_row: "flex",
                    head_cell: "text-muted-foreground w-7 font-normal text-[0.65rem]",
                    row: "flex w-full mt-1",
                    cell: "h-7 w-7 text-center text-xs p-0 relative",
                    day: "h-7 w-7 p-0 font-normal hover:bg-accent rounded-sm",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                    day_today: "bg-accent text-accent-foreground",
                    day_outside: "text-muted-foreground opacity-50",
                  }}
                />
              </div>
              <Input
                type="time"
                value={localFromTime}
                onChange={(e) => setLocalFromTime(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium">End</label>
              <div className="text-xs font-medium text-center py-1 px-2 bg-muted rounded-md">
                {format(localToDate, "yyyy년 MM월 dd일")}
              </div>
              <div className="border rounded-md overflow-hidden">
                <Calendar
                  mode="single"
                  selected={localToDate}
                  onSelect={(date) => date && setLocalToDate(date)}
                  formatters={koreanWeekdayFormatter}
                  className="p-2"
                  classNames={{
                    months: "flex flex-col",
                    month: "space-y-2",
                    caption: "flex justify-center relative items-center px-1",
                    caption_label: "text-xs font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                    nav_button_previous: "absolute left-0",
                    nav_button_next: "absolute right-0",
                    table: "w-full border-collapse",
                    head_row: "flex",
                    head_cell: "text-muted-foreground w-7 font-normal text-[0.65rem]",
                    row: "flex w-full mt-1",
                    cell: "h-7 w-7 text-center text-xs p-0 relative",
                    day: "h-7 w-7 p-0 font-normal hover:bg-accent rounded-sm",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                    day_today: "bg-accent text-accent-foreground",
                    day_outside: "text-muted-foreground opacity-50",
                  }}
                />
              </div>
              <Input
                type="time"
                value={localToTime}
                onChange={(e) => setLocalToTime(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCustomPopoverOpen(false)
                setTimeRange("24h")
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleCustomDateChange}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
