const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const Store = require('electron-store');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');

let mainWindow;
let firstRunWindow;
let backendProcess;
const store = new Store();

const BACKEND_PORT = 5000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
  });

  mainWindow.loadURL(isDev ? FRONTEND_URL : `file://${FRONTEND_URL}`);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createFirstRunWindow() {
  firstRunWindow = new BrowserWindow({
    width: 500,
    height: 400,
    modal: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
  });

  firstRunWindow.loadFile(path.join(__dirname, 'firstRun.html'));
  firstRunWindow.once('ready-to-show', () => {
    firstRunWindow.show();
  });

  firstRunWindow.on('closed', () => {
    firstRunWindow = null;
  });
}

function spawnBackend() {
  if (backendProcess) {
    return;
  }

  const apiKey = store.get('apiKey') || process.env.OPENROUTER_API_KEY || '';
  const provider = store.get('provider') || 'openrouter';

  const env = {
    ...process.env,
    PORT: BACKEND_PORT,
    LLM_PROVIDER: provider,
  };

  if (provider === 'openrouter') {
    env.OPENROUTER_API_KEY = apiKey;
    env.OPENROUTER_MODEL = store.get('model') || 'openai/gpt-4o-mini';
  } else if (provider === 'openai') {
    env.OPENAI_API_KEY = apiKey;
    env.OPENAI_MODEL = store.get('model') || 'gpt-4-mini';
  }

  const backendPath = isDev
    ? path.join(__dirname, '../backend/server.js')
    : path.join(process.resourcesPath, 'backend/server.js');

  backendProcess = spawn('node', [backendPath], {
    env,
    stdio: isDev ? 'inherit' : 'ignore',
    detached: false,
  });

  backendProcess.on('error', (err) => {
    console.error('Backend spawn error:', err);
    dialog.showErrorBox('Backend Error', `Failed to start backend: ${err.message}`);
  });

  backendProcess.on('exit', (code) => {
    backendProcess = null;
    if (code !== 0 && code !== null) {
      dialog.showErrorBox('Backend Error', `Backend exited with code ${code}`);
    }
  });

  // Wait for backend to be ready
  return new Promise((resolve) => {
    const maxAttempts = 30;
    let attempts = 0;

    const checkBackend = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/health`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch (err) {
        // Backend not ready yet
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkBackend, 500);
      } else {
        resolve(); // Give up but proceed anyway
      }
    };

    setTimeout(checkBackend, 500);
  });
}

function killBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.on('ready', async () => {
  // Check if first run
  const hasApiKey = store.has('apiKey');

  if (!hasApiKey) {
    createFirstRunWindow();
  } else {
    await spawnBackend();
    createWindow();
  }

  createMenu();
});

app.on('window-all-closed', () => {
  killBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  killBackend();
});

// IPC handlers
ipcMain.handle('get-api-key', () => {
  return store.get('apiKey') || '';
});

ipcMain.handle('set-api-key', (event, apiKey, provider = 'openrouter') => {
  store.set('apiKey', apiKey);
  store.set('provider', provider);
  return true;
});

ipcMain.handle('get-provider-config', () => {
  return {
    provider: store.get('provider') || 'openrouter',
    model: store.get('model') || 'openai/gpt-4o-mini',
  };
});

ipcMain.handle('open-dev-tools', () => {
  if (mainWindow && isDev) {
    mainWindow.webContents.openDevTools();
  }
});

ipcMain.on('first-run-complete', async () => {
  if (firstRunWindow) {
    firstRunWindow.close();
  }
  await spawnBackend();
  createWindow();
});

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.webContents.reload();
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: isDev ? 'CmdOrCtrl+I' : 'F12',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About AI Terminal',
              message: 'AI Terminal',
              detail: 'Convert natural language to safe PowerShell commands.\n\nVersion 1.0.0',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle any uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  dialog.showErrorBox('Error', err.message);
});
