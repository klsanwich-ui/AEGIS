import { parsePointTags, stripPointTags } from "../shared/types";

const SYSTEM_PROMPT = `คุณเป็นครูสอนงานบนหน้าจอ Windows ชื่อ ครูมณี (KruManee)
ตอบเป็นภาษาไทย สั้น ชัด เดินทีละขั้น
คุณเห็นภาพหน้าจอที่ผู้ใช้กำลังดูอยู่ตอนกดปุ่มลัด
เมื่อต้องการชี้ปุ่ม เมนู หรือจุดบนจอ ให้ใส่แท็กในคำตอบ (พิกัดเป็นเปอร์เซ็นต์ของภาพ 0-100):
[POINT:x,y:ป้ายสั้น]
ใส่ได้หลายจุดตามลำดับที่ควรดู
อย่าเก็บหรือขอข้อมูลลับ อย่าอ้างว่าคุณส่องจอตลอดเวลา — คุณเห็นเฉพาะภาพตอนถามครั้งนี้`;

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
