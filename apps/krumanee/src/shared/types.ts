export interface AppSettings {
  openaiApiKey: string;
  visionModel: string;
  ttsEnabled: boolean;
  ttsVoice: string;
  micEnabled: boolean;
  buddyEnabled: boolean;
  hotkey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: "",
  visionModel: "gpt-4o-mini",
  ttsEnabled: true,
  ttsVoice: "nova",
  micEnabled: false,
  buddyEnabled: true,
  hotkey: "CommandOrControl+Alt+Space",
};

export const POINT_TAG =
  /\[POINT:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?::([^\]]*))?\]/gi;

export function parsePointTags(text: string): Array<{ x: number; y: number; label: string }> {
  const points: Array<{ x: number; y: number; label: string }> = [];
  for (const match of text.matchAll(POINT_TAG)) {
    points.push({
      x: clamp(Number(match[1]), 0, 100),
      y: clamp(Number(match[2]), 0, 100),
      label: (match[3] ?? "").trim(),
    });
  }
  return points;
}

export function stripPointTags(text: string): string {
  return text.replace(POINT_TAG, "").replace(/\s+/g, " ").trim();
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

