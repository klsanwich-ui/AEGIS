const question = document.getElementById("question");
const send = document.getElementById("send");
const cancel = document.getElementById("cancel");
const mic = document.getElementById("mic");
const error = document.getElementById("error");
const answer = document.getElementById("answer");
const status = document.getElementById("status");

let recording = false;
let recorder;
let chunks = [];

window.buddy.onAskReady((state) => {
  if (!state.hasKey) {
    status.textContent = "ยังไม่มี API key — เปิดตั้งค่าจากไอคอนถาดระบบก่อน";
  }
  if (state.micEnabled && navigator.mediaDevices?.getUserMedia) {
    mic.classList.remove("hidden");
  }
  question.focus();
});

cancel.addEventListener("click", () => window.buddy.closeAsk());

send.addEventListener("click", () => void submit());
question.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void submit();
  }
  if (event.key === "Escape") {
    window.buddy.closeAsk();
  }
});

mic.addEventListener("click", () => void toggleMic());

async function toggleMic() {
  error.textContent = "";
  if (recording) {
    recorder?.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      recording = false;
      mic.textContent = "พูดแทนพิมพ์";
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      const base64 = btoa(binary);
      try {
        const text = await window.buddy.transcribe(base64, blob.type || "audio/webm");
        question.value = text;
        await submit();
      } catch (err) {
        error.textContent = err?.message || String(err);
      }
    };
    recorder.start();
    recording = true;
    mic.textContent = "หยุดพูด";
    status.textContent = "กำลังฟัง...";
  } catch (err) {
    error.textContent = "เปิดไมค์ไม่ได้ — พิมพ์คำถามแทนได้";
  }
}

async function submit() {
  error.textContent = "";
  send.disabled = true;
  status.textContent = "กำลังส่งภาพหน้าจอ + คำถาม (หนึ่งรอบ ไม่ใช่ agent)...";
  try {
    const result = await window.buddy.submitAsk(question.value);
    answer.classList.remove("hidden");
    answer.textContent = result.spokenText || result.text;
    status.textContent = "ตอบแล้ว — จุดเหลืองบนจอคือตำแหน่งที่ชี้";
    if (result.ttsEnabled) {
      if (result.audioBase64) {
        const src = `data:audio/mp3;base64,${result.audioBase64}`;
        const audio = new Audio(src);
        await audio.play().catch(() => speakFallback(result.spokenText));
      } else {
        speakFallback(result.spokenText);
      }
    }
  } catch (err) {
    error.textContent = err?.message || String(err);
    status.textContent = "ถามไม่สำเร็จ";
  } finally {
    send.disabled = false;
  }
}

function speakFallback(text) {
  if (!text || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "th-TH";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
