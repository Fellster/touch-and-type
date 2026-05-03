import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, Pencil, Undo2, Trash2, Save, Sparkles, X } from "lucide-react";

type Props = {
  onSave: (blob: Blob) => Promise<void>;
  onCancel: () => void;
  onOcr?: (dataUrl: string) => Promise<void>;
};

export default function DrawingCanvas({ onSave, onCancel, onOcr }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#2a2520");
  const [size, setSize] = useState([3]);
  const [busy, setBusy] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth, h = 360;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    pushHistory();
  }, []);

  const pushHistory = () => {
    const ctx = canvasRef.current!.getContext("2d")!;
    history.current.push(ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height));
    if (history.current.length > 30) history.current.shift();
  };

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    pushHistory();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? size[0] * 4 : size[0];
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => { drawing.current = false; last.current = null; };

  const undo = () => {
    if (history.current.length < 2) return;
    history.current.pop();
    const prev = history.current[history.current.length - 1];
    canvasRef.current!.getContext("2d")!.putImageData(prev, 0, 0);
  };
  const clear = () => {
    pushHistory();
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  };

  const save = async () => {
    setBusy(true);
    canvasRef.current!.toBlob(async (b) => {
      if (b) await onSave(b);
      setBusy(false);
    }, "image/png");
  };

  const ocrNow = async () => {
    if (!onOcr) return;
    setBusy(true);
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    await onOcr(dataUrl);
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tool === "pen" ? "default" : "outline"} onClick={() => setTool("pen")}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="sm" variant={tool === "eraser" ? "default" : "outline"} onClick={() => setTool("eraser")}>
          <Eraser className="h-4 w-4" />
        </Button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 rounded border" aria-label="Pen color" />
        <div className="flex-1 min-w-[120px] px-2">
          <Slider value={size} onValueChange={setSize} min={1} max={20} step={1} />
        </div>
        <Button size="sm" variant="outline" onClick={undo}><Undo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={clear}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="border rounded-lg bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="block"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-1" />Save drawing</Button>
        {onOcr && (
          <Button variant="secondary" onClick={ocrNow} disabled={busy}>
            <Sparkles className="h-4 w-4 mr-1" />Save & transcribe
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}><X className="h-4 w-4 mr-1" />Cancel</Button>
      </div>
    </div>
  );
}
