// WebRTC connection manager for MediaMTX streaming

const WEBRTC_URL = process.env.NEXT_PUBLIC_WEBRTC_URL || "http://localhost:8889"

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null
  private videoElement: HTMLVideoElement | null = null
  private onStreamCallback: ((stream: MediaStream) => void) | null = null

  constructor() {
    this.peerConnection = null
  }

  async connect(videoElement: HTMLVideoElement, onStream?: (stream: MediaStream) => void) {
    this.videoElement = videoElement
    this.onStreamCallback = onStream || null

    console.log("[v0] Initializing WebRTC connection to:", WEBRTC_URL)

    // Create peer connection
    // UDP와 TCP 모두 허용 (기본값)
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ],
      // 'all'은 UDP와 TCP 모두 허용 (기본값)
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 0
    })

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      console.log("[v0] Received remote track:", event.track.kind, event.track.id)
      if (this.videoElement && event.streams[0]) {
        this.videoElement.srcObject = event.streams[0]
        console.log("[v0] Video element srcObject set")
        if (this.onStreamCallback) {
          this.onStreamCallback(event.streams[0])
        }
      }
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate
        const isTCP = candidate.includes('tcp')
        const isUDP = candidate.includes('udp')
        console.log(`[v0] New ICE candidate: ${isTCP ? 'TCP' : isUDP ? 'UDP' : 'OTHER'}`, candidate)
      } else {
        console.log("[v0] ICE candidate gathering completed")
      }
    }

    // Handle ICE connection state
    let iceRestartAttempts = 0
    const MAX_ICE_RESTARTS = 2
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState
      console.log("[v0] ICE connection state:", iceState)
      
      if (iceState === "failed") {
        if (iceRestartAttempts < MAX_ICE_RESTARTS) {
          iceRestartAttempts++
          console.error(`[v0] ICE connection failed, attempting restart ${iceRestartAttempts}/${MAX_ICE_RESTARTS}...`)
          // Try to restart ICE - this will trigger new candidate gathering
          try {
            this.peerConnection?.restartIce()
          } catch (error) {
            console.error("[v0] Failed to restart ICE:", error)
          }
        } else {
          console.error("[v0] ICE connection failed after multiple restart attempts")
          console.error("[v0] This may be due to:")
          console.error("  - UDP ports blocked by firewall/network")
          console.error("  - MediaMTX TCP WebRTC not enabled")
          console.error("  - Network connectivity issues")
        }
      } else if (iceState === "connected" || iceState === "completed") {
        iceRestartAttempts = 0 // Reset on successful connection
      }
    }

    // Handle ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log("[v0] ICE gathering state:", this.peerConnection?.iceGatheringState)
    }

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      console.log("[v0] Connection state:", state)
      if (state === "failed") {
        console.error("[v0] WebRTC connection failed. Possible causes:")
        console.error("  - MediaMTX server not running or unreachable")
        console.error("  - Network connectivity issues")
        console.error("  - ICE candidate exchange failed")
        console.error("  - SDP negotiation failed")
      }
    }

    // Handle signaling state
    this.peerConnection.onsignalingstatechange = () => {
      console.log("[v0] Signaling state:", this.peerConnection?.signalingState)
    }

    // Add transceiver for receiving video
    this.peerConnection.addTransceiver("video", { direction: "recvonly" })

    // Create and set local offer
    try {
      console.log("[v0] Creating offer...")
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      })
      console.log("[v0] Offer created, setting local description...")
      await this.peerConnection.setLocalDescription(offer)
      console.log("[v0] Local description set, SDP length:", offer.sdp.length)

      // Send offer to MediaMTX and get answer
      const whepUrl = `${WEBRTC_URL}/camera/whep`
      console.log("[v0] Sending offer to:", whepUrl)
      
      const response = await fetch(whepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      })

      console.log("[v0] Response status:", response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        console.error("[v0] MediaMTX response error:", errorText)
        throw new Error(`Failed to connect to MediaMTX: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const answerSdp = await response.text()
      console.log("[v0] Received answer SDP, length:", answerSdp.length)
      
      await this.peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      })

      console.log("[v0] Remote description set, WebRTC connection established")
    } catch (error) {
      console.error("[v0] Failed to establish WebRTC connection:", error)
      if (error instanceof Error) {
        console.error("[v0] Error details:", error.message)
        console.error("[v0] Stack:", error.stack)
      }
      throw error
    }
  }

  disconnect() {
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null
    }
    console.log("[v0] WebRTC connection closed")
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === "connected"
  }
}
