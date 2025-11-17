const { app, BrowserWindow, Menu, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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
      contextIsolation: true
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
  
  // Option 2: Next.js를 별도 포트(3001)에서 실행하고 NestJS(3000)에서 프록시
  // 프로덕션 모드에서는 NestJS 프록시를 통해 접근 (포트 3000)
  // 개발 모드에서는 Next.js에 직접 접근 (포트 3001)
  if (isDev) {
    win.loadURL('http://localhost:3001');
    // 개발자 도구 열기 (선택사항)
    // win.webContents.openDevTools();
  } else {
    // 프로덕션: NestJS 프록시 서버를 통해 접근 (포트 3000)
    // NestJS가 Next.js(3001)로 프록시하므로 포트 3000 사용
    win.loadURL('http://localhost:3000');
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

// 앱이 준비되면
app.whenReady().then(() => {
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

