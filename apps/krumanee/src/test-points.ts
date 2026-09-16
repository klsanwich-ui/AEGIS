import { parsePointTags, stripPointTags } from "./shared/types";

const sample =
  "กดปุ่มนี้ [POINT:12.5, 40:บันทึก] แล้วดูมุมขวา [POINT:90,10:เมนู]";

const points = parsePointTags(sample);
if (points.length !== 2) throw new Error(`expected 2 points, got ${points.length}`);
if (points[0].x !== 12.5 || points[0].label !== "บันทึก") {
  throw new Error(`bad first point ${JSON.stringify(points[0])}`);
}
const spoken = stripPointTags(sample);
if (spoken.includes("[POINT")) throw new Error(`tags leaked: ${spoken}`);
if (!spoken.includes("กดปุ่มนี้")) throw new Error(`lost text: ${spoken}`);

const clamped = parsePointTags("[POINT:140,-5:x]");
if (clamped[0].x !== 100 || clamped[0].y !== 0) {
  throw new Error(`clamp failed ${JSON.stringify(clamped[0])}`);
}

console.log("point tag tests ok");
