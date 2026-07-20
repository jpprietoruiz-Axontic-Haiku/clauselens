import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CitationSource } from "@/lib/chat-types";

interface CitationDialogProps {
  source: CitationSource | null;
  onOpenChange: (open: boolean) => void;
}

export function CitationDialog({ source, onOpenChange }: CitationDialogProps) {
  return (
    <Dialog open={source !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{source?.documentTitle}</DialogTitle>
          <DialogDescription>
            {[source?.articleRef, source?.page !== null && source?.page !== undefined ? `p. ${source.page}` : null]
              .filter(Boolean)
              .join(" — ")}
          </DialogDescription>
        </DialogHeader>
        <p className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
          {source?.content}
        </p>
        {source?.sourceUrl && (
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline underline-offset-4"
          >
            Ver fuente original
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
