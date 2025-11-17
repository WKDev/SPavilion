const { app, BrowserWindow, Menu, screen, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// 창 설정 파일 경로
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

// 기본 창 설정
const DEFAULT_WINDOW_STATE = {
  width: 1200,
  height: 800,
  x: undefined,
  y: undefined,
  isMaximized: false
};

// 창 상태 로드
function loadWindowState() {
  try {
    if (fs.existsSync(WINDOW_STATE_FILE)) {
      const data = fs.readFileSync(WINDOW_STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      
      // 유효성 검증
      if (validateWindowState(state)) {
        return state;
      }
    }
  } catch (error) {
    console.error('Failed to load window state:', error);
  }
  
  return DEFAULT_WINDOW_STATE;
}

// 창 상태 검증
function validateWindowState(state) {
  if (!state || typeof state !== 'object') {
    return false;
  }

  // 기본값 확인
  if (typeof state.width !== 'number' || state.width < 400) return false;
  if (typeof state.height !== 'number' || state.height < 300) return false;
  
  // 위치가 설정되어 있는 경우 검증
  if (state.x !== undefined || state.y !== undefined) {
    const displays = screen.getAllDisplays();
    const bounds = { x: state.x, y: state.y, width: state.width, height: state.height };
    
    // 창이 최소한 하나의 모니터와 겹치는지 확인
    const isVisible = displays.some(display => {
      const displayBounds = display.bounds;
      return (
        bounds.x + bounds.width > displayBounds.x &&
        bounds.x < displayBounds.x + displayBounds.width &&
        bounds.y + bounds.height > displayBounds.y &&
        bounds.y < displayBounds.y + displayBounds.height
      );
    });
    
    if (!isVisible) {
      return false;
    }
  }
  
  return true;
}

// 창 상태 저장
function saveWindowState(win) {
  try {
    const bounds = win.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: win.isMaximized()
    };
    
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
}

// 창 생성
function createWindow() {
  const windowState = loadWindowState();
  const displays = screen.getAllDisplays();
  
  // 기본 위치 계산 (중앙)
  let x = windowState.x;
  let y = windowState.y;
  
  if (x === undefined || y === undefined) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    x = Math.floor((width - windowState.width) / 2);
    y = Math.floor((height - windowState.height) / 2);
  }
  
  // 아이콘 경로 설정 (파일이 존재하는 경우에만)
  const iconPath = path.join(__dirname, 'favicon.ico');
  const iconOptions = fs.existsSync(iconPath) ? { icon: iconPath } : {};
  
  const win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: x,
    y: y,
    ...iconOptions,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // WebRTC를 HTTP에서 사용하기 위해 필요
      allowRunningInsecureContent: true, // HTTP 콘텐츠 허용
      // Electron 33에서는 experimentalFeatures가 더 이상 필요하지 않음
      // WebRTC는 기본적으로 활성화되어 있음
      // Electron에서 WebRTC 네트워크 스택 활성화
      enableBlinkFeatures: 'WebRTC',
    },
    autoHideMenuBar: true,
    show: false
  });
  
  // 창이 준비되면 표시
  win.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      win.maximize();
    }
    win.show();
  });
  
  // 창이 이동하거나 크기가 변경될 때 저장
  let saveTimer = null;
  const saveWindowStateDebounced = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!win.isMaximized()) {
        saveWindowState(win);
      }
    }, 500);
  };
  
  win.on('resize', saveWindowStateDebounced);
  win.on('move', saveWindowStateDebounced);
  
  win.on('closed', () => {
    saveWindowState(win);
  });
  
  // 개발 모드인지 확인
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // NestJS 프록시를 통해 접근 (포트 3000)
  // NestJS가 /api/*는 직접 처리하고, 나머지는 Next.js(3001)로 프록시
  // 이렇게 하면 개발/프로덕션 모두 상대 경로 /api 사용 가능
  win.loadURL('http://localhost:3000');
  
  // 개발 모드에서 개발자 도구 자동 열기 (WebRTC 디버깅용)
  if (isDev) {
    win.webContents.openDevTools();
  }
  
  return win;
}

// 자동 실행 설정 파일 경로
const AUTO_LAUNCH_FILE = path.join(app.getPath('userData'), 'auto-launch.json');

// 자동 실행 설정 로드
function loadAutoLaunchSetting() {
  try {
    if (fs.existsSync(AUTO_LAUNCH_FILE)) {
      const data = fs.readFileSync(AUTO_LAUNCH_FILE, 'utf8');
      const setting = JSON.parse(data);
      return setting.enabled === true;
    }
  } catch (error) {
    console.error('Failed to load auto-launch setting:', error);
  }
  return false;
}

// 자동 실행 설정 저장
function saveAutoLaunchSetting(enabled) {
  try {
    fs.writeFileSync(AUTO_LAUNCH_FILE, JSON.stringify({ enabled }, null, 2));
  } catch (error) {
    console.error('Failed to save auto-launch setting:', error);
  }
}

// Windows 자동 실행 설정
function setAutoLaunch(enabled) {
  if (process.platform !== 'win32') {
    console.warn('Auto-launch is only supported on Windows');
    saveAutoLaunchSetting(enabled);
    return;
  }
  
  try {
    const Registry = require('winreg');
    const appPath = process.execPath;
    const appName = app.getName();
    
    const key = new Registry({
      hive: Registry.HKCU,
      key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    });
    
    if (enabled) {
      key.set(appName, Registry.REG_SZ, appPath, (err) => {
        if (err) {
          console.error('Failed to set auto-launch:', err);
        } else {
          saveAutoLaunchSetting(enabled);
        }
      });
    } else {
      key.remove(appName, (err) => {
        if (err) {
          console.error('Failed to remove auto-launch:', err);
        } else {
          saveAutoLaunchSetting(enabled);
        }
      });
    }
  } catch (error) {
    console.error('Failed to configure auto-launch:', error);
    saveAutoLaunchSetting(enabled);
  }
}

// WebRTC 및 네트워크 관련 명령줄 스위치 설정
// HTTP 환경에서 WebRTC 사용을 위한 보안 설정 완화
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');

// WebRTC 관련 설정 (Electron 전용)
// WebRTC 명시적 활성화
app.commandLine.appendSwitch('enable-webrtc');
// WebRTC ICE 후보 수집 개선
app.commandLine.appendSwitch('enable-features', 'WebRTC-H264WithOpenH264FFmpeg');
// WebRTC IP 처리 정책 설정 (내부망 통신 허용)
// 'default_public_interface_only' 대신 'default'를 사용하여 모든 인터페이스 허용
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default');
// UDP 포트 범위 설정 (방화벽 문제 해결)
app.commandLine.appendSwitch('webrtc-stun-probe-trial-parameter', '1');
// 내부망 통신을 위한 네트워크 정책 설정
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
// WebRTC 로깅 활성화 (디버깅용)
app.commandLine.appendSwitch('enable-logging');
app.commandLine.appendSwitch('vmodule', 'webrtc*=1');

// Windows 방화벽 규칙 추가 함수 (UDP 통신 허용)
function addFirewallRule() {
  if (process.platform !== 'win32') {
    return; // Windows가 아니면 실행하지 않음
  }

  try {
    const appPath = process.execPath;
    const appName = app.getName();
    const isDev = !app.isPackaged;
    
    // 개발 모드에서는 Electron 실행 파일에 대한 규칙 추가
    // 프로덕션 모드에서는 패키지된 앱 경로 사용
    const targetPath = isDev ? appPath : appPath;
    
    console.log(`[Firewall] Attempting to add firewall rules for: ${targetPath}`);
    console.log(`[Firewall] App name: ${appName}, Is packaged: ${!isDev}`);
    
    // UDP 인바운드/아웃바운드 규칙 추가
    const rules = [
      { name: `${appName} UDP Inbound`, dir: 'in', protocol: 'UDP' },
      { name: `${appName} UDP Outbound`, dir: 'out', protocol: 'UDP' },
      { name: `${appName} TCP Inbound`, dir: 'in', protocol: 'TCP' },
      { name: `${appName} TCP Outbound`, dir: 'out', protocol: 'TCP' }
    ];
    
    rules.forEach((rule) => {
      const checkCmd = `netsh advfirewall firewall show rule name="${rule.name}"`;
      const addCmd = `netsh advfirewall firewall add rule name="${rule.name}" dir=${rule.dir} action=allow program="${targetPath}" protocol=${rule.protocol} enable=yes`;
      
      exec(checkCmd, (error) => {
        if (error) {
          // 규칙이 없으면 추가 시도
          exec(addCmd, (err, stdout, stderr) => {
            if (err) {
              console.warn(`[Firewall] Failed to add ${rule.name} (may require admin):`, err.message);
              console.warn(`[Firewall] Command: ${addCmd}`);
              console.warn(`[Firewall] To add manually, run PowerShell as Administrator and execute:`);
              console.warn(`[Firewall] ${addCmd}`);
            } else {
              console.log(`[Firewall] ✓ ${rule.name} added successfully`);
            }
          });
        } else {
          console.log(`[Firewall] ✓ ${rule.name} already exists`);
        }
      });
    });
    
    // 개발 모드에서 추가 안내
    if (isDev) {
      console.log('\n[Firewall] ============================================');
      console.log('[Firewall] Development Mode - Firewall Rules');
      console.log('[Firewall] ============================================');
      console.log('[Firewall] If firewall rules failed to add, run PowerShell as Administrator:');
      console.log(`[Firewall] netsh advfirewall firewall add rule name="${appName} UDP Inbound" dir=in action=allow program="${targetPath}" protocol=UDP enable=yes`);
      console.log(`[Firewall] netsh advfirewall firewall add rule name="${appName} UDP Outbound" dir=out action=allow program="${targetPath}" protocol=UDP enable=yes`);
      console.log(`[Firewall] netsh advfirewall firewall add rule name="${appName} TCP Inbound" dir=in action=allow program="${targetPath}" protocol=TCP enable=yes`);
      console.log(`[Firewall] netsh advfirewall firewall add rule name="${appName} TCP Outbound" dir=out action=allow program="${targetPath}" protocol=TCP enable=yes`);
      console.log('[Firewall] ============================================\n');
    }
  } catch (error) {
    console.warn('[Firewall] Failed to configure firewall rules:', error.message);
    console.warn('[Firewall] You may need to manually add firewall rules or run as administrator');
  }
}

// 앱이 준비되면
app.whenReady().then(() => {
  // Windows 방화벽 규칙 추가 시도 (관리자 권한이 필요할 수 있음)
  addFirewallRule();
  
  // WebRTC 권한 설정
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // WebRTC 관련 권한 허용
    const allowedPermissions = ['media', 'camera', 'microphone', 'display-capture'];
    if (allowedPermissions.includes(permission)) {
      console.log(`[WebRTC] Permission granted: ${permission}`);
      callback(true);
    } else {
      console.log(`[WebRTC] Permission denied: ${permission}`);
      callback(false);
    }
  });

  // CORS 및 WebRTC 관련 헤더 설정
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Access-Control-Allow-Origin': ['*'],
      'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      'Access-Control-Allow-Headers': ['Content-Type', 'Authorization', 'Accept'],
      'Access-Control-Expose-Headers': ['Content-Length', 'Content-Type']
    };
    
    // WebRTC 관련 엔드포인트에 대한 추가 헤더
    if (details.url.includes('/whep') || details.url.includes('/webrtc')) {
      responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
    }
    
    callback({ responseHeaders });
  });

  // 초기 자동 실행 설정 로드 및 적용
  const autoLaunchEnabled = loadAutoLaunchSetting();
  if (autoLaunchEnabled) {
    setAutoLaunch(true);
  }
  
  // 메뉴 생성
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '자동 시작',
          type: 'checkbox',
          checked: autoLaunchEnabled,
          click: (menuItem) => {
            setAutoLaunch(menuItem.checked);
          }
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '보기',
      submenu: [
        {
          label: '새로고침',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          }
        },
        {
          label: '강제 새로고침',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        { type: 'separator' },
        {
          label: '개발자 도구',
          accelerator: 'F12',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 핸들러
ipcMain.handle('get-auto-launch', () => {
  return loadAutoLaunchSetting();
});

ipcMain.handle('set-auto-launch', (event, enabled) => {
  setAutoLaunch(enabled);
  return enabled;
});

