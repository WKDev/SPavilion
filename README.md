# S-Pavilion: Hardware Monitoring System

## Overview
Real-time IoT monitoring system combining PLC device control, AI-powered person detection (YOLOv8), WebRTC video streaming, and data visualization. This MVP project demonstrates integration between industrial hardware (Modbus RTU), computer vision, and modern web technologies.

**Project Status**: Active development - Core infrastructure and API endpoints implemented, frontend in progress.

## Features
- **PLC Device Monitoring & Control**: Monitor and control 8 devices through web browser (Desktop/Mobile)
- **Live Video Streaming**: WebRTC-based real-time video with person detection bounding boxes
- **AI Person Detection**: YOLOv8n model with hourly heatmap aggregation
- **Heatmap Visualization**: Spatial analysis of detected person locations over time
- **Usage Analytics**: Device usage history with time-series visualization (D3.js)
- **Responsive Interface**: Next.js 16 + React 19 with shadcn/ui components

---

## System Architecture

### Data Flow Diagram
```
┌──────────────┐
│ UVC Camera   │ USB
│ (Video Input)│──────┐
└──────────────┘      │
                      ▼
              ┌───────────────────┐
              │ detection-service │ YOLOv8n + OpenCV + GStreamer
              │   (Python)        │
              └─────────┬─────────┘
                        │
        ┌───────────────┼─────────────────┐
        │ RTSP          │ HTTP POST       │
        ▼               ▼                 │
 ┌──────────┐    ┌─────────────┐         │
 │ MediaMTX │    │ NestJS API  │◄────────┘
 │  RTSP→   │    │ /api/bbox   │
 │  WebRTC  │    │  _history   │
 └─────┬────┘    └──────┬──────┘
       │                 │
       │                 │ Prisma ORM
       │                 ▼
       │          ┌─────────────┐
       │          │ PostgreSQL  │
       │          │  Database   │
       │          └─────────────┘
       │
       │ WebRTC
       ▼
┌──────────────────┐
│ Next.js Frontend │ React 19 + shadcn/ui
│  (Port 3000)     │
└────────┬─────────┘
         │
         │ REST API
         ▼
  ┌─────────────┐        ┌──────────────┐
  │ NestJS API  │◄───────│ ModbusService│
  │ /api/devices│ 100ms  │  (Polling)   │
  └─────────────┘        └───────┬──────┘
                                 │ Modbus RTU
                                 │ USB-RS232
                                 ▼
                         ┌───────────────┐
                         │ LS XBC-DN20E  │
                         │  PLC (9600bd) │
                         └───────────────┘
```

### Hardware Configuration
- **PC**
  - UVC Webcam (USB) - Video input for person detection
  - PLC Controller (USB to RS232 adapter) - Device control and monitoring
  - OS: Linux (Docker host) or Windows (WSL2 required)

### Docker Services (docker-compose.yml)
| Service | Technology | Port(s) | Purpose |
|---------|-----------|---------|---------|
| **postgres** | PostgreSQL 16 | 5432 | Data persistence |
| **nest** | NestJS + Node 20 | 3000 | REST API + Modbus polling |
| **detection-service** | Python + YOLOv8 | - | Person detection + RTSP streaming |
| **mediamtx** | Go binary | 8554 (RTSP), 8889 (WebRTC), 8888 (HLS) | RTSP to WebRTC converter |
| **nginx** (optional) | Nginx | 80 | Reverse proxy |
| **s-pavilion-react** (dev) | Next.js | 3001 | Frontend dev server |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- For Windows: WSL2 + Docker Desktop
- (Optional) PLC hardware connected via USB-RS232

### Installation
```bash
# Clone repository
git clone <repository-url>
cd spavilion

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Access web interface
open http://localhost:3000
```

### Development Mode (Local)
```bash
# Terminal 1: Database
docker-compose up -d postgres mediamtx

# Terminal 2: Backend (NestJS)
cd nest
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev

# Terminal 3: Frontend (Next.js)
cd react
pnpm install
pnpm dev

# Terminal 4: Detection Service (Optional - requires camera)
cd detection-service
pip install -r requirements.txt
python main.py
```

---

## Project Structure

```
spavilion/
├── nest/                       # NestJS Backend (Port 3000)
│   ├── src/
│   │   ├── prisma/            # PrismaModule + PrismaService
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── modbus/            # ModbusModule + ModbusService (PLC communication)
│   │   │   ├── modbus.module.ts
│   │   │   └── modbus.service.ts      # 100ms polling, auto-reconnect
│   │   ├── devices/           # DevicesModule + Controller
│   │   │   ├── devices.module.ts
│   │   │   └── devices.controller.ts  # GET /api/devices, POST /api/devices/control
│   │   ├── heatmap/           # HeatmapModule + Controller
│   │   │   ├── heatmap.module.ts
│   │   │   └── heatmap.controller.ts  # GET /api/heatmap?from=&to=
│   │   ├── bbox-history/      # BboxHistoryModule + Controller
│   │   │   ├── bbox-history.module.ts
│   │   │   └── bbox-history.controller.ts  # POST /api/bbox_history
│   │   ├── dto/               # Data Transfer Objects (class-validator)
│   │   │   ├── bbox-history.dto.ts
│   │   │   ├── device-control.dto.ts
│   │   │   ├── heatmap-query.dto.ts
│   │   │   └── device-usage.dto.ts
│   │   ├── app.module.ts      # Root module (imports all feature modules)
│   │   └── main.ts            # Bootstrap (CORS, ValidationPipe)
│   ├── prisma/
│   │   └── schema.prisma      # Database schema (4 models)
│   ├── .env                   # Environment variables
│   ├── package.json           # Node dependencies
│   └── tsconfig.json          # TypeScript config
│
├── react/                      # Next.js 16 Frontend (Port 3000/3001)
│   ├── app/                   # App Router (Next.js 13+)
│   │   └── (dashboard)/       # Dashboard route group
│   ├── components/            # React components
│   │   ├── layout/            # Sidebar, Header, Footer
│   │   ├── dashboard/         # StreamViewer, DevMan, UsageHist
│   │   ├── device/            # TMButton (Timer/Manual button)
│   │   ├── usage/             # Histogram, HeatmapChart, TimeRangeSelector
│   │   ├── ui/                # shadcn/ui components (60+ components)
│   │   └── providers/         # PLCPollingProvider
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-plc-polling.ts # PLC state polling hook
│   │   └── use-toast.ts       # Toast notifications
│   ├── lib/                   # Utilities
│   │   ├── api.ts             # API client (fetch wrapper)
│   │   ├── store.ts           # Zustand global state
│   │   └── webrtc-manager.ts  # WebRTC WHEP protocol implementation
│   ├── public/                # Static assets
│   ├── .env.local             # Environment variables
│   └── package.json           # pnpm dependencies
│
├── detection-service/          # Python YOLOv8 Detection
│   ├── main.py                # cv2.VideoCapture + YOLOv8 inference + GStreamer RTSP
│   ├── requirements.txt       # ultralytics, opencv-python, requests
│   ├── Dockerfile
│   └── .env
│
├── docker-compose.yml         # All services orchestration
├── docker-compose.windows.yml # Windows-specific overrides
├── CLAUDE.md                  # AI assistant project guide
├── README.md                  # This file
└── (other docs)               # WINDOWS-SETUP.md, HARDWARE-TEST.md, etc.
```

---

## Technology Stack

### Backend (NestJS)
- **Runtime**: Node.js 20+
- **Framework**: NestJS 11 (TypeScript, Dependency Injection)
- **Database**: PostgreSQL 16 + Prisma ORM 6
- **Hardware Communication**: modbus-serial (Modbus RTU protocol)
- **Validation**: class-validator, class-transformer
- **Config**: @nestjs/config (dotenv)

### Frontend (Next.js)
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Component Library**: shadcn/ui + Radix UI (60+ accessible components)
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Data Visualization**: D3.js v7
- **Video**: WebRTC (vanilla API, WHEP protocol)
- **Package Manager**: pnpm
- **Fonts**: IBM Plex Sans, JetBrains Mono

### Detection Service (Python)
- **AI Model**: YOLOv8n (Ultralytics)
- **Computer Vision**: OpenCV 4
- **Streaming**: GStreamer (RTSP output)
- **HTTP Client**: requests

### Infrastructure
- **Database**: PostgreSQL 16
- **Streaming Server**: MediaMTX (RTSP/WebRTC/HLS)
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (optional)

---

## Database Schema (Prisma)

### Models

#### 1. BboxHistory (Raw Detection Data)
```prisma
model BboxHistory {
  id         BigInt   @id @default(autoincrement())
  ts         DateTime @default(now()) @db.Timestamptz
  bboxes     Json     // [[x,y,w,h], ...]
  frameCount Int?     @map("frame_count")
  cameraId   String?  @map("camera_id")
}
```
- Stores every detection event from detection-service
- Used for debugging and re-aggregation

#### 2. HeatmapHour (Hourly Aggregated Heatmap)
```prisma
model HeatmapHour {
  hourTs DateTime @db.Timestamptz @map("hour_ts")  // Truncated to hour
  gx     Int      // Grid X coordinate
  gy     Int      // Grid Y coordinate
  hits   BigInt   @default(0)  // Detection count

  @@id([hourTs, gx, gy])
}
```
- Aggregates bounding box centers into grid cells (16×16 pixels default)
- Updated automatically by BboxHistoryController on each POST

#### 3. DeviceUsage (Device Event Log)
```prisma
model DeviceUsage {
  id         BigInt     @id @default(autoincrement())
  ts         DateTime   @default(now()) @db.Timestamptz
  deviceType DeviceKind @map("device_type")
  action     String?    // "ON", "OFF"
  value      Float?     @db.Real  // 0.0 or 1.0
}
```
- Logs every device state change detected by ModbusService polling
- Written automatically every 100ms when state changes

#### 4. DeviceUsageHour (Pre-aggregated Analytics)
```prisma
model DeviceUsageHour {
  hourTs     DateTime   @db.Timestamptz @map("hour_ts")
  deviceType DeviceKind @map("device_type")
  events     BigInt     @default(0)

  @@id([hourTs, deviceType])
}
```
- Optional pre-aggregation for high-frequency analytics queries

#### DeviceKind Enum
```prisma
enum DeviceKind {
  heat
  fan
  btsp
  light_red    @map("light-red")
  light_green  @map("light-green")
  light_blue   @map("light-blue")
  light_white  @map("light-white")
  display
}
```

---

## API Endpoints (NestJS)

Base URL: `http://localhost:3000/api`

### Device Control

#### `GET /api/devices`
Get current PLC device status.

**Response:**
```json
{
  "connected": true,
  "devices": {
    "heat": false,
    "fan": true,
    "btsp": false,
    "light_red": false,
    "light_green": true,
    "light_blue": false,
    "light_white": false,
    "display": true
  }
}
```

#### `POST /api/devices/control`
Control a PLC device.

**Request Body:**
```json
{
  "device_kind": "heat",
  "action": "toggle"  // "toggle" | "on" | "off"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device heat toggle command sent"
}
```

#### `POST /api/devices/usage`
Manually log device usage event.

**Request Body:**
```json
{
  "device_kind": "fan",
  "action": "ON",
  "value": true
}
```

### Detection Data

#### `POST /api/bbox_history`
Submit bounding box detection data (called by detection-service).

**Request Body:**
```json
{
  "bboxes": [[100, 200, 50, 150], [300, 400, 60, 180]],
  "frame_count": 12345,
  "camera_id": "camera-01"
}
```

**Response:**
```json
{
  "success": true,
  "id": "123456789"
}
```

### Analytics

#### `GET /api/heatmap?from=<ISO8601>&to=<ISO8601>`
Fetch heatmap data for time range.

**Query Parameters:**
- `from` (optional): ISO 8601 datetime (default: 24 hours ago)
- `to` (optional): ISO 8601 datetime (default: now)

**Response:**
```json
{
  "from": "2025-10-25T00:00:00.000Z",
  "to": "2025-10-26T00:00:00.000Z",
  "data": [
    {
      "hourTs": "2025-10-26T00:00:00.000Z",
      "gx": 10,
      "gy": 15,
      "hits": 42
    }
  ]
}
```

---

## PLC Configuration (LS XBC-DN20E)

### Hardware Specifications
- **Model**: LS XBC-DN20E (NPN, TR, 24V)
- **Communication**: Modbus RTU via USB-RS232 adapter
- **Serial Port**: `/dev/ttyUSB0` (Linux) or `COM3` (Windows)
- **Baud Rate**: 9600, 8N1 (8 data bits, no parity, 1 stop bit)
- **Timeout**: 1000ms
- **Slave ID**: 1

### Modbus Coil Addresses

#### Status Read (0x00-0x07) - Polled every 100ms
| Address | Device | Description |
|---------|--------|-------------|
| 0x00 | heat_status | Current heat relay state |
| 0x01 | fan_status | Current fan relay state |
| 0x02 | btsp_status | Current BTSP relay state |
| 0x03 | light_red_status | Current red light relay state |
| 0x04 | light_green_status | Current green light relay state |
| 0x05 | light_blue_status | Current blue light relay state |
| 0x06 | light_white_status | Current white light relay state |
| 0x07 | display_status | Current display relay state |

#### Control Write (0x10-0x17) - Written on API request
| Address | Device | Description |
|---------|--------|-------------|
| 0x10 | heat_set | Trigger heat toggle/reset timer |
| 0x11 | fan_set | Trigger fan toggle/reset timer |
| 0x12 | btsp_set | Trigger BTSP toggle/reset timer |
| 0x13 | light_red_set | Trigger red light toggle/reset timer |
| 0x14 | light_green_set | Trigger green light toggle/reset timer |
| 0x15 | light_blue_set | Trigger blue light toggle/reset timer |
| 0x16 | light_white_set | Trigger white light toggle/reset timer |
| 0x17 | display_set | Trigger display toggle |

### Device Timers (PLC Ladder Logic)
| Device | Timer Duration | Auto-off |
|--------|----------------|----------|
| heat | 10 minutes | ✓ |
| fan | 10 minutes | ✓ |
| btsp | 1 hour | ✓ |
| light_red | 1 hour | ✓ |
| light_green | 1 hour | ✓ |
| light_blue | 1 hour | ✓ |
| light_white | 1 hour | ✓ |
| display | Manual | ✗ |

### Control Logic
**Timer-based devices** (heat, fan, btsp, lights):
1. First trigger: Start timer → Turn ON device
2. Second trigger: Stop timer → Turn OFF device
3. Timer expiration: Auto turn OFF device

**Manual devices** (display):
- Toggle ON/OFF with each trigger
- No automatic timeout

---

## Environment Variables

### NestJS Backend (`nest/.env`)
```bash
# Database
DATABASE_URL="postgresql://admin:changeme@localhost:5432/s_pavilion"

# PLC Configuration
PLC_PORT="/dev/ttyUSB0"
PLC_BAUD_RATE=9600
PLC_SLAVE_ID=1

# Application
NODE_ENV=development
PORT=3000
```

### Next.js Frontend (`react/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WEBRTC_URL=http://localhost:8889
```

### Detection Service (`detection-service/.env`)
```bash
API_URL=http://nest:3000
RTSP_URL=rtsp://mediamtx:8554/camera
CAMERA_INDEX=0
CELL_SIZE=16  # Heatmap grid cell size in pixels
```

---

## Development Workflow

### 1. Database Migration
```bash
cd nest

# Create migration after schema.prisma changes
npx prisma migrate dev --name <migration_name>

# Generate Prisma Client (required after schema changes)
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio
```

### 2. Running Tests
```bash
# NestJS unit tests
cd nest
npm run test
npm run test:watch
npm run test:cov

# NestJS e2e tests
npm run test:e2e

# Next.js (if configured)
cd react
pnpm test
```

### 3. Building for Production
```bash
# NestJS
cd nest
npm run build
npm run start:prod

# Next.js
cd react
pnpm build
pnpm start
```

### 4. Docker Rebuild
```bash
# Rebuild specific service
docker-compose up -d --build nest

# Rebuild all services
docker-compose up -d --build

# Clean rebuild (remove volumes)
docker-compose down -v
docker-compose up -d --build
```

---

## Implementation Status

### ✅ Completed
- [x] NestJS backend structure (modules, controllers, services)
- [x] Prisma schema and database models
- [x] ModbusService with 100ms polling and auto-reconnect
- [x] API endpoints (devices, heatmap, bbox_history)
- [x] DTOs with class-validator validation
- [x] CORS configuration for frontend
- [x] Global ValidationPipe
- [x] ConfigModule for environment variables
- [x] Next.js frontend structure (components, hooks, stores)
- [x] shadcn/ui component library integration
- [x] Zustand state management
- [x] WebRTC manager (WHEP protocol)
- [x] D3.js visualizations (heatmap, histogram)

### 🚧 In Progress
- [ ] Frontend-backend integration (API calls)
- [ ] Detection service implementation (YOLOv8 + RTSP)
- [ ] MediaMTX configuration and testing
- [ ] End-to-end testing with real hardware
- [ ] Docker Compose orchestration testing

### 📋 Planned
- [ ] Authentication/Authorization (currently open API)
- [ ] HTTPS/TLS configuration
- [ ] Production deployment guide
- [ ] Performance optimization (database indexes, caching)
- [ ] Error monitoring (Sentry, etc.)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Mobile-responsive UI testing
- [ ] PLC connection status monitoring UI

---

## Troubleshooting

### Camera Not Detected
```bash
# Check camera devices
ls -l /dev/video*

# Test with ffplay
ffplay /dev/video0

# Fix permissions
sudo chmod 666 /dev/video0
```

### PLC Not Responding
```bash
# Check serial port
ls -l /dev/ttyUSB*

# Test with minicom
sudo minicom -D /dev/ttyUSB0 -b 9600

# Verify Docker device mapping in docker-compose.yml
devices:
  - /dev/ttyUSB0:/dev/ttyUSB0
```

### Database Connection Failed
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify DATABASE_URL in nest/.env
DATABASE_URL="postgresql://admin:changeme@postgres:5432/s_pavilion"

# Run migrations
cd nest && npx prisma migrate dev
```

### Port Conflicts
```bash
# Check if ports are in use
lsof -i :3000    # NestJS
lsof -i :3001    # Next.js dev
lsof -i :5432    # PostgreSQL
lsof -i :8554    # RTSP
lsof -i :8889    # WebRTC
```

### WebRTC Not Connecting
```bash
# Check MediaMTX logs
docker-compose logs mediamtx

# Verify RTSP stream
ffplay rtsp://localhost:8554/camera

# Check browser console for WebRTC errors
# Ensure ICE candidates are gathered
```

---

## Security Considerations

⚠️ **WARNING: This is an MVP with NO security features**

- **No Authentication**: API endpoints are completely open
- **No Authorization**: Anyone can control PLC devices
- **No HTTPS/TLS**: All traffic is unencrypted
- **Database Access**: Single admin user with full privileges
- **PLC Control**: Unauthenticated write access to Modbus coils

**Use only in trusted/internal networks or add authentication before deployment.**

---

## Key Files Reference

Quick reference for important files:

| File | Purpose | Location |
|------|---------|----------|
| Database Schema | Prisma models, enums | `nest/prisma/schema.prisma` |
| Modbus Service | PLC communication, polling | `nest/src/modbus/modbus.service.ts:1` |
| Device Controller | API endpoints for devices | `nest/src/devices/devices.controller.ts:1` |
| Heatmap Controller | Heatmap query API | `nest/src/heatmap/heatmap.controller.ts:1` |
| Bbox Controller | Detection data ingestion | `nest/src/bbox-history/bbox-history.controller.ts:1` |
| App Module | NestJS root module | `nest/src/app.module.ts:1` |
| Main Bootstrap | CORS, ValidationPipe | `nest/src/main.ts:1` |
| Zustand Store | Frontend global state | `react/lib/store.ts:1` |
| WebRTC Manager | WHEP protocol client | `react/lib/webrtc-manager.ts:1` |
| API Client | Frontend API wrapper | `react/lib/api.ts:1` |
| Docker Compose | Service orchestration | `docker-compose.yml:1` |

---

## Contributing

1. Read `CLAUDE.md` for AI assistant guidelines
2. Follow TypeScript strict mode conventions
3. Use Prisma migrations for schema changes
4. Write tests for new features
5. Update this README when adding major features

## License

[To be specified]

## Contact

[To be specified]
