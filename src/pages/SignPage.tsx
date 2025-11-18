import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { toast } from "sonner";
import { Download, PenTool, Loader2, X, FileSignature } from "lucide-react";
import supabase from "@/integrations/supabase/client";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface Signature {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export const SignPage = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [numPages, setNumPages] = useState<number>(0);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    const fetchDocument = async () => {
      if (!shareId) return;

      try {
        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .eq("share_id", shareId)
          .single();

        if (error) throw error;

        const { data: fileData } = await supabase.storage
          .from("pdfs")
          .createSignedUrl(data.file_path, 3600);

        if (fileData) {
          setPdfUrl(fileData.signedUrl);
        }

        setPdfDocument(data);
      } catch (error) {
        toast.error("Document not found");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [shareId, navigate]);

  const applySignaturesToPdf = async () => {
    const existingPdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    for (const signature of signatures) {
      const page = pages[signature.page - 1];
      const signatureImageBytes = await fetch(signature.dataUrl).then((res) =>
        res.arrayBuffer()
      );
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
      const { width: pdfWidth, height: pdfHeight } = page.getSize();

      const pageElement = pageRefs.current.get(signature.page);

      let renderedWidth = 0;
      let renderedHeight = 0;

      if (pageElement) {
        const canvas = pageElement.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
        const pageDiv = pageElement.querySelector('.react-pdf__Page') as HTMLDivElement;

        if (canvas && canvas.clientWidth > 0) {
          renderedWidth = canvas.clientWidth;
          renderedHeight = canvas.clientHeight;
        } else if (pageDiv && pageDiv.clientWidth > 0) {
          renderedWidth = pageDiv.clientWidth;
          renderedHeight = pageDiv.clientHeight;
        } else if (pageElement.clientWidth > 0) {
          renderedWidth = pageElement.clientWidth;
          renderedHeight = pageElement.clientHeight;
        }
      }

      if (renderedWidth === 0 || renderedHeight === 0) {
        renderedWidth = pdfWidth;
        renderedHeight = pdfHeight;
      }

      const scaleX = pdfWidth / renderedWidth;
      const scaleY = pdfHeight / renderedHeight;

      page.drawImage(signatureImage, {
        x: signature.x * scaleX,
        y: pdfHeight - (signature.y * scaleY) - (signature.height * scaleY),
        width: signature.width * scaleX,
        height: signature.height * scaleY,
      });
    }

    return await pdfDoc.save();
  };

  const handleSaveSignatures = async () => {
    if (!shareId || signatures.length === 0) {
      toast.error("No signatures to save");
      return;
    }

    try {
      const pdfBytes = await applySignaturesToPdf();

      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .update(pdfDocument.file_path, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      setSignatures([]);

      const { data: newFileData } = await supabase.storage
        .from("pdfs")
        .createSignedUrl(pdfDocument.file_path, 3600);

      if (newFileData) {
        setPdfUrl(newFileData.signedUrl);
      }

      toast.success("Signatures saved!");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Save failed: ${error.message}`);
      } else {
        toast.error("Save failed, please try again");
      }
    }
  };

  const handleSignatureSave = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const initialHeight = 100;
      const initialWidth = initialHeight * aspectRatio;

      const newSignature = {
        dataUrl,
        x: 100,
        y: 100,
        width: initialWidth,
        height: initialHeight,
        page: 1,
      };
      setSignatures([...signatures, newSignature]);
      setSelectedIndex(signatures.length);
      setShowSignatureCanvas(false);
      toast.success("Signature added, you can drag to adjust position");
    };
    img.src = dataUrl;
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (draggingIndex !== null) {
        setIsDragging(true);
        setSignatures((prev) => {
          const sig = prev[draggingIndex];
          if (!sig) return prev;

          let targetPage = sig.page;
          let targetX = sig.x;
          let targetY = sig.y;

          for (const [pageNum, pageElement] of pageRefs.current.entries()) {
            const rect = pageElement.getBoundingClientRect();
            if (
              clientY >= rect.top &&
              clientY <= rect.bottom &&
              clientX >= rect.left &&
              clientX <= rect.right
            ) {
              targetPage = pageNum;
              targetX = clientX - rect.left - dragOffset.x;
              targetY = clientY - rect.top - dragOffset.y;
              break;
            }
          }

          return prev.map((s, i) =>
            i === draggingIndex ? { ...s, x: targetX, y: targetY, page: targetPage } : s
          );
        });
      }

      if (resizingIndex !== null) {
        setSignatures((prev) => {
          const sig = prev[resizingIndex];
          if (!sig) return prev;

          const deltaX = clientX - resizeStart.x;
          const aspectRatio = resizeStart.width / resizeStart.height;

          let newWidth = resizeStart.width + deltaX;
          let newHeight = newWidth / aspectRatio;

          if (newWidth < 50) {
            newWidth = 50;
            newHeight = newWidth / aspectRatio;
          }

          return prev.map((s, i) =>
            i === resizingIndex ? { ...s, width: newWidth, height: newHeight } : s
          );
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIndex === null && resizingIndex === null) return;
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (draggingIndex === null && resizingIndex === null) return;
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const handleEnd = () => {
      setDraggingIndex(null);
      setResizingIndex(null);
      setTimeout(() => setIsDragging(false), 50);
    };

    if (draggingIndex !== null || resizingIndex !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [draggingIndex, resizingIndex, dragOffset, resizeStart]);

  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sig = signatures[index];
    const pageElement = pageRefs.current.get(sig.page);
    if (!pageElement) return;

    const rect = pageElement.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - sig.x;
    const offsetY = e.clientY - rect.top - sig.y;

    setDragOffset({ x: offsetX, y: offsetY });
    setDraggingIndex(index);
  };

  const handleSignatureClick = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isDragging) {
      setSelectedIndex(index);
    }
  };

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedIndex(index);

    const sig = signatures[index];
    const pageElement = pageRefs.current.get(sig.page);
    if (!pageElement) return;

    const touch = e.touches[0];
    const rect = pageElement.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left - sig.x;
    const offsetY = touch.clientY - rect.top - sig.y;

    setDragOffset({ x: offsetX, y: offsetY });
    setDraggingIndex(index);
  };

  const handleResizeMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sig = signatures[index];
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: sig.width,
      height: sig.height,
    });
    setResizingIndex(index);
  };

  const handleResizeTouchStart = (index: number, e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const sig = signatures[index];
    setResizeStart({
      x: touch.clientX,
      y: touch.clientY,
      width: sig.width,
      height: sig.height,
    });
    setResizingIndex(index);
  };

  const handleDeleteSignature = (index: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setSignatures((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(null);
    toast.success("Signature deleted");
  };

  const handleContainerClick = () => {
    setSelectedIndex(null);
  };

  const handleDownloadClick = () => {
    if (!pdfUrl) {
      toast.error("PDF not loaded yet");
      return;
    }

    if (signatures.length > 0) {
      toast.error("You have unsaved signatures, please click the 'Save' button first");
      return;
    }

    setShowDownloadDialog(true);
  };

  const handleDownload = async (deleteAfter: boolean) => {
    setShowDownloadDialog(false);
    setDownloading(true);

    try {
      const response = await fetch(pdfUrl);
      const arrayBuffer = await response.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = pdfDocument?.file_name || "document.pdf";
      link.click();
      URL.revokeObjectURL(url);

      if (deleteAfter && pdfDocument?.file_path) {
        const { error: deleteDbError } = await supabase
          .from("documents")
          .delete()
          .eq("share_id", shareId);

        if (deleteDbError) {
          toast.error("Delete failed, please try again");
          return;
        }

        const { error: deleteStorageError } = await supabase.storage
          .from("pdfs")
          .remove([pdfDocument.file_path]);

        if (deleteStorageError) {
          toast.error("Failed to delete file, please try again");
          return;
        }

        toast.success("PDF downloaded, file deleted!");
        setTimeout(() => navigate("/"), 1500);
      } else {
        toast.success("PDF downloaded!");
      }
    } catch (error) {
      toast.error("Download failed, please try again");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity mb-4"
        >
          <FileSignature className="w-8 h-8" />
          <span className="font-bold text-xl">Sign PDF Easily</span>
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-xl shadow-lg border-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {pdfDocument?.file_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Add Signature" to start signing the document
            </p>
          </div>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Button
              onClick={() => setShowSignatureCanvas(true)}
              className="gap-2 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 flex-1 sm:flex-none"
            >
              <PenTool className="w-4 h-4" />
              Add Signature
            </Button>
            <Button
              onClick={handleSaveSignatures}
              disabled={signatures.length === 0}
              variant="outline"
              className="gap-2 border-2 flex-1 sm:flex-none"
            >
              Save
            </Button>
            <Button
              onClick={handleDownloadClick}
              disabled={downloading}
              variant="outline"
              className="gap-2 border-2 flex-1 sm:flex-none"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        {showSignatureCanvas && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
            <div className="w-full my-auto">
              <SignatureCanvas
                onSave={handleSignatureSave}
                onCancel={() => setShowSignatureCanvas(false)}
              />
            </div>
          </div>
        )}

        {showDownloadDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card p-6 rounded-xl shadow-xl border-2 max-w-md w-full space-y-4">
              <h2 className="text-xl font-bold text-foreground">Download PDF</h2>
              <p className="text-sm text-muted-foreground">
                How would you like to handle this file after downloading?
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  onClick={() => handleDownload(false)}
                  disabled={downloading}
                  className="w-full gap-2 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download (Keep File)
                </Button>
                <Button
                  onClick={() => handleDownload(true)}
                  disabled={downloading}
                  variant="outline"
                  className="w-full gap-2 border-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download (Delete File)
                </Button>
                <Button
                  onClick={() => setShowDownloadDialog(false)}
                  variant="ghost"
                  className="w-full"
                  disabled={downloading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          className="relative bg-card rounded-xl shadow-xl border-2 p-8 overflow-auto"
          onClick={handleContainerClick}
        >
          {pdfUrl && (
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              className="flex flex-col gap-4 mx-auto w-fit"
            >
              {Array.from(new Array(numPages), (_, index) => (
                <div
                  key={`page_${index + 1}`}
                  className="relative shadow-lg mx-auto"
                  ref={(el) => el && pageRefs.current.set(index + 1, el)}
                  onClick={handleContainerClick}
                >
                  <Page
                    pageNumber={index + 1}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="border border-border rounded-lg overflow-hidden"
                  />
                  {signatures
                    .map((sig: Signature, globalIndex: number) => ({ sig, globalIndex }))
                    .filter(({ sig }: { sig: Signature }) => sig.page === index + 1)
                    .map(({ sig, globalIndex }: { sig: Signature; globalIndex: number }) => (
                      <div
                        key={globalIndex}
                        className="absolute group"
                        style={{
                          left: sig.x,
                          top: sig.y,
                          width: sig.width,
                          height: sig.height,
                          zIndex: 10,
                        }}
                      >
                        <img
                          src={sig.dataUrl}
                          alt="Signature"
                          className={`absolute inset-0 w-full h-full cursor-move rounded ${
                            selectedIndex === globalIndex ? 'border-2 border-primary' : 'border-2 border-transparent'
                          }`}
                          style={{
                            userSelect: 'none',
                            pointerEvents: 'auto',
                            touchAction: 'none',
                          }}
                          onMouseDown={(e) => handleMouseDown(globalIndex, e)}
                          onClick={(e) => handleSignatureClick(globalIndex, e)}
                          onTouchStart={(e) => handleTouchStart(globalIndex, e)}
                          draggable={false}
                        />
                        {selectedIndex === globalIndex && (
                          <>
                            <button
                              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full cursor-pointer border-2 border-white shadow-lg flex items-center justify-center hover:bg-destructive/90"
                              style={{
                                pointerEvents: 'auto',
                              }}
                              onClick={(e) => handleDeleteSignature(globalIndex, e)}
                              onTouchEnd={(e) => handleDeleteSignature(globalIndex, e)}
                            >
                              <X className="w-3 h-3 text-destructive-foreground" />
                            </button>
                            <div
                              className="absolute -bottom-2 -right-2 w-6 h-6 bg-primary rounded-full cursor-nwse-resize border-2 border-white shadow-lg"
                              style={{
                                pointerEvents: 'auto',
                                touchAction: 'none',
                              }}
                              onMouseDown={(e) => handleResizeMouseDown(globalIndex, e)}
                              onTouchStart={(e) => handleResizeTouchStart(globalIndex, e)}
                            />
                          </>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
};
