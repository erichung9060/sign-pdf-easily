import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Copy, Check, FileSignature, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import supabase from "@/integrations/supabase/client";

export const SharePage = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        setDocument(data);
      } catch (error) {
        toast.error("Document not found");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [shareId, navigate]);

  const shareUrl = `${window.location.origin}/sign/${shareId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Copy failed, please copy manually");
    }
  };

  const handleOpenLink = () => {
    window.open(shareUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity"
        >
          <FileSignature className="w-8 h-8" />
          <span className="font-bold text-xl">Sign PDF Easily</span>
        </button>
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
            File Uploaded Successfully!
          </h1>
          <p className="text-muted-foreground text-lg">
            Copy the link below and share it with those who need to sign
          </p>
        </div>

        <Card className="p-8 space-y-6 shadow-xl border-2">
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              File Name
            </label>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-mono text-foreground">{document?.file_name}</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 p-4 bg-muted border border-border rounded-lg font-mono text-sm text-foreground"
              />
              <Button
                onClick={handleOpenLink}
                variant="outline"
                className="gap-2 border-2 h-auto py-4"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </Button>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="gap-2 border-2 h-auto py-4"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              ⏰ This file will be automatically deleted after 14 days
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
