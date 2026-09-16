import { desktopCapturer, screen, NativeImage } from "electron";

export interface CaptureResult {
  dataUrl: string;
  displayBounds: { x: number; y: number; width: number; height: number };
  cursor: { x: number; y: number };
}

const MAX_WIDTH = 1280;

export async function captureActiveDisplay(): Promise<CaptureResult> {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
  });

  const match =
    sources.find((source) => source.display_id === String(display.id)) ??
    sources[0];
  if (!match) {
    throw new Error("ไม่พบหน้าจอสำหรับถ่ายภาพ");
  }

  const resized = shrink(match.thumbnail, MAX_WIDTH);
  return {
    dataUrl: resized.toDataURL(),
    displayBounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
    },
    cursor,
  };
}

function shrink(image: NativeImage, maxWidth: number): NativeImage {
  const size = image.getSize();
  if (size.width <= maxWidth) {
    return image;
  }
  const height = Math.round((size.height * maxWidth) / size.width);
  return image.resize({ width: maxWidth, height, quality: "good" });
}
