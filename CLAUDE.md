# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

S-Pavilion is a hardware monitoring system combining PLC device control, real-time YOLOv8 person detection, WebRTC video streaming, and data visualization. This is an MVP project with no production/development environment separation.

**Current Status**: Project is in initial setup phase. Core infrastructure and service scaffolding exist, but implementation of features is incomplete.

## System Architecture

```
UVC Camera (USB) → detection-service (Python/YOLOv8) → MediaMTX → WebRTC → React Frontend
                           ↓
                    POST /api/bbox_history
                           ↓
PLC (USB-RS232) → NestJS Backend (Modbus + REST API) ← PostgreSQL
```

**Data Flow**:
- Detection service captures video, runs YOLOv8, streams RTSP to MediaMTX, posts detection data to NestJS
- NestJS polls PLC every 0.1s via Modbus RTU, logs device state changes to PostgreSQL
- React frontend fetches device status, displays WebRTC stream, visualizes heatmaps (D3.js)
- MediaMTX converts RTSP to WebRTC (port 8889) and HLS (port 8888)

## Technology Stack

- **Backend**: NestJS (Node.js ≥20), Prisma ORM, modbus-serial
- **Frontend**: React 19, Vite, D3.js, vanilla WebRTC API
- **Detection**: Python, YOLOv8n (ultralytics), OpenCV, GStreamer
- **Infrastructure**: PostgreSQL, MediaMTX, Docker Compose, Nginx (optional)

## Common Commands

### Development Setup

```bash
# First time setup
docker-compose up -d postgres mediamtx
cd nest && npm install
cd ../s-pavilion-react && npm install
cd ../detection-service && pip install -r requirements.txt

# Run Prisma migrations (after schema is created)
cd nest
npx prisma migrate dev
npx prisma generate

# Development mode (run each in separate terminal)
cd nest && npm run start:dev              # NestJS on port 3000
cd s-pavilion-react && npm run dev        # React on port 5173
python detection-service/main.py          # Detection service
```

### Building and Testing

```bash
# NestJS
cd nest
npm run build                 # Build for production
npm run lint                  # Run ESLint
npm run test                  # Run unit tests
npm run test:watch            # Watch mode
npm run test:cov              # With coverage
npm run test:e2e              # End-to-end tests

# React
cd s-pavilion-react
npm run build                 # Build for production (outputs to dist/)
npm run lint                  # Run ESLint
npm run preview               # Preview production build

# Build React and serve via NestJS (production mode)
cd s-pavilion-react && npm run build
cp -r dist/* ../nest/public/
cd ../nest && npm run build && npm run start:prod
```

### Docker Operations

```bash
# Start all services
docker-compose up -d

# Start with Nginx reverse proxy
docker-compose --profile with-nginx up -d

# Start with React dev server
docker-compose --profile development up -d

# View logs
docker-compose logs -f
docker-compose logs -f nest              # Specific service
docker-compose logs -f detection-service

# Restart a service
docker-compose restart nest

# Rebuild after code changes
docker-compose up -d --build nest

# Run Prisma migrations in container
docker-compose exec nest npx prisma migrate dev

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

### Hardware Debugging

```bash
# Check camera device
ls -l /dev/video*
v4l2-ctl --list-devices
ffplay /dev/video0                       # Test camera

# Check PLC serial port
ls -l /dev/ttyUSB*
sudo minicom -D /dev/ttyUSB0 -b 9600     # Test serial connection

# Test RTSP stream
ffplay rtsp://localhost:8554/camera

# Check if ports are in use
lsof -i :3000    # NestJS
lsof -i :5173    # Vite
lsof -i :8554    # RTSP
lsof -i :8889    # WebRTC
```

## Database Schema

**Tables** (defined in `nest/prisma/schema.prisma`):

- `bbox_history`: Raw bounding box data from detection service
  - id (int), ts (DateTime), bboxes (Json), frame_count (int), camera_id (string)

- `heatmap_hour`: Aggregated hourly person detection heatmap
  - hour_ts (DateTime), gx (int), gy (int), hits (int)
  - Primary Key: (hour_ts, gx, gy)

- `device_usage`: Device event log from PLC
  - id (int), ts (DateTime), device_kind (Enum), action (string), value (boolean)

- `device_usage_hour`: Pre-aggregated hourly device usage stats (optional)

**device_kind ENUM**: heat, fan, btsp, light-red, light-green, light-blue, light-white, display

## API Endpoints (NestJS)

All endpoints are prefixed with `/api` except the root serving static files.

- `GET /` - Serve React static files (production)
- `GET /api/devices` - Get current device status from PLC
- `GET /api/heatmap?from=<ISO8601>&to=<ISO8601>` - Get heatmap data
- `POST /api/bbox_history` - Log bounding box data (called by detection service)
  - Body: `{ bboxes: [[x, y, w, h], ...], frame_count: number, camera_id: string }`
- `POST /api/device-usage` - Log device usage event
  - Body: `{ device_kind: string, action: string, value: boolean }`
- `POST /api/device-control` - Control PLC device
  - Body: `{ device_kind: string, action: "toggle" }`

## PLC Configuration (LS XBC-DN20E)

**Connection**: USB-RS232 → /dev/ttyUSB0, Modbus RTU, 9600 baud, 8N1

**Modbus Coil Addresses**:
- **Status Read (0x00-0x07)**: heat_status, fan_status, btsp_status, light_red_status, light_green_status, light_blue_status, light_white_status, display_status
- **Control Write (0x10-0x17)**: heat_set, fan_set, btsp_set, light_red_set, light_green_set, light_blue_set, light_white_set, display_set

**Device Timers**:
- heat, fan: 10 minutes auto-off
- btsp, lights (red/green/blue/white): 1 hour auto-off
- display: Manual toggle (no timer)

**Control Logic**: Timer-based devices toggle on first trigger (start timer), toggle off on second trigger (stop timer) or auto-off on timer expiration. Manual devices simply toggle state.

## Implementation Notes

### NestJS Backend Architecture

- Use dependency injection for services (Modbus service, database access)
- Create DTOs for request/response validation (`class-validator`, `class-transformer`)
- Implement modbus-service.ts with:
  - Connection to /dev/ttyUSB0 via modbus-serial
  - Polling loop reading coils 0x00-0x07 every 0.1s
  - State change detection and logging to device_usage table
  - Write methods for coils 0x10-0x17
- Controllers should be thin, business logic in services
- Enable CORS for development (React on different port)

### Prisma Workflow

```bash
# Create/modify schema
vim nest/prisma/schema.prisma

# Create migration
npx prisma migrate dev --name <migration_name>

# Generate Prisma Client (required after schema changes)
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio
```

### Detection Service Implementation

- Use cv2.VideoCapture(0) for camera (configurable via CAMERA_INDEX env var)
- Load YOLOv8n model: `model = YOLO('yolov8n.pt')`
- Filter detections for class 0 (person) only
- Draw bounding boxes on frames before streaming
- Use GStreamer pipeline to push RTSP: `rtsp://mediamtx:8554/camera`
- POST bbox data to NestJS every N frames (e.g., every 30 frames = ~1 per second at 30fps)
- Handle reconnection logic for both API and RTSP stream
- Grid size for heatmap: CELL_SIZE=32 (configurable)

### React Frontend Architecture

- WebRTC connection to `http://localhost:8889/<stream>/whep` (MediaMTX WHEP protocol)
- Poll `/api/devices` every 1-2 seconds for device status
- D3.js for heatmap: create SVG grid based on CELL_SIZE, color cells by hit count
- D3.js for histogram: time-series bar chart of device usage
- Device control buttons call `POST /api/device-control`
- Handle WebRTC reconnection on network issues
- Responsive layout: stacked on mobile, side-by-side on desktop

### Environment Variables

**NestJS** (`nest/.env`):
```
DATABASE_URL=postgresql://admin:changeme@postgres:5432/s_pavilion
PLC_PORT=/dev/ttyUSB0
PLC_BAUD_RATE=9600
NODE_ENV=production
```

**React** (`s-pavilion-react/.env`):
```
VITE_API_URL=http://localhost:3000
VITE_WEBRTC_URL=http://localhost:8889
```

**Detection Service** (`detection-service/.env`):
```
API_URL=http://nest:3000
RTSP_URL=rtsp://mediamtx:8554/camera
CAMERA_INDEX=0
CELL_SIZE=32
```

## Code Style Conventions

- **TypeScript/NestJS**: Strict mode, use async/await, DTOs for validation, dependency injection
- **Python**: Type hints, PEP 8, error handling for camera/network failures
- **React**: Functional components with hooks, custom hooks for API/WebRTC, PropTypes or TS interfaces

## Troubleshooting

**Camera not detected**: Check `ls /dev/video*`, fix permissions `sudo chmod 666 /dev/video0`, verify Docker device mapping in docker-compose.yml

**PLC not responding**: Check `ls /dev/ttyUSB*`, test with minicom, verify privileged mode in docker-compose.yml

**WebRTC not connecting**: Check mediamtx logs, verify RTSP stream with ffplay, check browser console for WebRTC errors, ensure ICE candidates are gathered

**Database connection failed**: Check postgres logs, verify DATABASE_URL, run Prisma migrations

**Port conflicts**: Check if ports 3000, 5173, 5432, 8554, 8888, 8889 are in use

## Security Considerations

- **No authentication**: This MVP has no user auth, API is open
- **No HTTPS/TLS**: All traffic is unencrypted
- **PLC control is unauthenticated**: Anyone with network access can control devices
- **Database has no user roles**: Single admin user for all operations
- **Use only in trusted/internal networks**

## Adding Features

**Add new device type**:
1. Update `device_kind` enum in Prisma schema
2. Run `npx prisma migrate dev`
3. Add Modbus address mapping in modbus-service.ts
4. Update PLC ladder logic
5. Add to React UI device list

**Modify heatmap resolution**:
1. Change CELL_SIZE in detection-service
2. Update grid rendering in React D3.js code
3. No database changes needed (gx, gy adapt automatically)

**Add new API endpoint**:
1. Create controller method in NestJS
2. Add service method for business logic
3. Update React to consume new endpoint

## References

- NestJS: https://docs.nestjs.com/
- Prisma: https://www.prisma.io/docs
- Ultralytics YOLOv8: https://docs.ultralytics.com/
- MediaMTX: https://github.com/bluenviron/mediamtx
- Modbus RTU: https://modbus.org/
