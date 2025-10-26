"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TMButtonProps {
  title: string
  isOn: boolean
  progress: number
  onToggle: () => void
}

export function TMButton({ title, isOn, progress, onToggle }: TMButtonProps) {
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
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/20">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <span className="absolute bottom-0.5 right-2 text-[10px] opacity-70">{progress}m</span>
    </Button>
  )
}
