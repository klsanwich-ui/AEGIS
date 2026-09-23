import { app, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AgentKey, DirectApp, mentionsYoutube } from "../shared/actions";

const SEND_KEYS: Record<AgentKey, string> = {
  enter: "{ENTER}",
  tab: "{TAB}",
  escape: "{ESC}",
  space: " ",
  backspace: "{BACKSPACE}",
  up: "{UP}",
  down: "{DOWN}",
  left: "{LEFT}",
  right: "{RIGHT}",
};

export async function openApp(name: DirectApp): Promise<string> {
  if (name === "music") return openFolder(app.getPath("music"), "โฟลเดอร์เพลง");
  if (name === "explorer") return openFolder(app.getPath("documents"), "โฟลเดอร์เอกสาร");
  const launched = await launchKnown(name);
  return `เปิด ${launched} แล้ว`;
}

export async function openUrl(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("เปิดได้เฉพาะลิงก์ http หรือ https");
  }
  await shell.openExternal(url);
  return `เปิด ${url} แล้ว`;
}

export async function openTarget(target: string): Promise<string> {
  if (mentionsYoutube(target)) return openUrl("https://www.youtube.com");
  const aliases: Record<string, DirectApp> = {
    notepad: "notepad",
    "notepad.exe": "notepad",
    calc: "calc",
    calculator: "calc",
    paint: "paint",
    mspaint: "paint",
    explorer: "explorer",
    music: "music",
    edge: "edge",
    msedge: "edge",
    chrome: "chrome",
  };
  const key = target.toLowerCase();
  if (aliases[key]) return openApp(aliases[key]);
  if (/^https?:\/\//i.test(target)) return openUrl(target);
  throw new Error(`ยังไม่เปิด «${target}» ให้เอง`);
}

export async function clickAt(x: number, y: number): Promise<void> {
  const xi = Math.round(x);
  const yi = Math.round(y);
  await runPowerShell(`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class KmMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int dx, int dy, int d, int e);
}
"@
[KmMouse]::SetCursorPos(${xi}, ${yi}) | Out-Null
Start-Sleep -Milliseconds 90
[KmMouse]::mouse_event(2, 0, 0, 0, 0)
[KmMouse]::mouse_event(4, 0, 0, 0, 0)
`);
}

export async function pressKey(key: AgentKey): Promise<void> {
  const token = SEND_KEYS[key].replace(/'/g, "''");
  await runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${token}')
`);
}

export async function typeText(text: string): Promise<void> {
  const file = path.join(os.tmpdir(), `krumanee-type-${Date.now()}.txt`);
  fs.writeFileSync(file, text, "utf8");
  const literal = file.replace(/'/g, "''");
  try {
    await runPowerShell(`
$t = Get-Content -Raw -Encoding UTF8 -LiteralPath '${literal}'
Set-Clipboard -Value $t
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 120
[System.Windows.Forms.SendKeys]::SendWait('^v')
`);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

async function openFolder(folder: string, label: string): Promise<string> {
  const error = await shell.openPath(folder);
  if (error) throw new Error(error);
  return `เปิด${label}แล้ว`;
}

async function launchKnown(name: DirectApp): Promise<string> {
  const candidates: Record<string, string[]> = {
    notepad: ["notepad.exe"],
    calc: ["calc.exe"],
    paint: ["mspaint.exe"],
    edge: [
      "msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ],
    chrome: [
      "chrome.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      path.join(process.env.LOCALAPPDATA ?? "", "Google\\Chrome\\Application\\chrome.exe"),
    ],
  };
  const list = candidates[name] ?? [];
  let lastError = "ไม่พบโปรแกรม";
  for (const exe of list) {
    if (exe.includes("\\") && !fs.existsSync(exe)) continue;
    try {
      await spawnDetached(exe);
      return path.basename(exe);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

function spawnDetached(exe: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(exe, [], { detached: true, stdio: "ignore", windowsHide: false });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.unref();
    setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, 200);
  });
}

function runPowerShell(script: string): Promise<void> {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { windowsHide: true },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `powershell จบด้วยรหัส ${code}`));
    });
  });
}
