import { Capacitor, registerPlugin } from "@capacitor/core";
interface NativeSpeech {
  listen(): Promise<{ text: string }>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
}
const nativeSpeech = registerPlugin<NativeSpeech>("NotedSpeech");
export type SpeechSession = { result: Promise<string>; stop: () => void; cancel: () => void };
type WebRecognizer = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  start: () => void; stop: () => void; abort: () => void;
};
export function startDictation(): SpeechSession {
  if (Capacitor.getPlatform() === "android") return {
    result: nativeSpeech.listen().then(({ text }) => text.trim()),
    stop: () => { void nativeSpeech.stop().catch(() => {}); },
    cancel: () => { void nativeSpeech.cancel().catch(() => {}); },
  };
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognizer; webkitSpeechRecognition?: new () => WebRecognizer };
  const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Constructor) throw new Error("Voice input isn't available here. Use the microphone on your keyboard or type instead.");
  if (!navigator.onLine) throw new Error("Browser dictation may require internet. Use keyboard dictation, or the Android version for on-device speech.");
  const recognition = new Constructor();
  recognition.lang = navigator.language || "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  let timer: ReturnType<typeof setTimeout>;
  let cancel: () => void = () => {};
  const result = new Promise<string>((resolve, reject) => {
    let transcript = "", settled = false;
    const finish = (error?: string) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(new Error(error)); else resolve(transcript.trim());
    };
    recognition.onresult = event => { transcript = Array.from(event.results).filter(r => r.isFinal).map(r => r[0].transcript).join(" "); };
    recognition.onerror = event => finish({
      "not-allowed": "Allow microphone access in browser settings, or use keyboard dictation.",
      "audio-capture": "No microphone is available. Check microphone permission.",
      "network": "Speech recognition could not connect. You can still type or use keyboard dictation.",
      "no-speech": "No speech detected. Try again or type your entry.",
      "aborted": "Dictation canceled.",
    }[event.error] || "Dictation didn't complete. Try again or type your entry.");
    recognition.onend = () => finish();
    cancel = () => { finish("Dictation canceled."); recognition.abort(); };
    timer = setTimeout(() => { finish("Dictation timed out. Try a shorter entry."); recognition.abort(); }, 60000);
    try { recognition.start(); } catch (e) { finish(e instanceof Error ? e.message : "Could not start dictation."); }
  });
  return { result, stop: () => recognition.stop(), cancel: () => cancel() };
}
