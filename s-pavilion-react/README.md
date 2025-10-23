# React Frontend (S-Pavilion)

# Features
- **Camera stream display**: WebRTC live video from mediamtx (vanilla WebRTC API)
- **Device status monitoring**: Real-time display of PLC device states
- **Device control**: Send commands to PLC via NestJS API
- **Bbox history visualization**: Heatmap visualization using D3.js
- **Device usage history**: Histogram visualization using D3.js
- **Responsive design**: Works on PC and mobile browsers
- Future: May run inside Electron

# Tech Stack
- React 19
- Vite (build tool)
- D3.js (data visualization)
- Vanilla WebRTC API (video streaming)

# Development
- Development server: `npm run dev` (default port: 5173)
- Production build: `npm run build` → `/dist` folder served by NestJS

# API Integration
- Backend API: `http://localhost:3000/api/*`
- GET /api/devices - device status
- POST /api/device-control - control devices
- GET /api/heatmap - heatmap data
- WebRTC video: `http://mediamtx:8889/camera/`

# Environment Variables
- `VITE_API_URL`: Backend API URL (default: http://localhost:3000)
- `VITE_WEBRTC_URL`: MediaMTX WebRTC URL (default: http://localhost:8889)