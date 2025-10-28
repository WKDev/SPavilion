"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { useEffect, useState } from "react"

interface TMButtonProps {
  title: string
  isOn?: boolean
  progress?: number
  onToggle: () => void
  stateType?: "coil" | "register" | "legacy"
  statusAddr?: number   // Address to read state from
  commandAddr?: number  // Address to write commands to (not used for display, only for API calls)
  stateValue?: number
}

export function TMButton({
  title,
  isOn: legacyIsOn,
  progress: legacyProgress,
  onToggle,
  stateType = "legacy",
  statusAddr,
  commandAddr,
  stateValue
}: TMButtonProps) {
  const { plc } = useStore()
  const [isOn, setIsOn] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [remainText, setRemainText] = useState("")

  useEffect(() => {
    if (stateType === "legacy") {
      setIsOn(legacyIsOn || false)
      setProgressPercent(legacyProgress || 0)
      setRemainText(`${legacyProgress || 0}m`)
    } else if (stateType === "coil" && statusAddr !== undefined) {
      // Coil state: boolean (true = green, false = gray)
      // Read from statusAddr (0x00-0x07 range)
      const coilValue = plc.coils[statusAddr] || false
      setIsOn(coilValue)
      setProgressPercent(0)
      setRemainText("")
    } else if (stateType === "register" && statusAddr !== undefined) {
      // Register state: timer countdown in seconds
      // Read from statusAddr
      const registerValue = plc.registers[statusAddr] || 0

      // If register value > 0, it's on (timer running)
      setIsOn(registerValue > 0)

      // Calculate progress (assuming max value if stateValue is provided, else 600s = 10min default)
      const maxSeconds = stateValue || 600
      const percent = (registerValue / maxSeconds) * 100
      setProgressPercent(Math.min(percent, 100))

      // Format remaining time as MM:SS
      const minutes = Math.floor(registerValue / 60)
      const seconds = registerValue % 60
      setRemainText(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }
  }, [stateType, statusAddr, commandAddr, stateValue, legacyIsOn, legacyProgress, plc.coils, plc.registers])

  return (
    <Button
      onClick={onToggle}
      className={cn(
        "relative h-12 w-full flex-col gap-1 overflow-hidden transition-colors",
        isOn ? "bg-green-600 hover:bg-green-700" : "bg-muted hover:bg-muted/80",
      )}
      variant={isOn ? "default" : "outline"}
    >
      <span className="text-xs font-medium">{title}</span>
      {(stateType === "register" || stateType === "legacy") && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/20">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          {remainText && (
            <span className="absolute bottom-0.5 right-2 text-[10px] opacity-70">{remainText}</span>
          )}
        </>
      )}
    </Button>
  )
}
