# S-Pavilion Host Monitor

Windows host system monitoring service that exposes real hardware metrics to Docker containers.

## Purpose

When S-Pavilion's NestJS backend runs inside Docker, the standard Node.js system APIs (`os` module, `systeminformation`) only see the **container's** resources (limited memory, virtualized CPU), not the actual **Windows host PC** resources.

This lightweight service runs **natively on the Windows host** and exposes a simple HTTP API that the Docker container can call to get real system information.

## Features

- ✅ **Real Windows host metrics**: CPU, RAM, Disk usage
- ✅ **Auto-start on boot**: Installs as Windows Service
- ✅ **Lightweight**: Express HTTP server with minimal overhead
- ✅ **Cross-container access**: CORS enabled for Docker networking
- ✅ **Compatible**: Works with Docker Desktop + WSL2/Hyper-V

## System Requirements

- **Node.js**: ≥18.0.0 (must be installed on Windows host, not just in Docker)
- **Windows**: 10/11 or Windows Server 2019+
- **Administrator access**: Required for Windows Service installation

## Installation

### Step 1: Install Node.js on Windows

If Node.js is not already installed on your Windows host:

1. Download from [nodejs.org](https://nodejs.org/)
2. Install the LTS version (includes npm)
3. Verify: Open PowerShell/CMD and run `node --version`

### Step 2: Install Dependencies

```bash
cd host-monitor
npm install
```

This installs:
- `express`: HTTP server
- `systeminformation`: System metrics library
- `node-windows`: Windows Service installer

### Step 3: Install as Windows Service

**IMPORTANT**: You must run this as Administrator!

```bash
# Right-click PowerShell/Command Prompt → "Run as administrator"
cd C:\path\to\SPavilion\host-monitor
npm run install-service
```

The service will:
- Install as "S-Pavilion Host Monitor"
- Start automatically on Windows boot
- Run on port **9100** (configurable via `PORT` env var)

### Step 4: Verify Installation

1. **Check Windows Services**:
   - Press `Win + R`, type `services.msc`, press Enter
   - Find "S-Pavilion Host Monitor" in the list
   - Status should be **Running**

2. **Test HTTP endpoint**:
   ```bash
   curl http://localhost:9100/health
   curl http://localhost:9100/api/system/info
   ```

   Expected response:
   ```json
   {
     "cpu": {
       "usage": 15.23,
       "cores": 8
     },
     "memory": {
       "total": 17179869184,
       "used": 8589934592,
       "free": 8589934592,
       "percentage": 50.0
     },
     "disk": {
       "total": 512000000000,
       "used": 256000000000,
       "free": 256000000000,
       "percentage": 50.0
     }
   }
   ```

## Configuration

### Changing the Port

Edit `install-service.js` before installation:

```javascript
env: [
  {
    name: 'PORT',
    value: '9100', // Change to your preferred port
  },
],
```

Then reinstall the service.

### Docker Access

The service binds to `0.0.0.0`, making it accessible from Docker containers via:

- **Docker Desktop (WSL2)**: `http://host.docker.internal:9100`
- **Docker Desktop (Hyper-V)**: `http://host.docker.internal:9100`
- **Custom bridge network**: Use Windows host IP (e.g., `http://192.168.1.100:9100`)

## API Endpoints

All endpoints return JSON and support CORS.

### `GET /health`

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-29T12:00:00.000Z"
}
```

### `GET /api/system/info`

Comprehensive system information (CPU + Memory + Disk).

**Response**: See "Verify Installation" section above.

### `GET /api/system/cpu`

CPU-only metrics.

**Response**:
```json
{
  "usage": 15.23,
  "cores": 8
}
```

### `GET /api/system/memory`

Memory-only metrics (bytes).

**Response**:
```json
{
  "total": 17179869184,
  "used": 8589934592,
  "free": 8589934592,
  "percentage": 50.0
}
```

### `GET /api/system/disk`

Disk-only metrics (bytes, aggregated across physical drives).

**Response**:
```json
{
  "total": 512000000000,
  "used": 256000000000,
  "free": 256000000000,
  "percentage": 50.0
}
```

## Uninstalling

To remove the Windows Service:

```bash
# Run as Administrator
npm run uninstall-service
```

This stops and removes the service from Windows Services.

## Troubleshooting

### Service won't install

**Error**: "Access denied" or "Permission required"

**Solution**: Make sure you're running as Administrator:
1. Right-click PowerShell/CMD → "Run as administrator"
2. Navigate to `host-monitor/` directory
3. Run `npm run install-service`

### Service installed but not running

1. Open Services (`services.msc`)
2. Find "S-Pavilion Host Monitor"
3. Right-click → Start
4. Check Event Viewer (Windows Logs → Application) for errors

### Can't access from Docker container

**Issue**: `http://localhost:9100` works on Windows but not from Docker

**Solutions**:
1. Use `http://host.docker.internal:9100` (Docker Desktop feature)
2. Find Windows host IP: `ipconfig` → Use IPv4 address (e.g., `http://192.168.1.100:9100`)
3. Check Windows Firewall: Allow inbound on port 9100

### Wrong metrics displayed

**Issue**: Still seeing Docker container metrics instead of Windows host

**Check**:
1. Verify service is running: `services.msc`
2. Test endpoint: `curl http://localhost:9100/api/system/info`
3. Check NestJS environment variable: `HOST_MONITOR_URL=http://host.docker.internal:9100`
4. Check NestJS logs for connection errors

## Development Mode

For testing without installing as a service:

```bash
# Terminal 1: Run service manually
cd host-monitor
npm start

# Terminal 2: Test endpoints
curl http://localhost:9100/api/system/info
```

Press `Ctrl+C` to stop.

## Integration with NestJS

The NestJS backend (`nest/src/system/system.service.ts`) should be configured to call this service:

1. Set environment variable in `.env`:
   ```env
   HOST_MONITOR_URL=http://host.docker.internal:9100
   ```

2. In `docker-compose.yml`:
   ```yaml
   nest:
     environment:
       - HOST_MONITOR_URL=http://host.docker.internal:9100
   ```

3. SystemService will automatically:
   - Try to fetch from Windows host monitor first
   - Fall back to container metrics if host monitor is unavailable

## Architecture

```
Windows Host PC
    ↓
host-monitor.js (Node.js native process)
    ├→ systeminformation (reads Windows WMI)
    ├→ os module (native Windows APIs)
    └→ Express HTTP server (port 9100)
            ↓
    http://host.docker.internal:9100
            ↓
Docker Container (WSL2 VM)
    └→ NestJS SystemService
        └→ GET /api/system/info
```

## Performance

- **Memory footprint**: ~30-50 MB
- **CPU overhead**: <1% (polling every request, no background loops)
- **Response time**: ~50-100ms per request
- **Network**: Local loopback (no internet required)

## Security Notes

- **No authentication**: This is an MVP service with no auth
- **Local only**: Binds to 0.0.0.0 but should only be accessed via localhost/Docker
- **Production use**: Add authentication middleware if exposing externally
- **Firewall**: Consider restricting port 9100 to localhost only

## License

MIT
