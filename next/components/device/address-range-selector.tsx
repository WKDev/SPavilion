"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface AddressRangeSelectorProps {
  onRangeChange: (start: number, count: number) => void
  maxAddress?: number
  maxCount?: number
  defaultStart?: number
  defaultCount?: number
  title?: string
  description?: string
}

export function AddressRangeSelector({
  onRangeChange,
  maxAddress = 65535,
  maxCount = 2000,
  defaultStart = 0,
  defaultCount = 100,
  title = "Address Range",
  description = "Select the address range to query"
}: AddressRangeSelectorProps) {
  const [start, setStart] = useState(defaultStart)
  const [count, setCount] = useState(defaultCount)
  const [customCount, setCustomCount] = useState("")

  const presetCounts = [
    { label: "10", value: 10 },
    { label: "50", value: 50 },
    { label: "100", value: 100 },
    { label: "200", value: 200 },
    { label: "500", value: 500 },
    { label: "1000", value: 1000 },
    { label: "2000", value: 2000 },
  ].filter(preset => preset.value <= maxCount)

  const handleStartChange = (value: string) => {
    const newStart = parseInt(value, 10)
    if (!isNaN(newStart) && newStart >= 0 && newStart <= maxAddress) {
      setStart(newStart)
      // 범위가 최대값을 초과하지 않도록 count 조정
      const maxAllowedCount = Math.min(count, maxAddress - newStart + 1, maxCount)
      if (maxAllowedCount !== count) {
        setCount(maxAllowedCount)
      }
    }
  }

  const handleCountChange = (value: string) => {
    if (value === "custom") {
      return // custom 입력 모드로 전환
    }

    const newCount = parseInt(value, 10)
    if (!isNaN(newCount) && newCount > 0) {
      const maxAllowedCount = Math.min(newCount, maxAddress - start + 1, maxCount)
      setCount(maxAllowedCount)
      setCustomCount("")
    }
  }

  const handleCustomCountChange = (value: string) => {
    setCustomCount(value)
    const newCount = parseInt(value, 10)
    if (!isNaN(newCount) && newCount > 0) {
      const maxAllowedCount = Math.min(newCount, maxAddress - start + 1, maxCount)
      setCount(maxAllowedCount)
    }
  }

  const handleApply = () => {
    onRangeChange(start, count)
  }

  const endAddress = start + count - 1
  const isValidRange = start >= 0 && start <= maxAddress && count > 0 && count <= maxCount && endAddress <= maxAddress

  return (
    <div className="rounded-lg border p-2 bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Label className="text-xs">{title}</Label>
        <Badge variant={isValidRange ? "secondary" : "destructive"} className="text-xs">
          {isValidRange ? "✓" : "✗"}
        </Badge>
      </div>
      <div className="grid gap-2 grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="start-address" className="text-xs text-muted-foreground">Start</Label>
          <Input
            id="start-address"
            type="number"
            min="0"
            max={maxAddress}
            value={start}
            onChange={(e) => handleStartChange(e.target.value)}
            placeholder="0"
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="count" className="text-xs text-muted-foreground">Count</Label>
          <Select value={count.toString()} onValueChange={handleCountChange}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Count" />
            </SelectTrigger>
            <SelectContent>
              {presetCounts.map((preset) => (
                <SelectItem key={preset.value} value={preset.value.toString()} className="text-xs">
                  {preset.label}
                </SelectItem>
              ))}
              <SelectItem value="custom" className="text-xs">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs text-muted-foreground">Range</Label>
          <div className="flex items-center gap-1 h-7">
            <span className="text-xs text-muted-foreground">{start}-{endAddress}</span>
            <Button 
              onClick={handleApply} 
              disabled={!isValidRange}
              size="sm"
              className="h-6 text-xs ml-auto"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

