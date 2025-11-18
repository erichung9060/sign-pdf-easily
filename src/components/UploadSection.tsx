import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import supabase from "@/integrations/supabase/client";

export const UploadSection = () => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size cannot exceed 15MB");
      return;
    }

    setUploading(true);

    try {
      const shareId = nanoid(16);
      const sharedFileName = `d${shareId}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(sharedFileName, file);

      if (uploadError) {
        if (uploadError.message.includes('policy')) {
          toast.error("You have reached today's upload limit (10 times), please try again tomorrow");
          return;
        }
        throw uploadError;
      }

      const { error: dbError } = await supabase
        .from("documents")
        .insert({
          share_id: shareId,
          file_name: file.name,
          file_path: sharedFileName,
        });

      if (dbError) throw dbError;

      toast.success("File uploaded successfully!");
      navigate(`/share/${shareId}`);
    } catch (error) {
      toast.error("Upload failed, please try again. " + error.toString());
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <Card
      className={`relative overflow-hidden border-2 border-dashed transition-all duration-300 ${
        dragActive
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-border hover:border-primary/50"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="p-12 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div
            className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"
            style={{ animationDuration: "3s" }}
          />
          <div className="relative bg-gradient-to-br from-primary to-primary-glow p-6 rounded-2xl">
            {uploading ? (
              <Loader2 className="w-12 h-12 text-primary-foreground animate-spin" />
            ) : (
              <Upload className="w-12 h-12 text-primary-foreground" />
            )}
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-foreground">
            Upload PDF File
          </h3>
          <p className="text-muted-foreground max-w-md">
            Drag and drop files here, or click the button below to select files. Files will be securely stored for 14 days.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Button
            variant="default"
            size="lg"
            disabled={uploading}
            onClick={() => document.getElementById("file-upload")?.click()}
            className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity"
          >
            <FileText className="w-5 h-5 mr-2" />
            Select File
          </Button>
          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            onChange={handleChange}
            className="hidden"
          />
          <span className="text-sm text-muted-foreground">
            Maximum file size: 15MB
          </span>
        </div>
      </div>
    </Card>
  );
};
