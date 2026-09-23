import { classifyCommand, parseAgentReply } from "./shared/actions";

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

const notepad = classifyCommand("เปิดโน้ตแพด");
assert(notepad.kind === "direct" && notepad.action.type === "open-app" && notepad.action.app === "notepad", "notepad");

const youtubeTypo = classifyCommand("เปิด youtub");
assert(
  youtubeTypo.kind === "direct" &&
    youtubeTypo.action.type === "open-url" &&
    youtubeTypo.action.url === "https://www.youtube.com",
  "youtub typo",
);

const youtube = classifyCommand("เปิดยูทูบ");
assert(youtube.kind === "direct" && youtube.action.type === "open-url", "thai youtube");

const multi = classifyCommand("เปิดโน้ตแพดแล้วพิมพ์สวัสดี");
assert(multi.kind === "agent", "multi-step should use the screen");

const empty = classifyCommand("   ");
assert(empty.kind === "empty", "empty");

console.log("action tests ok");
