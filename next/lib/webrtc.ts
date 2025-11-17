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
    // Electron 환경에서 브라우저와 동일하게 작동하도록 설정
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ],
      // 'all'은 UDP와 TCP 모두 허용 (기본값)
      // Electron에서는 명시적으로 설정하는 것이 중요
      iceTransportPolicy: 'all',
      // ICE candidate pool 크기 설정 (Electron에서 더 안정적)
      iceCandidatePoolSize: 10,
      // Electron에서 네트워크 인터페이스 선택 개선
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
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
    // 이 핸들러는 나중에 offer 전송 전에 재설정될 수 있으므로 참조 저장
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate
        const isTCP = candidate.includes('tcp')
        const isUDP = candidate.includes('udp')
        
        // Parse candidate type
        let candidateType = 'unknown'
        if (candidate.includes('typ host')) candidateType = 'host'
        else if (candidate.includes('typ srflx')) candidateType = 'srflx (STUN)'
        else if (candidate.includes('typ relay')) candidateType = 'relay (TURN)'
        
        console.log(`[v0] New ICE candidate: ${isTCP ? 'TCP' : isUDP ? 'UDP' : 'OTHER'} [${candidateType}]`, candidate)
      } else {
        console.log("[v0] ICE candidate gathering completed - null candidate received")
      }
    }

    // Handle ICE connection state
    let iceRestartAttempts = 0
    const MAX_ICE_RESTARTS = 2
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState
      const connectionState = this.peerConnection?.connectionState
      console.log(`[v0] ICE connection state: ${iceState}, Connection state: ${connectionState}`)
      
      if (iceState === "failed" || iceState === "disconnected") {
        // disconnected 상태에서도 일정 시간 후 failed로 전환될 수 있으므로 모니터링
        if (iceState === "failed") {
          if (iceRestartAttempts < MAX_ICE_RESTARTS) {
            iceRestartAttempts++
            console.error(`[v0] ICE connection failed, attempting restart ${iceRestartAttempts}/${MAX_ICE_RESTARTS}...`)
            // Try to restart ICE - this will trigger new candidate gathering
            try {
              this.peerConnection?.restartIce()
              // Restart ICE 후 새로운 offer 생성 필요
              console.log("[v0] ICE restarted, new candidates will be gathered")
            } catch (error) {
              console.error("[v0] Failed to restart ICE:", error)
            }
          } else {
            console.error("[v0] ICE connection failed after multiple restart attempts")
            console.error("[v0] This may be due to:")
            console.error("  - UDP/TCP ports blocked by firewall/network")
            console.error("  - MediaMTX TCP WebRTC not enabled (check webrtcLocalTCPAddress)")
            console.error("  - Network connectivity issues")
            console.error("  - NAT traversal failure (TURN server may be needed)")
          }
        } else if (iceState === "disconnected") {
          console.warn("[v0] ICE connection disconnected - may recover or fail soon")
        }
      } else if (iceState === "connected" || iceState === "completed") {
        iceRestartAttempts = 0 // Reset on successful connection
        console.log("[v0] ICE connection established successfully!")
      } else if (iceState === "checking") {
        console.log("[v0] ICE connection checking - attempting to establish connection...")
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

      // Wait for ICE candidate gathering to complete before sending offer
      // This ensures all candidates are included in the SDP
      // Electron에서는 candidate 수집이 더 오래 걸릴 수 있으므로 타임아웃을 늘림
      await new Promise<void>((resolve) => {
        // null candidate 이벤트 확인 (추가 안전장치)
        let nullCandidateReceived = false
        const originalOnIceCandidate = this.peerConnection.onicecandidate
        const enhancedOnIceCandidate = (event: RTCPeerConnectionIceEvent) => {
          // 원래 핸들러 호출
          if (originalOnIceCandidate) {
            originalOnIceCandidate.call(this.peerConnection, event)
          }
          
          // null candidate 확인
          if (!event.candidate && !nullCandidateReceived) {
            nullCandidateReceived = true
            console.log("[v0] Null candidate received - ICE gathering may be complete")
            // null candidate가 와도 완전히 완료되지 않을 수 있으므로
            // icegatheringstatechange를 계속 기다림
          }
        }
        
        // 상태 변화를 기다림
        const onGatheringStateChange = () => {
          const state = this.peerConnection?.iceGatheringState
          console.log(`[v0] ICE gathering state changed: ${state}`)
          if (state === 'complete') {
            clearTimeout(timeout)
            cleanup()
            console.log("[v0] ICE candidate gathering completed before sending offer")
            resolve()
          }
        }
        
        // Cleanup 함수
        const cleanup = () => {
          this.peerConnection?.removeEventListener('icegatheringstatechange', onGatheringStateChange)
          // 원래 핸들러로 복원
          if (originalOnIceCandidate) {
            this.peerConnection.onicecandidate = originalOnIceCandidate
          }
        }
        
        const timeout = setTimeout(() => {
          const currentState = this.peerConnection?.iceGatheringState
          console.warn(`[v0] ICE gathering timeout after 10s, current state: ${currentState}, proceeding anyway...`)
          console.warn("[v0] Some candidates may be missing, but connection will be attempted")
          cleanup()
          resolve()
        }, 10000) // Electron에서는 10초로 증가

        // 이미 완료된 경우 즉시 resolve
        if (this.peerConnection?.iceGatheringState === 'complete') {
          clearTimeout(timeout)
          console.log("[v0] ICE candidate gathering already completed")
          resolve()
          return
        }

        // 이벤트 리스너 등록
        this.peerConnection.addEventListener('icegatheringstatechange', onGatheringStateChange)
        this.peerConnection.onicecandidate = enhancedOnIceCandidate
      })

      // Get updated SDP with all ICE candidates
      const updatedOffer = this.peerConnection.localDescription
      if (!updatedOffer) {
        throw new Error("Local description not set")
      }

      console.log("[v0] Sending offer with all ICE candidates, SDP length:", updatedOffer.sdp.length)

      // Send offer to MediaMTX and get answer
      const whepUrl = `${WEBRTC_URL}/camera/whep`
      console.log("[v0] Sending offer to:", whepUrl)
      
      const response = await fetch(whepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: updatedOffer.sdp,
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
