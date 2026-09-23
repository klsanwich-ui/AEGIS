export type DirectApp = "notepad" | "calc" | "paint" | "explorer" | "music" | "edge" | "chrome";

export type DirectAction =
  | { type: "open-app"; app: DirectApp; summary: string }
  | { type: "open-url"; url: string; summary: string };

export type CommandPlan =
  | { kind: "empty" }
  | { kind: "direct"; action: DirectAction }
  | { kind: "agent"; summary: string };

export type AgentAction =
  | { type: "click"; x: number; y: number }
  | { type: "type"; text: string }
  | { type: "key"; key: AgentKey }
  | { type: "open"; target: string };

export type AgentKey = "enter" | "tab" | "escape" | "space" | "backspace" | "up" | "down" | "left" | "right";

const AGENT_KEYS = new Set<AgentKey>([
  "enter",
  "tab",
  "escape",
  "space",
  "backspace",
  "up",
  "down",
  "left",
  "right",
]);

const APP_RULES: Array<{ re: RegExp; app: DirectApp; summary: string }> = [
  { re: /โน้ตแพด|โน๊ตแพด|notepad/i, app: "notepad", summary: "เปิด Notepad" },
  { re: /เครื่องคิดเลข|calculator|\bcalc\b/i, app: "calc", summary: "เปิดเครื่องคิดเลข" },
  { re: /ระบายสี|mspaint|\bpaint\b/i, app: "paint", summary: "เปิดระบายสี" },
  { re: /โฟลเดอร์เพลง|เปิดเพลง|music/i, app: "music", summary: "เปิดโฟลเดอร์เพลง" },
  { re: /เอกสาร|explorer|ไฟล์เอ็กซ์พลอเรอร์|เปิดไฟล์/i, app: "explorer", summary: "เปิดโฟลเดอร์เอกสาร" },
  { re: /เอดจ์|microsoft edge|\bedge\b/i, app: "edge", summary: "เปิด Microsoft Edge" },
  { re: /โครม|\bchrome\b/i, app: "chrome", summary: "เปิด Google Chrome" },
];

const YOUTUBE_URL = "https://www.youtube.com";

export function classifyCommand(raw: string): CommandPlan {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { kind: "empty" };

  if (mentionsYoutube(text) && isSingleStep(text)) {
    return { kind: "direct", action: { type: "open-url", url: YOUTUBE_URL, summary: "เปิด YouTube" } };
  }

  const url = text.match(/https?:\/\/[^\s]+/i)?.[0];
  if (url && isSingleStep(text)) {
    return { kind: "direct", action: { type: "open-url", url, summary: `เปิด ${url}` } };
  }

  if (/เปิดเว็บ\s*(google|กูเกิล)|เปิด\s*(google|กูเกิล)|^กูเกิล$|^google$/i.test(text) && isSingleStep(text)) {
    return {
      kind: "direct",
      action: { type: "open-url", url: "https://www.google.com", summary: "เปิด Google" },
    };
  }

  if (!isSingleStep(text) && !isBareAppName(text)) {
    return {
      kind: "agent",
      summary: "งานนี้ต้องดูหน้าจอแล้วคลิกเอง จะหยุดภายใน 6 รอบ",
    };
  }

  for (const rule of APP_RULES) {
    if (rule.re.test(text)) {
      return { kind: "direct", action: { type: "open-app", app: rule.app, summary: rule.summary } };
    }
  }

  return {
    kind: "agent",
    summary: "งานนี้ต้องดูหน้าจอแล้วคลิกเอง จะหยุดภายใน 6 รอบ",
  };
}

export function mentionsYoutube(text: string): boolean {
  return /you\s*tub|youtu\.be|ยู\s*ทูบ|ยู\s*ทูป/i.test(text);
}

function isSingleStep(text: string): boolean {
  if (text.length > 80) return false;
  return !/(แล้ว|จากนั้น|หลังจาก|คลิก|พิมพ์|ค้นหา|และ)/.test(text);
}

function isBareAppName(text: string): boolean {
  return /^(notepad|calc|paint|chrome|edge|โน้ตแพด|เครื่องคิดเลข|youtub\w*|youtube)$/i.test(text);
}

export function parseAgentReply(raw: string): { done: boolean; say: string; actions: AgentAction[] } {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { done: true, say: "อ่านคำสั่งจากโมเดลไม่ได้ จึงหยุด", actions: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { done: true, say: "คำตอบไม่ใช่ JSON จึงหยุด", actions: [] };
  }
  if (!parsed || typeof parsed !== "object") {
    return { done: true, say: "คำตอบว่าง จึงหยุด", actions: [] };
  }
  const record = parsed as { done?: unknown; say?: unknown; actions?: unknown };
  const actions = Array.isArray(record.actions) ? record.actions.slice(0, 4).flatMap(normalizeAction) : [];
  return {
    done: Boolean(record.done) || actions.length === 0,
    say: typeof record.say === "string" ? record.say.slice(0, 240) : "",
    actions,
  };
}

function normalizeAction(value: unknown): AgentAction[] {
  if (!value || typeof value !== "object") return [];
  const action = value as { type?: unknown; x?: unknown; y?: unknown; text?: unknown; key?: unknown; target?: unknown };
  if (action.type === "click") {
    const x = Number(action.x);
    const y = Number(action.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{ type: "click", x: clamp(x, 0, 100), y: clamp(y, 0, 100) }];
  }
  if (action.type === "type" && typeof action.text === "string" && action.text.trim()) {
    return [{ type: "type", text: action.text.slice(0, 300) }];
  }
  if (action.type === "key" && typeof action.key === "string" && AGENT_KEYS.has(action.key as AgentKey)) {
    return [{ type: "key", key: action.key as AgentKey }];
  }
  if (action.type === "open" && typeof action.target === "string" && action.target.trim()) {
    return [{ type: "open", target: action.target.trim().slice(0, 200) }];
  }
  return [];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
