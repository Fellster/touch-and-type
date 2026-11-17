import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type FeedbackMessage = { id: string; text: string; tone: "info" | "error" };

/** One unobtrusive message, outside page flow and inside any active modal's top layer. */
export default function Feedback({ message, dismiss }: { message: FeedbackMessage | null; dismiss: () => void }) {
  const [host, setHost] = useState<Element>(document.body);
  const close = useRef(dismiss);
  close.current = dismiss;
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const stop = () => clearTimeout(timer.current);
  const start = () => {
    stop();
    if (message?.tone === "info" && document.visibilityState === "visible")
      timer.current = setTimeout(() => close.current(), message.text.length > 90 ? 7000 : 4000);
  };
  useEffect(() => {
    const chooseHost = () => {
      const dialogs = document.querySelectorAll("dialog[open]");
      setHost(dialogs[dialogs.length - 1] || document.body);
    };
    chooseHost();
    const observer = new MutationObserver(chooseHost);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    start();
    document.addEventListener("visibilitychange", start);
    document.addEventListener("resume", start);
    window.addEventListener("focus", start);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", start);
      document.removeEventListener("resume", start);
      window.removeEventListener("focus", start);
    };
  }, [message?.id]);
  if (!message) return null;
  return createPortal(
    <div className="noted-toast" data-tone={message.tone} role={message.tone === "error" ? "alert" : "status"} aria-atomic="true"
      onPointerEnter={stop} onPointerLeave={start} onFocus={stop} onBlur={start}>
      <span>{message.text}</span>
      <button type="button" aria-label="Dismiss message" onClick={() => close.current()}><X size={16} /></button>
    </div>, host,
  );
}
