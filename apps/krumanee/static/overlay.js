const dot = document.getElementById("dot");
const pointer = document.getElementById("pointer");
const label = document.getElementById("label");
let buddyOn = true;
let pointQueue = [];
let flying = false;

window.buddy.onConfig((cfg) => {
  buddyOn = cfg.enabled;
  dot.style.display = buddyOn ? "block" : "none";
});

window.buddy.onMouse((pt) => {
  if (!buddyOn) return;
  dot.style.display = "block";
  dot.style.left = `${pt.x}px`;
  dot.style.top = `${pt.y}px`;
});

window.buddy.onPoints((points) => {
  pointQueue = points.slice();
  if (!flying) void playPoints();
});

async function playPoints() {
  flying = true;
  pointer.style.display = "block";
  label.style.display = "block";
  while (pointQueue.length) {
    const next = pointQueue.shift();
    pointer.style.left = `${next.x}px`;
    pointer.style.top = `${next.y}px`;
    label.style.left = `${next.x}px`;
    label.style.top = `${next.y}px`;
    label.textContent = next.label || "";
    await wait(900);
  }
  await wait(1600);
  pointer.style.display = "none";
  label.style.display = "none";
  flying = false;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
