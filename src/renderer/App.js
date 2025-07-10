import React, { useState, useEffect } from 'react';
const { ipcRenderer } = window.require('electron');

const App = () => {
  const [settings, setSettings] = useState({
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
  
  const [isRunning, setIsRunning] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [lastAction, setLastAction] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [autoStartupEnabled, setAutoStartupEnabled] = useState(false);
  const [dailyScheduleStatus, setDailyScheduleStatus] = useState('');

  const keyOptions = [
    { value: 'space', label: 'Space' },
    { value: 'shift', label: 'Shift' },
    { value: 'f15', label: 'F15' },
    { value: 'f16', label: 'F16' },
    { value: 'f17', label: 'F17' },
    { value: 'f18', label: 'F18' }
  ];

  useEffect(() => {
    loadSettings();
    checkPermissions();
    checkAutomationStatus();
    checkAutoStartupStatus();

    // Listen for automation events
    ipcRenderer.on('automation-tick', (event, data) => {
      setLastAction(data);
      setStatus('Active');
    });

    ipcRenderer.on('automation-error', (event, error) => {
      setStatus(`Error: ${error}`);
    });

    ipcRenderer.on('daily-automation-started', (event, data) => {
      setStatus('Daily automation started');
      setIsRunning(true);
      setDailyScheduleStatus(`Auto-started at ${data.startTime}`);
    });

    return () => {
      ipcRenderer.removeAllListeners('automation-tick');
      ipcRenderer.removeAllListeners('automation-error');
      ipcRenderer.removeAllListeners('daily-automation-started');
    };
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await ipcRenderer.invoke('get-settings');
      setSettings(savedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const result = await ipcRenderer.invoke('check-permissions');
      setHasPermission(result.hasPermission);
      if (!result.hasPermission) {
        setPermissionMessage(result.message);
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    }
  };

  const checkAutomationStatus = async () => {
    try {
      const result = await ipcRenderer.invoke('get-automation-status');
      setIsRunning(result.isRunning);
      setStatus(result.isRunning ? 'Running' : 'Stopped');
    } catch (error) {
      console.error('Failed to check automation status:', error);
    }
  };

  const checkAutoStartupStatus = async () => {
    try {
      const enabled = await ipcRenderer.invoke('get-auto-startup-status');
      setAutoStartupEnabled(enabled);
    } catch (error) {
      console.error('Failed to check auto-startup status:', error);
    }
  };

  const openAccessibilitySettings = async () => {
    try {
      const result = await ipcRenderer.invoke('open-accessibility-settings');
      if (result.success) {
        setStatus('System Preferences opened. Please grant accessibility permission.');
      } else {
        setStatus('Failed to open settings: ' + result.message);
      }
    } catch (error) {
      setStatus('Error opening settings: ' + error.message);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await ipcRenderer.invoke('save-settings', newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);

    // Handle daily schedule setup when relevant settings change
    if (key === 'dailyAutoStart' || key === 'dailyStartTime') {
      setupDailySchedule(newSettings);
    }
  };

  const setupDailySchedule = async (currentSettings) => {
    try {
      const result = await ipcRenderer.invoke(
        'setup-daily-schedule', 
        currentSettings.dailyAutoStart, 
        currentSettings.dailyStartTime,
        currentSettings
      );
      if (result.success) {
        setDailyScheduleStatus(result.message);
      } else {
        setDailyScheduleStatus(`Error: ${result.message}`);
      }
    } catch (error) {
      setDailyScheduleStatus(`Error: ${error.message}`);
    }
  };

  const toggleAutoStartup = async () => {
    try {
      const newValue = !autoStartupEnabled;
      const result = await ipcRenderer.invoke('setup-auto-startup', newValue);
      if (result.success) {
        setAutoStartupEnabled(newValue);
        const newSettings = { ...settings, autoStartup: newValue };
        saveSettings(newSettings);
        setStatus(result.message);
      } else {
        setStatus(`Error: ${result.message}`);
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const toggleAutomation = async () => {
    try {
      if (isRunning) {
        const result = await ipcRenderer.invoke('stop-automation');
        if (result.success) {
          setIsRunning(false);
          setStatus('Stopped');
          setLastAction(null);
        } else {
          setStatus(`Error: ${result.message}`);
        }
      } else {
        if (!hasPermission) {
          setStatus('Permission required');
          return;
        }
        
        const result = await ipcRenderer.invoke('start-automation', settings);
        if (result.success) {
          setIsRunning(true);
          setStatus('Running');
        } else {
          setStatus(`Error: ${result.message}`);
        }
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>Screen Keeper</h1>
          <p>Keep your computer active and appear online</p>
        </header>

        {!hasPermission && (
          <div className="permission-warning">
            <h3>⚠️ Permission Required</h3>
            <p>{permissionMessage}</p>
            <div className="permission-buttons">
              <button onClick={openAccessibilitySettings} className="btn btn-primary">
                Open System Preferences
              </button>
              <button onClick={checkPermissions} className="btn btn-secondary">
                Check Again
              </button>
            </div>
          </div>
        )}

        <div className="status-section">
          <div className="status-card">
            <h3>Status</h3>
            <div className={`status-indicator ${isRunning ? 'running' : 'stopped'}`}>
              {status}
            </div>
            {lastAction && (
              <div className="last-action">
                Last action: {lastAction.action === 'mouse' ? 'Mouse move' : `Key: ${lastAction.key}`}
                <br />
                <small>{formatTime(lastAction.timestamp)}</small>
              </div>
            )}
            {dailyScheduleStatus && (
              <div className="daily-status">
                <small>📅 {dailyScheduleStatus}</small>
              </div>
            )}
          </div>
        </div>

        <div className="automation-settings-section">
          <h3>🚀 Advanced Automation</h3>
          
          <div className="setting-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={autoStartupEnabled}
                onChange={toggleAutoStartup}
              />
              Start with system (run in background on startup)
            </label>
          </div>

          <div className="setting-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings.dailyAutoStart}
                onChange={(e) => handleSettingChange('dailyAutoStart', e.target.checked)}
              />
              Auto-start automation daily at specific time
            </label>
          </div>

          {settings.dailyAutoStart && (
            <div className="daily-settings">
              <div className="setting-group">
                <label>Daily start time</label>
                <input
                  type="time"
                  value={settings.dailyStartTime}
                  onChange={(e) => handleSettingChange('dailyStartTime', e.target.value)}
                  className="time-input"
                />
                <small className="help-text">
                  Program will automatically start automation every day at this time
                </small>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>Settings</h3>
          
          <div className="setting-group">
            <label>Action Type</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="actionType"
                  value="mouse"
                  checked={settings.actionType === 'mouse'}
                  onChange={(e) => handleSettingChange('actionType', e.target.value)}
                />
                Mouse Movement
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="actionType"
                  value="keyboard"
                  checked={settings.actionType === 'keyboard'}
                  onChange={(e) => handleSettingChange('actionType', e.target.value)}
                />
                Keyboard Press
              </label>
            </div>
          </div>

          {settings.actionType === 'keyboard' && (
            <div className="setting-group">
              <label>Key to Press</label>
              <select
                value={settings.key}
                onChange={(e) => handleSettingChange('key', e.target.value)}
                className="select-input"
              >
                {keyOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="setting-group">
            <label>Interval (seconds)</label>
            <input
              type="number"
              min="10"
              max="3600"
              value={settings.interval}
              onChange={(e) => handleSettingChange('interval', parseInt(e.target.value))}
              className="number-input"
            />
          </div>

          <div className="setting-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings.useTimeRestriction}
                onChange={(e) => handleSettingChange('useTimeRestriction', e.target.checked)}
              />
              Schedule automation for specific hours
            </label>
          </div>

          {settings.useTimeRestriction && (
            <div className="time-settings">
              <div className="setting-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={settings.startTime}
                  onChange={(e) => handleSettingChange('startTime', e.target.value)}
                  className="time-input"
                />
              </div>
              <div className="setting-group">
                <label>End Time</label>
                <input
                  type="time"
                  value={settings.endTime}
                  onChange={(e) => handleSettingChange('endTime', e.target.value)}
                  className="time-input"
                />
              </div>
            </div>
          )}
        </div>

        <div className="controls">
          <button
            onClick={toggleAutomation}
            className={`btn btn-primary ${isRunning ? 'btn-stop' : 'btn-start'}`}
            disabled={!hasPermission}
          >
            {isRunning ? 'Stop Automation' : 'Start Automation'}
          </button>
        </div>

        <footer className="footer">
          <div className="footer-info">
            <p className="automation-info">
              {settings.useTimeRestriction 
                ? `Screen Keeper will perform actions between ${settings.startTime} - ${settings.endTime}`
                : 'Screen Keeper will perform actions continuously while automation is running'
              }
            </p>
            {settings.dailyAutoStart && (
              <p className="schedule-info">
                🕒 Daily automation scheduled for {settings.dailyStartTime}
              </p>
            )}
            {autoStartupEnabled && (
              <p className="startup-info">
                🚀 App will start automatically with system
              </p>
            )}
          </div>
          <div className="developer-info">
            <p>Developed by <strong>Ahmet YILDIZ</strong></p>
            <a href="https://github.com/phosimurg" target="_blank" rel="noopener noreferrer">
              🔗 github.com/phosimurg
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App; 