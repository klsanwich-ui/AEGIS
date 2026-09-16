const fields = [
  "openaiApiKey",
  "visionModel",
  "hotkey",
  "ttsVoice",
  "ttsEnabled",
  "buddyEnabled",
  "micEnabled",
];

async function load() {
  const settings = await window.buddy.getSettings();
  for (const key of fields) {
    const el = document.getElementById(key);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = Boolean(settings[key]);
    else el.value = settings[key] ?? "";
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const current = await window.buddy.getSettings();
  const next = { ...current };
  for (const key of fields) {
    const el = document.getElementById(key);
    next[key] = el.type === "checkbox" ? el.checked : el.value;
  }
  await window.buddy.saveSettings(next);
  document.getElementById("saveMsg").textContent = "บันทึกแล้ว — ปุ่มลัดเริ่มใช้ทันที";
});

void load();
