import { AgentAction, parseAgentReply } from "../shared/actions";
import { clickAt, openTarget, pressKey, typeText } from "./act";
import { CaptureResult } from "./capture";
import { askAgentStep } from "./openai";

const MAX_ROUNDS = 6;

export async function runAgent(opts: {
  apiKey: string;
  model: string;
  command: string;
  onProgress: (line: string) => void;
  capture: () => Promise<CaptureResult>;
}): Promise<string[]> {
  const log: string[] = [];
  const note = (line: string) => {
    log.push(line);
    opts.onProgress(line);
  };

  let lastNote = "";
  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    note(`รอบ ${round}/${MAX_ROUNDS}: ดูหน้าจอ`);
    const shot = await opts.capture();
    const raw = await askAgentStep({
      apiKey: opts.apiKey,
      model: opts.model,
      command: opts.command,
      imageDataUrl: shot.dataUrl,
      round,
      maxRounds: MAX_ROUNDS,
      lastNote,
    });
    const step = parseAgentReply(raw);
    if (step.say) note(step.say);
    for (const action of step.actions) {
      lastNote = await runOne(action, shot);
      note(lastNote);
    }
    if (step.done) {
      note("หยุดแล้ว");
      return log;
    }
    await delay(700);
  }
  note("ถึงเพดาน 6 รอบแล้ว จึงหยุด");
  return log;
}

async function runOne(action: AgentAction, shot: CaptureResult): Promise<string> {
  if (action.type === "click") {
    const x = shot.displayBounds.x + (action.x / 100) * shot.displayBounds.width;
    const y = shot.displayBounds.y + (action.y / 100) * shot.displayBounds.height;
    await clickAt(x, y);
    return `คลิกที่ ${Math.round(action.x)}%, ${Math.round(action.y)}%`;
  }
  if (action.type === "type") {
    await typeText(action.text);
    return "พิมพ์ข้อความแล้ว";
  }
  if (action.type === "key") {
    await pressKey(action.key);
    return `กดปุ่ม ${action.key}`;
  }
  return openTarget(action.target);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
