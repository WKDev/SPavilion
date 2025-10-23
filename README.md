# S-Pavilion: Hardware Monitoring System

## Overview
Real-time hardware monitoring system with PLC control, person detection, and data visualization.

## Features
- **PLC Device Monitoring & Control**: Monitor and control devices through PC/Mobile web browser
- **Live Video Streaming**: WebRTC-based real-time video with person detection overlay
- **Heatmap Visualization**: Spatial analysis of detected person locations
- **Usage Analytics**: Device usage history with time-series visualization
- **Responsive Interface**: Works on desktop and mobile browsers

## Quick Start
```bash
# Start all services
docker-compose up -d

# Access web interface
open http://localhost:3000

# View logs
docker-compose logs -f
```

## System Architecture

### Hardware Configuration
- **PC**
  - **Hardware**
    - UVC Webcam (USB) - Video input for person detection
    - PLC Controller (USB to RS232) - Device control and monitoring
  - **Software**
    - Docker services (see below)

### Docker Services
- **postgres**: PostgreSQL database with Prisma ORM
- **nest**: NestJS backend API + Modbus service
- **detection-service**: YOLOv8 person detection + RTSP streaming
- **mediamtx**: RTSP to WebRTC/HLS converter
- **nginx**: Reverse proxy (optional)
- **s-pavilion-react**: React frontend (development only, served by NestJS in production)

## PLC Configuration (LS XBC-DN20E)

### Specifications
- Model: LS XBC-DN20E (NPN, TR, 24V)
- Communication: Modbus RTU via USB-RS232
- Serial Port: /dev/ttyUSB0
- Baud Rate: 9600, 8N1, No flow control
- Timeout: 1000ms

### I/O Mapping

#### Input Buttons
| Button | Function |
|--------|----------|
| button1 | Heat On/Off |
| button2 | Fan On/Off |
| button3 | BTSP On/Off |
| button4 | Light Red On/Off |
| button5 | Light Green On/Off |
| button6 | Light Blue On/Off |
| button7 | Light White On/Off |
| button8 | Display On/Off |

#### Output Relays
| Relay | Function |
|-------|----------|
| Relay01 | Heat Control |
| Relay02 | Fan Control |
| Relay03 | Light Red |
| Relay04 | Light Green |
| Relay05 | Light Blue |
| Relay06 | Light White |
| Relay07 | Display |

### Modbus Coil Addresses

#### Status Read (0x00-0x07)
| Address | Device | Description |
|---------|--------|-------------|
| 0x00 | heat-status | Current heat state |
| 0x01 | fan-status | Current fan state |
| 0x02 | btsp-status | Current BTSP state |
| 0x03 | light-red-status | Current red light state |
| 0x04 | light-green-status | Current green light state |
| 0x05 | light-blue-status | Current blue light state |
| 0x06 | light-white-status | Current white light state |
| 0x07 | display-status | Current display state |

#### Control Write (0x10-0x17)
| Address | Device | Description |
|---------|--------|-------------|
| 0x10 | heat-set | Trigger heat toggle/reset timer |
| 0x11 | fan-set | Trigger fan toggle/reset timer |
| 0x12 | btsp-set | Trigger BTSP toggle/reset timer |
| 0x13 | light-red-set | Trigger red light toggle/reset timer |
| 0x14 | light-green-set | Trigger green light toggle/reset timer |
| 0x15 | light-blue-set | Trigger blue light toggle/reset timer |
| 0x16 | light-white-set | Trigger white light toggle/reset timer |
| 0x17 | display-set | Trigger display toggle |

### Device Timers
| Device | Timer Duration | Notes |
|--------|----------------|-------|
| heat | 10 minutes | Auto-off after timer expires |
| fan | 10 minutes | Auto-off after timer expires |
| btsp | 1 hour | Auto-off after timer expires |
| light-red | 1 hour | Auto-off after timer expires |
| light-green | 1 hour | Auto-off after timer expires |
| light-blue | 1 hour | Auto-off after timer expires |
| light-white | 1 hour | Auto-off after timer expires |
| display | Manual | No timer, toggle on/off |

### Control Logic
- **Timer-based devices** (heat, fan, btsp, lights):
  - First trigger: Start timer and turn on device
  - Second trigger: Stop timer and turn off device
  - Timer expiration: Auto turn off device
- **Manual devices** (display):
  - Toggle on/off with each trigger
  - No automatic timeout 