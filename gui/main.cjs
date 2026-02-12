const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

function getIconPngPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'icon.png');
  const devIcon = path.join(app.getAppPath(), 'build', 'icon.png');
  return fs.existsSync(devIcon) ? devIcon : null;
}

function getBundledNodePath() {
  const resources = process.resourcesPath;
  const exe = process.platform === 'win32' ? 'node.exe' : 'node';
  return path.join(resources, 'node', exe);
}

function getNodePath() {
  if (app.isPackaged) return getBundledNodePath();
  return (
    process.env.FANTASTICON_NODE || process.env.npm_node_execpath || 'node'
  );
}

function getRunnerPath() {
  const appPath = app.getAppPath();
  return path.join(appPath, 'gui', 'runner.mjs');
}

async function runFantasticon(opts) {
  const nodePath = getNodePath();
  const runnerPath = getRunnerPath();

  return await new Promise(resolve => {
    const child = spawn(nodePath, [runnerPath], {
      cwd: app.getAppPath(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', err =>
      resolve({ ok: false, error: String(err), stderr })
    );
    child.on('close', code => {
      const line = stdout.trim().split('\n').pop();
      try {
        const parsed = line ? JSON.parse(line) : null;
        if (parsed && typeof parsed.ok === 'boolean') {
          resolve(parsed);
          return;
        }
      } catch {
        // fall through
      }

      resolve({
        ok: false,
        error: `Runner failed (exit ${code}).`,
        stderr: `${stderr}\n${stdout}`.trim()
      });
    });

    child.stdin.write(JSON.stringify(opts ?? {}));
    child.stdin.end();
  });
}

function createWindow() {
  const winIcon = process.platform === 'win32' ? getIconPngPath() : null;
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    show: false,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    ...(winIcon ? { icon: winIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.setTitle('Fanstanicon');

  // Fallback: show even if renderer never requests sizing.
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  }, 800);
}

app.whenReady().then(() => {
  app.setName('Fanstanicon');
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.fantasticon.gui');
  }
  if (process.platform === 'darwin' && app.dock) {
    try {
      const iconPath = getIconPngPath();
      if (iconPath) app.dock.setIcon(iconPath);
    } catch {
      // ignore
    }
  }

  ipcMain.handle(
    'window:setContentSize',
    async (evt, { width, height } = {}) => {
      const win = BrowserWindow.fromWebContents(evt.sender);
      if (!win) return false;

      const safeWidth =
        typeof width === 'number' && Number.isFinite(width)
          ? Math.round(Math.max(640, Math.min(1400, width)))
          : undefined;
      const safeHeight =
        typeof height === 'number' && Number.isFinite(height)
          ? Math.round(Math.max(520, Math.min(1000, height)))
          : undefined;

      if (safeWidth != null && safeHeight != null) {
        win.setContentSize(safeWidth, safeHeight);
      } else if (safeHeight != null) {
        const current = win.getContentSize();
        win.setContentSize(current[0], safeHeight);
      }

      if (!win.isVisible()) win.show();
      return true;
    }
  );

  ipcMain.handle('dialog:openDir', async (_evt, { title } = {}) => {
    const result = await dialog.showOpenDialog({
      title: title ?? 'Select folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths?.[0] ?? null;
  });

  ipcMain.handle('dialog:openFile', async (_evt, { title, filters } = {}) => {
    const result = await dialog.showOpenDialog({
      title: title ?? 'Select file',
      properties: ['openFile'],
      filters: Array.isArray(filters) ? filters : undefined
    });
    if (result.canceled) return null;
    return result.filePaths?.[0] ?? null;
  });

  ipcMain.handle('fantasticon:run', async (_evt, opts) => {
    const {
      inputDir,
      outputDir,
      name,
      fontTypes,
      assetTypes,
      prefix,
      tag,
      fontsUrl,
      configPath
    } = opts ?? {};

    if (!inputDir) return { ok: false, error: 'inputDir is required' };
    if (!outputDir) return { ok: false, error: 'outputDir is required' };

    const merged = {
      inputDir,
      outputDir,
      ...(name ? { name: String(name) } : {}),
      ...(Array.isArray(fontTypes) && fontTypes.length > 0
        ? { fontTypes: fontTypes.map(String) }
        : {}),
      ...(Array.isArray(assetTypes) && assetTypes.length > 0
        ? { assetTypes: assetTypes.map(String) }
        : {}),
      ...(prefix ? { prefix: String(prefix) } : {}),
      ...(tag ? { tag: String(tag) } : {}),
      ...(fontsUrl ? { fontsUrl: String(fontsUrl) } : {}),
      ...(configPath ? { configPath: String(configPath) } : {})
    };

    return await runFantasticon(merged);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
