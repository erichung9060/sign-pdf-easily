const STORAGE_KEY = "saved_signatures";
const MAX_SIGNATURES = 10;

export interface SavedSignature {
  id: string;
  dataUrl: string;
  timestamp: number;
  name?: string;
}

export const signatureStorage = {
  getSavedSignatures(): SavedSignature[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error("Failed to load signatures:", error);
      return [];
    }
  },

  saveSignature(dataUrl: string): void {
    try {
      const signatures = this.getSavedSignatures();
      const newSignature: SavedSignature = {
        id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        dataUrl,
        timestamp: Date.now(),
      };

      // Add to the beginning and limit to MAX_SIGNATURES
      const updatedSignatures = [newSignature, ...signatures].slice(0, MAX_SIGNATURES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSignatures));
    } catch (error) {
      console.error("Failed to save signature:", error);
    }
  },

  deleteSignature(id: string): void {
    try {
      const signatures = this.getSavedSignatures();
      const filtered = signatures.filter((sig: SavedSignature) => sig.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error("Failed to delete signature:", error);
    }
  },

  updateSignature(id: string): void {
    try {
      const signatures = this.getSavedSignatures();
      const selectedSignature = signatures.find((sig: SavedSignature) => sig.id === id);
      if (!selectedSignature) return;

      const updatedSignatures = [
        selectedSignature,
        ...signatures.filter((sig: SavedSignature) => sig.id !== id),
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSignatures));
    } catch (error) {
      console.error("Failed to move signature to front:", error);
    }
  },

  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear signatures:", error);
    }
  },
};
