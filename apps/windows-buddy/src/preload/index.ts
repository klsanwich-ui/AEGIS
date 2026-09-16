import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings } from "../shared/types";

contextBridge.exposeInMainWorld("buddy", {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
  saveSettings: (next: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke("settings:save", next),
  submitAsk: (question: string) => ipcRenderer.invoke("ask:submit", question),
  transcribe: (base64: string, mimeType: string) =>
    ipcRenderer.invoke("ask:transcribe", { base64, mimeType }),
  closeAsk: () => ipcRenderer.send("ask:close"),
  onAskReady: (cb: (state: { micEnabled: boolean; hasKey: boolean }) => void) => {
    ipcRenderer.on("ask:ready", (_e, state) => cb(state));
  },
  onMouse: (cb: (pt: { x: number; y: number }) => void) => {
    ipcRenderer.on("buddy:mouse", (_e, pt) => cb(pt));
  },
  onPoints: (cb: (points: Array<{ x: number; y: number; label: string }>) => void) => {
    ipcRenderer.on("buddy:points", (_e, points) => cb(points));
  },
  onConfig: (cb: (cfg: { enabled: boolean }) => void) => {
    ipcRenderer.on("buddy:config", (_e, cfg) => cb(cfg));
  },
});
