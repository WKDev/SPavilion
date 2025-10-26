"use client"

import type React from "react"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface InputPopoverProps {
  title: string
  address: number
  value: number
  onConfirm: (value: number) => void
  children: React.ReactNode
}

export function InputPopover({ title, address, value, onConfirm, children }: InputPopoverProps) {
  const [open, setOpen] = useState(false)
  const [displayMode, setDisplayMode] = useState<"decimal" | "hex">("decimal")
  const [inputValue, setInputValue] = useState(value.toString())

  const handleConfirm = () => {
    const parsedValue = displayMode === "hex" ? Number.parseInt(inputValue, 16) : Number.parseInt(inputValue, 10)
    if (!isNaN(parsedValue)) {
      onConfirm(parsedValue)
      setOpen(false)
    }
  }

  const handleCancel = () => {
    setInputValue(value.toString())
    setOpen(false)
  }

  const displayValue = displayMode === "hex" ? value.toString(16).toUpperCase() : value.toString()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">{title}</h4>
            <p className="text-sm text-muted-foreground">Address: {address}</p>
          </div>

          <div className="space-y-2">
            <Label>Display Mode</Label>
            <ToggleGroup
              type="single"
              value={displayMode}
              onValueChange={(value) => {
                if (value) {
                  setDisplayMode(value as "decimal" | "hex")
                  const currentValue = Number.parseInt(inputValue, displayMode === "hex" ? 16 : 10)
                  setInputValue(value === "hex" ? currentValue.toString(16).toUpperCase() : currentValue.toString())
                }
              }}
            >
              <ToggleGroupItem value="decimal">Decimal</ToggleGroupItem>
              <ToggleGroupItem value="hex">Hex</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label>Current Value</Label>
            <div className="rounded-md bg-muted p-2 text-sm">{displayValue}</div>
          </div>

          <div className="space-y-2">
            <Label>New Value</Label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={displayMode === "hex" ? "Enter hex value" : "Enter decimal value"}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleConfirm} className="flex-1">
              Confirm
            </Button>
            <Button onClick={handleCancel} variant="outline" className="flex-1 bg-transparent">
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
