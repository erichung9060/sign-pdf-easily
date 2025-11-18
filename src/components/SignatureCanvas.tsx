import { useRef, useState, useEffect } from "react";
import SignatureCanvasPad from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eraser, Check, X, History, Trash2 } from "lucide-react";
import { signatureStorage, SavedSignature } from "@/lib/signatureStorage";
import { toast } from "sonner";

interface SignatureCanvasProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel: () => void;
}

export const SignatureCanvas = ({ onSave, onCancel }: SignatureCanvasProps) => {
  const sigCanvas = useRef<SignatureCanvasPad>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // Load saved signatures
    setSavedSignatures(signatureStorage.getSavedSignatures());
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (sigCanvas.current) {
        const canvas = sigCanvas.current.getCanvas();
        const signaturePad = sigCanvas.current;

        const data = signaturePad.toData();

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);

        signaturePad.fromData(data);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL("image/png");
      signatureStorage.saveSignature(dataUrl);
      onSave(dataUrl);
    }
  };

  const handleSelectSignature = (signature: SavedSignature) => {
    signatureStorage.updateSignature(signature.id);
    onSave(signature.dataUrl);
  };

  const handleDeleteSignature = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    signatureStorage.deleteSignature(id);
    setSavedSignatures(signatureStorage.getSavedSignatures());
    toast.success("Signature deleted");
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4 max-w-2xl w-full mx-auto border-2 shadow-xl">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-semibold text-foreground">Draw Your Signature</h3>
          {savedSignatures.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">More ({savedSignatures.length - 1})</span>
              <span className="sm:hidden">{savedSignatures.length - 1}</span>
            </Button>
          )}
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {savedSignatures.length > 0
            ? "Use your previous signature or draw a new one"
            : "Draw your signature in the white area below"}
        </p>
      </div>

      {savedSignatures.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Recent Signature:</span>
          </div>
          <div
            className="relative group cursor-pointer border-2 border-border hover:border-primary rounded-lg p-3 bg-white transition-all w-full sm:w-64"
            onClick={() => handleSelectSignature(savedSignatures[0])}
          >
            <img
              src={savedSignatures[0].dataUrl}
              alt="Recent signature"
              className="w-full h-20 object-contain"
            />
            <button
              onClick={(e) => handleDeleteSignature(savedSignatures[0].id, e)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg"
            >
              <Trash2 className="w-3 h-3 text-destructive-foreground" />
            </button>
          </div>
        </div>
      )}

      {showHistory && savedSignatures.length > 1 && (
        <div className="space-y-3">
          <span className="text-sm font-medium text-muted-foreground">Older Signatures:</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-muted rounded-lg">
            {savedSignatures.slice(1).map((signature) => (
              <div
                key={signature.id}
                className="relative group cursor-pointer border-2 border-border hover:border-primary rounded-lg p-2 bg-white transition-all"
                onClick={() => handleSelectSignature(signature)}
              >
                <img
                  src={signature.dataUrl}
                  alt="Saved signature"
                  className="w-full h-20 object-contain"
                />
                <button
                  onClick={(e) => handleDeleteSignature(signature.id, e)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg"
                >
                  <Trash2 className="w-3 h-3 text-destructive-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-2 border-border rounded-lg overflow-hidden bg-white shadow-inner">
        <SignatureCanvasPad
          ref={sigCanvas}
          canvasProps={{
            className: "w-full h-48 sm:h-64 cursor-crosshair",
          }}
          onEnd={() => setIsEmpty(false)}
          clearOnResize={false}
          penColor="rgb(0, 0, 0)"
          minWidth={1.5}
          maxWidth={3}
          velocityFilterWeight={0.7}
          throttle={16}
        />
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-3 justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          className="gap-2 flex-1 sm:flex-none min-w-0"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Cancel</span>
        </Button>
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isEmpty}
          className="gap-2 flex-1 sm:flex-none min-w-0"
        >
          <Eraser className="w-4 h-4" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
        <Button
          onClick={handleSave}
          disabled={isEmpty}
          className="gap-2 bg-gradient-to-r from-accent to-accent/80 hover:opacity-90 flex-1 sm:flex-none min-w-0"
        >
          <Check className="w-4 h-4" />
          <span className="hidden sm:inline">Confirm</span>
        </Button>
      </div>
    </Card>
  );
};
