"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface AddressRangeSelectorProps {
  onRangeChange: (start: number, count: number) => void
  maxAddress?: number
  defaultStart?: number
  defaultCount?: number
  title?: string
  description?: string
}

export function AddressRangeSelector({
  onRangeChange,
  maxAddress = 65535,
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
  ]

  const handleStartChange = (value: string) => {
    const newStart = parseInt(value, 10)
    if (!isNaN(newStart) && newStart >= 0 && newStart <= maxAddress) {
      setStart(newStart)
      // 범위가 최대값을 초과하지 않도록 count 조정
      const maxCount = Math.min(count, maxAddress - newStart + 1)
      if (maxCount !== count) {
        setCount(maxCount)
      }
    }
  }

  const handleCountChange = (value: string) => {
    if (value === "custom") {
      return // custom 입력 모드로 전환
    }
    
    const newCount = parseInt(value, 10)
    if (!isNaN(newCount) && newCount > 0) {
      const maxCount = Math.min(newCount, maxAddress - start + 1)
      setCount(maxCount)
      setCustomCount("")
    }
  }

  const handleCustomCountChange = (value: string) => {
    setCustomCount(value)
    const newCount = parseInt(value, 10)
    if (!isNaN(newCount) && newCount > 0) {
      const maxCount = Math.min(newCount, maxAddress - start + 1)
      setCount(maxCount)
    }
  }

  const handleApply = () => {
    onRangeChange(start, count)
  }

  const endAddress = start + count - 1
  const isValidRange = start >= 0 && start <= maxAddress && count > 0 && endAddress <= maxAddress

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant={isValidRange ? "default" : "destructive"}>
            {isValidRange ? "Valid" : "Invalid"}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start-address">Start Address</Label>
            <Input
              id="start-address"
              type="number"
              min="0"
              max={maxAddress}
              value={start}
              onChange={(e) => handleStartChange(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="count">Count</Label>
            <div className="flex gap-2">
              <Select value={count.toString()} onValueChange={handleCountChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  {presetCounts.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value.toString()}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              {count > 0 && count <= 2000 && (
                <Input
                  className="flex-1"
                  type="number"
                  min="1"
                  max="2000"
                  value={customCount}
                  onChange={(e) => handleCustomCountChange(e.target.value)}
                  placeholder="Custom count"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Range: {start} - {endAddress} ({count} addresses)
          </div>
          <Button 
            onClick={handleApply} 
            disabled={!isValidRange}
            size="sm"
          >
            Apply Range
          </Button>
        </div>

        {!isValidRange && (
          <div className="text-sm text-destructive">
            {start < 0 && "Start address must be >= 0. "}
            {start > maxAddress && `Start address must be <= ${maxAddress}. `}
            {count <= 0 && "Count must be > 0. "}
            {endAddress > maxAddress && `End address (${endAddress}) exceeds maximum (${maxAddress}).`}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

