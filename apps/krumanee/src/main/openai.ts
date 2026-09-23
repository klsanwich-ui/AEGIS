import { parsePointTags, stripPointTags } from "../shared/types";

const SYSTEM_PROMPT = `คุณเป็นครูมณี (KruManee) ครูภาษาไทยบน Windows
ผู้ใช้อาจถามได้ทุกเรื่อง เช่น วิธีทำเพลง เทคนิคตัดต่อ วิธีใช้โปรแกรม หรือให้ช่วยอธิบายสิ่งที่เห็น
ตอบเป็นภาษาไทย ชัด เดินทีละขั้น ให้คำแนะนำที่ใช้ทำได้จริง
คุณเห็นภาพหน้าจอเฉพาะตอนที่ผู้ใช้กดถามครั้งนี้
เมื่อต้องการชี้ปุ่ม เมนู หรือจุดบนจอ ให้ใส่แท็กในคำตอบ (พิกัดเป็นเปอร์เซ็นต์ของภาพ 0-100):
[POINT:x,y:ป้ายสั้น]
ใส่ได้หลายจุดตามลำดับที่ควรดู ถ้าคำถามไม่ต้องชี้จอ ก็ตอบเนื้อหาได้โดยไม่ใส่แท็ก
อย่าเก็บหรือขอข้อมูลลับ`;

const AGENT_PROMPT = `คุณเป็นมือของครูมณีบน Windows ทำงานตามคำสั่งผู้ใช้หนึ่งอย่าง
ตอบเป็น JSON เท่านั้น ในรูปแบบนี้:
{"done":false,"say":"ภาษาไทยสั้นๆ ว่ากำลังทำอะไร","actions":[{"type":"click","x":10,"y":20}]}
action type ที่ใช้ได้:
- click พร้อม x,y เป็นเปอร์เซ็นต์ 0-100 ของภาพ
- type พร้อม text
- key โดย key เป็น enter, tab, escape, space, backspace, up, down, left, right
- open โดย target เป็น notepad, calc, paint, explorer, music, edge, chrome, youtube หรือลิงก์ https
ใส่ได้ไม่เกิน 4 actions ต่อรอบ
เมื่องานเสร็จ ให้ done เป็น true และ actions เป็นอาร์เรย์ว่าง
ทำเฉพาะสิ่งที่ผู้ใช้สั่ง ถ้าทำต่อไม่ได้ให้ done เป็น true แล้วบอกเหตุผลใน say`;

export interface AskResult {
  text: string;
  spokenText: string;
  points: Array<{ x: number; y: number; label: string }>;
}

export async function askVision(opts: {
  apiKey: string;
  model: string;
  question: string;
  imageDataUrl: string;
}): Promise<AskResult> {
  if (!opts.apiKey.trim()) {
    throw new Error("ยังไม่ได้ใส่ OpenAI API key ในตั้งค่า");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 700,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: opts.question.trim() || "อธิบายสิ่งที่เห็นบนจอสั้น ๆ และชี้จุดที่สำคัญ",
            },
            {
              type: "image_url",
              image_url: { url: opts.imageDataUrl, detail: "low" },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`โมเดลตอบไม่สำเร็จ (${response.status}): ${errText.slice(0, 400)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("โมเดลไม่ได้ส่งข้อความกลับมา");
  }

  const points = parsePointTags(text);

  return {
    text,
    spokenText: stripPointTags(text),
    points,
  };
}

export async function askAgentStep(opts: {
  apiKey: string;
  model: string;
  command: string;
  imageDataUrl: string;
  round: number;
  maxRounds: number;
  lastNote: string;
}): Promise<string> {
  if (!opts.apiKey.trim()) {
    throw new Error("ยังไม่ได้ใส่ OpenAI API key ในตั้งค่า");
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AGENT_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `คำสั่ง: ${opts.command}\nรอบ ${opts.round}/${opts.maxRounds}\nผลรอบก่อน: ${opts.lastNote || "ยังไม่ได้ลงมือ"}`,
            },
            { type: "image_url", image_url: { url: opts.imageDataUrl, detail: "low" } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`โมเดลลงมือไม่สำเร็จ (${response.status}): ${errText.slice(0, 400)}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("โมเดลไม่ได้บอกขั้นตอนถัดไป");
  return text;
}

export async function synthesizeThaiSpeech(opts: {
  apiKey: string;
  voice: string;
  text: string;
}): Promise<Buffer> {
  const clipped = opts.text.slice(0, 4000);
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: opts.voice || "nova",
      input: clipped,
      response_format: "mp3",
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`TTS ไม่สำเร็จ (${response.status}): ${errText.slice(0, 300)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function transcribeAudio(opts: {
  apiKey: string;
  wavOrWebm: Buffer;
  mimeType: string;
}): Promise<string> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(opts.wavOrWebm)], { type: opts.mimeType });
  form.append("file", blob, opts.mimeType.includes("wav") ? "audio.wav" : "audio.webm");
  form.append("model", "whisper-1");
  form.append("language", "th");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey.trim()}` },
    body: form,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ถอดเสียงไม่สำเร็จ (${response.status}): ${errText.slice(0, 300)}`);
  }
  const json = (await response.json()) as { text?: string };
  return json.text?.trim() ?? "";
}
