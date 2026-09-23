const command = document.getElementById("command");
const run = document.getElementById("run");
const log = document.getElementById("log");
const confirmBox = document.getElementById("confirm");
const confirmText = document.getElementById("confirmText");
const keyState = document.getElementById("keyState");

window.buddy.onDoProgress((line) => append(line));

document.getElementById("teach").addEventListener("click", () => {
  void window.buddy.openAsk();
});

document.getElementById("settings").addEventListener("click", () => {
  void window.buddy.openSettings();
});

document.getElementById("run").addEventListener("click", () => void start());
command.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void start();
  }
});

document.querySelectorAll("[data-cmd]").forEach((button) => {
  button.addEventListener("click", () => {
    command.value = button.getAttribute("data-cmd") || "";
    void start();
  });
});

document.getElementById("confirmYes").addEventListener("click", () => void confirmAgent());
document.getElementById("confirmNo").addEventListener("click", () => {
  confirmBox.classList.add("hidden");
  append("ยกเลิกแล้ว");
});

window.addEventListener("focus", () => void refreshKey());
void refreshKey();

async function refreshKey() {
  const settings = await window.buddy.getSettings();
  const hasKey = Boolean(String(settings.openaiApiKey || "").trim());
  keyState.textContent = hasKey
    ? "มี API key แล้ว งานที่ต้องคลิกบนจอใช้คีย์นี้"
    : "ยังไม่มี API key คำสั่งเปิด YouTube หรือเปิดโปรแกรมใช้ได้เลย";
}

async function start() {
  confirmBox.classList.add("hidden");
  const text = command.value.trim();
  const plan = await window.buddy.classifyDo(text);
  if (plan.kind === "empty") {
    append("พิมพ์คำสั่งก่อน");
    return;
  }
  if (plan.kind === "direct") {
    append(plan.action.summary);
    run.disabled = true;
    try {
      const result = await window.buddy.runDirect(text);
      append(result.message);
    } catch (error) {
      append(error?.message || String(error));
    } finally {
      run.disabled = false;
    }
    return;
  }
  confirmText.textContent = `${plan.summary} คิดเงินตามจำนวนรอบที่โมเดลดูจอ`;
  confirmBox.classList.remove("hidden");
}

async function confirmAgent() {
  confirmBox.classList.add("hidden");
  run.disabled = true;
  append("เริ่มทำให้");
  try {
    await window.buddy.runAgent(command.value.trim());
  } catch (error) {
    append(error?.message || String(error));
  } finally {
    run.disabled = false;
  }
}

function append(line) {
  const item = document.createElement("p");
  item.textContent = line;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
}
