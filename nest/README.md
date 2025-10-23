# NestJS Backend API Guide

# Prerequisites
- Use Prisma as ORM
- Use modbus-serial to communicate with PLC (modbus-service.ts)
- Use TypeScript

# Features
- Device status monitoring
- Device control (command send to PLC)
- Bbox history logging (add item to bbox_history table)
- Heatmap hour aggregation (add/update heatmap_hour table)
- Device usage logging (add item to device_usage table)

# Workers
- modbus-service.ts
    - Communicates with PLC using modbus protocol (RS232 via /dev/ttyUSB0)
    - Gets device status from PLC periodically (every 0.1s)
    - Sends commands to PLC when requested
    - Logs device state changes to device_usage table

# API Endpoints

## GET Endpoints
- **GET /** : Root, serves React static files (production build)
- **GET /api/devices** : Get all device status
  ```json
  {
    "heat_status": true,
    "fan_status": false,
    "btsp_status": true,
    "light_red_status": false,
    "light_green_status": true,
    "light_blue_status": false,
    "light_white_status": false,
    "display_status": true
  }
  ```
- **GET /api/heatmap** : Get heatmap data for specified time range
  - Query params: `from` (TIMESTAMPTZ), `to` (TIMESTAMPTZ)
  - Example: `/api/heatmap?from=2025-10-23T10:00:00+09:00&to=2025-10-23T13:00:00+09:00`
  - Response:
  ```json
  [
    {"gx": 12, "gy": 7, "hits": 35},
    {"gx": 13, "gy": 7, "hits": 22}
  ]
  ```

## POST Endpoints
- **POST /api/bbox_history** : Submit bbox array (raw data for debugging)
  ```json
  {
    "ts": "2025-10-23T10:12:34.567+09:00",
    "bboxes": [[100,220,60,140],[420,200,70,160]],
    "frame_count": 12345
  }
  ```
  - Also triggers heatmap_hour aggregation internally

- **POST /api/device-usage** : Submit device usage event
  ```json
  {
    "device_type": "heat",
    "action": "on",
    "value": 1.0
  }
  ```

- **POST /api/device-control** : Send device control command to PLC
  ```json
  {
    "target": "heat"
  }
  ```
  - Target can be: heat, fan, btsp, light-red, light-green, light-blue, light-white, display
  - Toggles the device state

# Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `PLC_PORT`: Serial port for PLC (default: /dev/ttyUSB0)
- `PLC_BAUD_RATE`: Baud rate (default: 9600)
- `NODE_ENV`: Environment mode (development/production)

