import { useRef, useState, useEffect, useCallback } from "react";
import { Pen, Eraser, Check, X, Loader2 } from "lucide-react";

export default function SignaturePad({
  onSave,
  onCancel,
  saving = false,
  title = "Digital Signature",
  width = 500,
  height = 180,
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [penColor, setPenColor] = useState("#1e293b");
  const [penSize, setPenSize] = useState(2.5);

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const getCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const coords = getCoordinates(e.touches ? e.touches[0] : e);
    const ctx = getCanvasContext();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawing(true);
    setHasSignature(true);
  }, [getCanvasContext, getCoordinates, penColor, penSize]);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const coords = getCoordinates(e.touches ? e.touches[0] : e);
    const ctx = getCanvasContext();
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  }, [isDrawing, getCanvasContext, getCoordinates]);

  const stopDrawing = useCallback(() => {
    const ctx = getCanvasContext();
    if (ctx && isDrawing) ctx.closePath();
    setIsDrawing(false);
  }, [getCanvasContext, isDrawing]);

  const clearCanvas = useCallback(() => {
    const ctx = getCanvasContext();
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    setHasSignature(false);
  }, [getCanvasContext, width, height]);

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const dataUrl = canvas.toDataURL("image/png");
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `signature-${Date.now()}.png`, { type: "image/png" });
    onSave(file);
  }, [hasSignature, onSave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }, [width, height]);

  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Pen className="w-4 h-4 text-primary" />
          {title}
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setPenColor("#1e293b")}
              className={`w-5 h-5 rounded ${penColor === "#1e293b" ? "ring-2 ring-primary ring-offset-1" : ""}`}
              style={{ backgroundColor: "#1e293b" }}
              title="Black"
            />
            <button
              onClick={() => setPenColor("#2563eb")}
              className={`w-5 h-5 rounded ${penColor === "#2563eb" ? "ring-2 ring-primary ring-offset-1" : ""}`}
              style={{ backgroundColor: "#2563eb" }}
              title="Blue"
            />
          </div>
          <select
            className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
            value={penSize}
            onChange={e => setPenSize(Number(e.target.value))}
          >
            <option value={1.5}>Thin</option>
            <option value={2.5}>Medium</option>
            <option value={4}>Thick</option>
          </select>
          <button
            onClick={clearCanvas}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
            title="Clear"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative bg-white rounded-lg border border-border overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: `${height}px`, maxWidth: "100%" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-muted-foreground/50 select-none">Sign here</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-muted-foreground">
          {hasSignature ? "Signature captured" : "Draw your signature above"}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasSignature || saving}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 shadow-sm"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {saving ? "Saving..." : "Sign Document"}
          </button>
        </div>
      </div>
    </div>
  );
}