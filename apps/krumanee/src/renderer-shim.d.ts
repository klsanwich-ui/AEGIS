export {};

declare global {
  interface Window {
    buddy: {
      getSettings: () => Promise<Record<string, unknown>>;
      saveSettings: (next: Record<string, unknown>) => Promise<Record<string, unknown>>;
      submitAsk: (question: string) => Promise<{
        text: string;
        spokenText: string;
        points: Array<{ x: number; y: number; label: string }>;
        audioBase64?: string;
        ttsEnabled: boolean;
      }>;
      transcribe: (base64: string, mimeType: string) => Promise<string>;
      closeAsk: () => void;
      onAskReady: (cb: (state: { micEnabled: boolean; hasKey: boolean }) => void) => void;
      onMouse: (cb: (pt: { x: number; y: number }) => void) => void;
      onPoints: (
        cb: (points: Array<{ x: number; y: number; label: string }>) => void,
      ) => void;
      onConfig: (cb: (cfg: { enabled: boolean }) => void) => void;
    };
  }
}
