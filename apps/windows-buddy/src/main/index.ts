import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { captureActiveDisplay } from "./capture";
import { askVision, synthesizeThaiSpeech, transcribeAudio } from "./openai";
import { loadSettings, saveSettings } from "./settings";
import { AppSettings } from "../shared/types";

let tray: Tray | undefined;
let overlayWindow: BrowserWindow | undefined;
let askWindow: BrowserWindow | undefined;
let settingsWindow: BrowserWindow | undefined;
let mouseTimer: NodeJS.Timeout | undefined;
let lastCapture:
  | {
      dataUrl: string;
      displayBounds: { x: number; y: number; width: number; height: number };
    }
  | undefined;

const staticDir = path.join(__dirname, "../../static");

function iconImage(): Electron.NativeImage {
  const png = path.join(staticDir, "tray.png");
  if (fs.existsSync(png)) {
    return nativeImage.createFromPath(png);
  }
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAVElEQVR4nO2VMQ4AIAgD6f+f1sHJxEHFxtq7GQiltBQws5uZVwB4A+gCqJndzOxeAXgB6AGomd3M7F4BeAHoAaiZ3czsXgF4AegBqJndzOxeAXgB+ANwAKk8R2s1mO0vAAAAAElFTkSuQmCC",
  );
}

function virtualScreen(): { x: number; y: number; width: number; height: number } {
  const displays = screen.getAllDisplays();
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x);
    minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function createOverlay(): void {
  const area = virtualScreen();
  overlayWindow = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(staticDir, "overlay.html"));
  overlayWindow.once("ready-to-show", () => {
    overlayWindow?.showInactive();
    pushBuddyState();
  });
}

function createAskWindow(): BrowserWindow {
  const cursor = screen.getCursorScreenPoint();
  const win = new BrowserWindow({
    width: 420,
    height: 280,
    x: cursor.x + 24,
    y: cursor.y + 24,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(staticDir, "ask.html"));
  return win;
}

function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 620,
    title: "ตั้งค่า Talk Buddy",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile(path.join(staticDir, "settings.html"));
  settingsWindow.on("closed", () => {
    settingsWindow = undefined;
  });
}

function createTray(): void {
  tray = new Tray(iconImage());
  tray.setToolTip("Talk Buddy");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "ถาม (ปุ่มลัด)", click: () => void beginAsk() },
      { label: "ตั้งค่า", click: () => openSettings() },
      { type: "separator" },
      { label: "ออก", click: () => app.quit() },
    ]),
  );
  tray.on("click", () => openSettings());
}

function registerHotkey(settings: AppSettings): void {
  globalShortcut.unregisterAll();
  if (!settings.hotkey.trim()) return;
  const ok = globalShortcut.register(settings.hotkey, () => {
    void beginAsk();
  });
  if (!ok) {
    console.warn("ลงทะเบียนปุ่มลัดไม่สำเร็จ:", settings.hotkey);
  }
}

function startMouseLoop(): void {
  if (mouseTimer) {
    clearInterval(mouseTimer);
  }
  mouseTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    const pt = screen.getCursorScreenPoint();
    const area = virtualScreen();
    overlayWindow.webContents.send("buddy:mouse", {
      x: pt.x - area.x,
      y: pt.y - area.y,
    });
  }, 32);
}

function pushBuddyState(): void {
  const settings = loadSettings();
  overlayWindow?.webContents.send("buddy:config", {
    enabled: settings.buddyEnabled,
  });
}

async function beginAsk(): Promise<void> {
  try {
    lastCapture = await captureActiveDisplay();
  } catch (error) {
    console.error(error);
    return;
  }

  if (askWindow && !askWindow.isDestroyed()) {
    askWindow.close();
  }
  askWindow = createAskWindow();
  askWindow.once("ready-to-show", () => {
    askWindow?.show();
    askWindow?.focus();
    askWindow?.webContents.send("ask:ready", {
      micEnabled: loadSettings().micEnabled,
      hasKey: Boolean(loadSettings().openaiApiKey.trim()),
    });
  });
}

function pointToOverlay(points: Array<{ x: number; y: number; label: string }>): void {
  if (!lastCapture || !overlayWindow) return;
  const area = virtualScreen();
  const mapped = points.map((p) => {
    const absX = lastCapture!.displayBounds.x + (p.x / 100) * lastCapture!.displayBounds.width;
    const absY = lastCapture!.displayBounds.y + (p.y / 100) * lastCapture!.displayBounds.height;
    return {
      x: absX - area.x,
      y: absY - area.y,
      label: p.label,
    };
  });
  overlayWindow.webContents.send("buddy:points", mapped);
}

function bindIpc(): void {
  ipcMain.handle("settings:get", () => loadSettings());
  ipcMain.handle("settings:save", (_event, next: AppSettings) => {
    saveSettings(next);
    registerHotkey(next);
    pushBuddyState();
    return loadSettings();
  });

  ipcMain.handle("ask:submit", async (_event, question: string) => {
    const settings = loadSettings();
    if (!lastCapture) {
      throw new Error("ยังไม่มีภาพหน้าจอ — กดปุ่มลัดใหม่");
    }
    const result = await askVision({
      apiKey: settings.openaiApiKey,
      model: settings.visionModel,
      question,
      imageDataUrl: lastCapture.dataUrl,
    });
    pointToOverlay(result.points);

    let audioBase64: string | undefined;
    if (settings.ttsEnabled && result.spokenText) {
      try {
        const mp3 = await synthesizeThaiSpeech({
          apiKey: settings.openaiApiKey,
          voice: settings.ttsVoice,
          text: result.spokenText,
        });
        audioBase64 = mp3.toString("base64");
      } catch (error) {
        console.warn("TTS failed, renderer may fall back to Web Speech", error);
      }
    }
    return { ...result, audioBase64, ttsEnabled: settings.ttsEnabled };
  });

  ipcMain.handle("ask:transcribe", async (_event, payload: { base64: string; mimeType: string }) => {
    const settings = loadSettings();
    if (!settings.micEnabled) {
      throw new Error("ไมค์ยังไม่เปิดในตั้งค่า");
    }
    const buf = Buffer.from(payload.base64, "base64");
    return transcribeAudio({
      apiKey: settings.openaiApiKey,
      wavOrWebm: buf,
      mimeType: payload.mimeType,
    });
  });

  ipcMain.on("ask:close", () => {
    if (askWindow && !askWindow.isDestroyed()) {
      askWindow.close();
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => openSettings());
  app.whenReady().then(() => {
    if (process.platform === "darwin") {
      app.dock?.hide();
    }
    bindIpc();
    createTray();
    createOverlay();
    startMouseLoop();
    registerHotkey(loadSettings());
  });
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (mouseTimer) clearInterval(mouseTimer);
});

app.on("window-all-closed", () => {
  // Stay in the tray until the user quits from the menu.
});
