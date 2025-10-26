// WebRTC connection manager for MediaMTX streaming

const WEBRTC_URL = process.env.NEXT_PUBLIC_WEBRTC_URL || "http://localhost:8888"

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

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      console.log("[v0] Received remote track:", event.track.kind)
      if (this.videoElement && event.streams[0]) {
        this.videoElement.srcObject = event.streams[0]
        if (this.onStreamCallback) {
          this.onStreamCallback(event.streams[0])
        }
      }
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[v0] New ICE candidate:", event.candidate)
      }
    }

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log("[v0] Connection state:", this.peerConnection?.connectionState)
    }

    // Add transceiver for receiving video
    this.peerConnection.addTransceiver("video", { direction: "recvonly" })

    // Create and set local offer
    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)

    // Send offer to MediaMTX and get answer
    try {
      const response = await fetch(`${WEBRTC_URL}/camera/whep`, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      })

      if (!response.ok) {
        throw new Error(`Failed to connect to MediaMTX: ${response.statusText}`)
      }

      const answerSdp = await response.text()
      await this.peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      })

      console.log("[v0] WebRTC connection established")
    } catch (error) {
      console.error("[v0] Failed to establish WebRTC connection:", error)
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
