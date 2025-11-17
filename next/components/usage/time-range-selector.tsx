"use client"

import { useEffect } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { useStore, type TimeRange } from "@/lib/store"
import { useState } from "react"
import DatePicker, { registerLocale } from "react-datepicker"
import { ko as koLocale } from "date-fns/locale"
import "react-datepicker/dist/react-datepicker.css"

// Register Korean locale
registerLocale("ko", koLocale)

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
              <label className="text-xs font-medium">시작</label>
              <DatePicker
                selected={localFromDate}
                onChange={(date) => date && setLocalFromDate(date)}
                locale="ko"
                dateFormat="yyyy년 MM월 dd일"
                className="h-7 text-xs border rounded-md px-2 py-1 w-full bg-background text-foreground"
                calendarClassName="!border !rounded-md !bg-popover !text-popover-foreground"
                dayClassName={() => "hover:bg-accent rounded-sm"}
                wrapperClassName="w-full"
                popperClassName="!z-50"
                popperPlacement="bottom-start"
              />
              <Input
                type="time"
                value={localFromTime}
                onChange={(e) => setLocalFromTime(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium">종료</label>
              <DatePicker
                selected={localToDate}
                onChange={(date) => date && setLocalToDate(date)}
                locale="ko"
                dateFormat="yyyy년 MM월 dd일"
                className="h-7 text-xs border rounded-md px-2 py-1 w-full bg-background text-foreground"
                calendarClassName="!border !rounded-md !bg-popover !text-popover-foreground"
                dayClassName={() => "hover:bg-accent rounded-sm"}
                wrapperClassName="w-full"
                popperClassName="!z-50"
                popperPlacement="bottom-start"
              />
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
              취소
            </Button>
            <Button size="sm" onClick={handleCustomDateChange}>
              적용
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
