# React Frontend project

# Features
- **Camera stream display**: WebRTC live video from mediamtx (vanilla WebRTC API)
- **Device status monitoring**: Real-time display of PLC device states
- **Device control**: Send commands to PLC via NestJS API
- **Bbox history visualization**: Heatmap visualization using D3.js
- **Device usage history**: Histogram visualization using D3.js
- **Responsive design**: Works on PC and mobile browsers
- maybe it could be run on electron. so always consider about the electron compatibility.like, client side rendering(especially for the video streaming, D3.js visualization..)


# Tech Stack
- React 19 typescript
- D3.js (data visualization)
- Vanilla WebRTC API (video streaming)
- tailwindcss
- shadcn/ui
- zustand

# Development
- Development server: `yarn dev`
- Production build: `yarn build` → `/dist` folder served by NestJS

# API Integration
- Backend API: `http://localhost:3000/api/*`
- GET /api/devices - device status
- POST /api/device-control - control devices
- GET /api/heatmap - heatmap data
- WebRTC video: `http://mediamtx:8889/camera/`

# Environment Variables
- `WEBRTC_URL`: MediaMTX WebRTC URL (default: http://localhost:8889)
NEXT_PUBLIC_WEBRTC_URL
# Pages
 - Dashboard
 - DeviceManagement
 - Usage
 - Settings

# thread-kind job
 - plc coil status polling / control service
    - plc status should be updated in real-time, and managed by context api
    - once plc control is requested, send api request to nestjs backend


# Ui
 - style
   - design system: "Modern Minial" as default. or you can use radix-ui design system just in case.
 - DashboardPage (1 page, 10 columns, 2 rows layout)
    - (0,0, colspan: 6) StreamViewer
    - (0,6, colspan: 4) DevMan
    - (1,0, colspan: 10) UsageHist
 - DeviceManagementPage
    - Basic(menu for Device Management)
        - device list
        - device detail
        - device control

    - Advanced(menu for General PLC Debug)
        - device location, port setting
        - device status
            - plc coil status: dense buttons that are placed as 10*100 grid layout like spreadsheet, coil status is displayed as button color. if coil is on, set color to green, otherwise set color to grey. user can set coil value by just clicking the button.
            - register status: dense buttons that are placed as 10*100 grid layout like spreadsheet, user can select display type(decimal, hex) register status is displayed as button color. if register value is not 0, set color to green, otherwise set color to grey. user can set register value by popover(InputPopover). once user click the button, popover is opened.
        - manual control
            - coil, register control
 - UsagePage
    - usage history(heatmap, histogram, with time range selection)

# components
- StreamViewer
    -ToggleGroup(video / heatmap / overlay)
    - video stream(webrtc)
    - bbox heatmap
    - overlay(video stream with heatmap)

 - TMButton(title, isOn, progress)
    Button with toggle and progress indicator
    - progress is 0-100(unit: minutes). is placed at inside bottom of the button.
    - progress is updated by props
    - isOn is updated by prop, if isOn is True, set color to green, otherwise set color to grey

 - InputPopover(title: string, value: string, onChange: (value: string) => void, onConfirm: () => void, onCancel: () => void)
    - address, value (display)
    - toggle button(decimal, hex. user can convert value between decimal and hex)
    - input field
    - confirm button(onConfirm)
    - cancel button(onCancel)

 - DevMan(deviceList: string[])
    - TMButton(title: heat, isOn, progress)
    - TMButton(title: fan, isOn, progress)
    - TMButton(title: btsp, isOn, progress)
    - TMButton(title: light-red, isOn, progress)
    - TMButton(title: light-green, isOn, progress)
    - TMButton(title: light-blue, isOn, progress)
    - TMButton(title: light-white, isOn, progress)

 - TimeRangeSelector
   - ToggleGroup(1h, 6h, 24h, 7d, 30d)(last hour, last 6 hours, last 24 hours, last 7 days, last 30 days)
   - from, to date picker(date-picker)(from: today, to: today, state can be changed by above toggle group)

 - UsageHist
   - flex-row
      - TimeRangeSelector
      - histogram
