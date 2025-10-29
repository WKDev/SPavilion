"use client"

import { useState, useRef, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { WebRTCManager } from "@/lib/webrtc"
import { CameraAreaSelector } from "@/components/settings/camera-area-selector"

export function CameraSettings() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const webrtcRef = useRef<WebRTCManager | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [streamUrl, setStreamUrl] = useState(
    `${process.env.NEXT_PUBLIC_WEBRTC_URL || "http://localhost:8889"}/camera/`
  )

  useEffect(() => {
    const initWebRTC = async () => {
      if (!videoRef.current) return

      try {
        webrtcRef.current = new WebRTCManager()
        await webrtcRef.current.connect(videoRef.current, () => {
          setIsConnected(true)
        })
      } catch (err) {
        console.error("WebRTC connection error:", err)
      }
    }

    initWebRTC()

    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.disconnect()
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* WebRTC Stream URL */}
      <div className="space-y-2">
        <Label htmlFor="webrtc-stream-url">Camera Stream URL</Label>
        <Input
          id="webrtc-stream-url"
          type="text"
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          placeholder="http://localhost:8889/camera/"
        />
      </div>

      {/* Camera Area Selector */}
      <div className="space-y-2 pt-4 border-t">
        <CameraAreaSelector />
      </div>
    </div>
  )
}
