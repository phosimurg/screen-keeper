const { app, BrowserWindow, ipcMain, systemPreferences, shell, Tray, Menu } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const cron = require('node-cron');
const Store = require('electron-store');

const store = new Store();
let mainWindow;
let tray = null;
let automationJob = null;
let dailyJob = null;
let isAutomationRunning = false;

// Platform-specific icon path function
function getIconPath() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    // Development mode - use src/assets
    if (process.platform === 'win32') {
      return path.join(__dirname, '../src/assets/icon.ico');
    } else if (process.platform === 'darwin') {
      return path.join(__dirname, '../src/assets/icon.icns');
    } else {
      return path.join(__dirname, '../src/assets/icon.png');
    }
  } else {
    // Production mode - use resources
    if (process.platform === 'win32') {
      return path.join(process.resourcesPath, 'src/assets/icon.ico');
    } else if (process.platform === 'darwin') {
      return path.join(process.resourcesPath, 'src/assets/icon.icns');
    } else {
      return path.join(process.resourcesPath, 'src/assets/icon.png');
    }
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 750,
    resizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: getIconPath(),
    titleBarStyle: 'default',
    title: 'Screen Keeper'
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // DevTools sadece development modunda açılsın
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    // Production modunda doğru path kullan
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

function createTray() {
  const iconPath = getIconPath();
  tray = new Tray(iconPath);
  
  updateTrayMenu();
  tray.setToolTip('Screen Keeper');
  
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      label: `Automation: ${isAutomationRunning ? 'Running' : 'Stopped'}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

function setupDailyJob(startTime, settings) {
  if (dailyJob) {
    dailyJob.stop();
  }
  
  const [hours, minutes] = startTime.split(':').map(Number);
  
  // Cron expression for daily execution at specific time
  const cronExpression = `${minutes} ${hours} * * *`;
  
  dailyJob = cron.schedule(cronExpression, () => {
    console.log('Daily auto-start triggered at', new Date().toISOString());
    
    // Start automation with saved settings
    if (automationJob) {
      automationJob.stop();
    }

    const intervalSeconds = Math.max(settings.interval || 60, 10);
    
    automationJob = cron.schedule(`*/${intervalSeconds} * * * * *`, () => {
      const now = new Date();
      let shouldPerformAction = true;
      
      if (settings.useTimeRestriction) {
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                           now.getMinutes().toString().padStart(2, '0');
        shouldPerformAction = currentTime >= settings.startTime && currentTime <= settings.endTime;
      }
      
      if (shouldPerformAction) {
        performAction(settings.actionType || 'mouse', settings.key);
        if (mainWindow) {
          mainWindow.webContents.send('automation-tick', {
            timestamp: now.toISOString(),
            action: settings.actionType || 'mouse',
            key: settings.key
          });
        }
      }
    }, {
      scheduled: false
    });

    automationJob.start();
    isAutomationRunning = true;
    updateTrayMenu();
    
    if (mainWindow) {
      mainWindow.webContents.send('daily-automation-started', {
        timestamp: new Date().toISOString(),
        startTime: startTime
      });
    }
  }, {
    scheduled: false
  });

  dailyJob.start();
  console.log(`Daily job scheduled for ${startTime} (${cronExpression})`);
}

const checkPermissions = async () => {
  if (process.platform === 'darwin') {
    const accessibilityPermission = systemPreferences.isTrustedAccessibilityClient(false);
    if (!accessibilityPermission) {
      return {
        hasPermission: false,
        message: 'Accessibility permission is required to control mouse and keyboard. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility.'
      };
    }
  }
  return { hasPermission: true };
};

// Cross-platform automation functions
const getMousePosition = () => {
  try {
    if (process.platform === 'darwin') {
      // macOS: Use AppleScript to get mouse position
      const result = execSync(`osascript -e 'tell application "System Events" to return (get position of mouse)'`).toString().trim();
      const [x, y] = result.split(', ').map(Number);
      return { x, y };
    } else if (process.platform === 'win32') {
      // Windows: Use PowerShell to get cursor position
      const result = execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; $p = [System.Windows.Forms.Cursor]::Position; Write-Output \"$($p.X),$($p.Y)\""`).toString().trim();
      const [x, y] = result.split(',').map(Number);
      return { x, y };
    } else {
      // Linux: Use xdotool
      const result = execSync('xdotool getmouselocation --shell').toString();
      const x = parseInt(result.match(/X=(\d+)/)[1]);
      const y = parseInt(result.match(/Y=(\d+)/)[1]);
      return { x, y };
    }
  } catch (error) {
    console.error('Error getting mouse position:', error);
    return { x: 100, y: 100 }; // fallback position
  }
};

const moveMouse = (x, y) => {
  try {
    if (process.platform === 'darwin') {
      // macOS: Use AppleScript to move mouse
      execSync(`osascript -e 'tell application "System Events" to set the position of the mouse to {${x}, ${y}}'`);
    } else if (process.platform === 'win32') {
      // Windows: Use PowerShell to move cursor
      execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`);
    } else {
      // Linux: Use xdotool
      execSync(`xdotool mousemove ${x} ${y}`);
    }
  } catch (error) {
    console.error('Error moving mouse:', error);
  }
};

const pressKey = (key) => {
  try {
    if (process.platform === 'darwin') {
      // macOS: Use AppleScript to press key
      let keyCode = key;
      if (key === 'space') keyCode = 'space';
      else if (key === 'ctrl') keyCode = 'control down';
      else if (key === 'shift') keyCode = 'shift down';
      
      execSync(`osascript -e 'tell application "System Events" to key code 49'`); // space key code
    } else if (process.platform === 'win32') {
      // Windows: Use PowerShell with SendKeys
      let keyToSend = key;
      if (key === 'space') keyToSend = ' ';
      else if (key === 'ctrl') keyToSend = '^';
      else if (key === 'shift') keyToSend = '+';
      
      execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keyToSend}')"`);
    } else {
      // Linux: Use xdotool
      execSync(`xdotool key ${key}`);
    }
  } catch (error) {
    console.error('Error pressing key:', error);
  }
};

const performAction = (actionType, key = null) => {
  try {
    if (actionType === 'mouse') {
      const currentPos = getMousePosition();
      // Daha belirgin hareket: 10 piksel move et, sonra geri getir
      moveMouse(currentPos.x + 10, currentPos.y + 10);
      // Kısa bir bekleme sonrası geri getir
      setTimeout(() => {
        moveMouse(currentPos.x, currentPos.y);
      }, 100);
    } else if (actionType === 'keyboard' && key) {
      pressKey(key);
    }
  } catch (error) {
    console.error('Error performing action:', error);
    if (mainWindow) {
      mainWindow.webContents.send('automation-error', error.message);
    }
  }
};

app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // Check if auto-startup is enabled and setup daily job if needed
  const settings = store.get('settings', {});
  if (settings.dailyAutoStart && settings.dailyStartTime) {
    setupDailyJob(settings.dailyStartTime, settings);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit on macOS, just hide to tray
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  if (automationJob) {
    automationJob.stop();
  }
  if (dailyJob) {
    dailyJob.stop();
  }
});

// IPC Handlers
ipcMain.handle('check-permissions', checkPermissions);

ipcMain.handle('get-settings', () => {
  return store.get('settings', {
    actionType: 'mouse',
    key: 'space',
    interval: 60,
    startTime: '09:00',
    endTime: '17:00',
    enabled: false,
    useTimeRestriction: false,
    dailyAutoStart: false,
    dailyStartTime: '09:00',
    autoStartup: false
  });
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);
  return true;
});

ipcMain.handle('start-automation', (event, settings) => {
  try {
    if (automationJob) {
      automationJob.stop();
    }

    const intervalSeconds = Math.max(settings.interval, 10); // Minimum 10 seconds
    
    automationJob = cron.schedule(`*/${intervalSeconds} * * * * *`, () => {
      const now = new Date();
      let shouldPerformAction = true;
      
      // Eğer zaman kısıtlaması aktifse, zaman kontrolü yap
      if (settings.useTimeRestriction) {
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                           now.getMinutes().toString().padStart(2, '0');
        shouldPerformAction = currentTime >= settings.startTime && currentTime <= settings.endTime;
      }
      
      if (shouldPerformAction) {
        performAction(settings.actionType, settings.key);
        mainWindow.webContents.send('automation-tick', {
          timestamp: now.toISOString(),
          action: settings.actionType,
          key: settings.key
        });
      }
    }, {
      scheduled: false
    });

    automationJob.start();
    isAutomationRunning = true;
    updateTrayMenu();
    
    return { success: true, message: 'Automation started successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('stop-automation', () => {
  try {
    if (automationJob) {
      automationJob.stop();
      automationJob = null;
    }
    isAutomationRunning = false;
    updateTrayMenu();
    return { success: true, message: 'Automation stopped successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-automation-status', () => {
  return { isRunning: isAutomationRunning };
});

ipcMain.handle('open-accessibility-settings', async () => {
  try {
    if (process.platform === 'darwin') {
      // Open macOS System Preferences > Security & Privacy > Privacy > Accessibility
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
      return { success: true };
    }
    return { success: false, message: 'Not supported on this platform' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('setup-daily-schedule', (event, enabled, startTime, settings) => {
  try {
    if (enabled && startTime) {
      setupDailyJob(startTime, settings);
      return { success: true, message: `Daily schedule set for ${startTime}` };
    } else {
      if (dailyJob) {
        dailyJob.stop();
        dailyJob = null;
      }
      return { success: true, message: 'Daily schedule disabled' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('setup-auto-startup', async (event, enabled) => {
  try {
    if (enabled) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        name: 'Screen Keeper'
      });
      return { success: true, message: 'Auto-startup enabled' };
    } else {
      app.setLoginItemSettings({
        openAtLogin: false
      });
      return { success: true, message: 'Auto-startup disabled' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-auto-startup-status', () => {
  return app.getLoginItemSettings().openAtLogin;
}); 