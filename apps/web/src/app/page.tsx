import { Chat } from "@/components/chat/chat";

export default function Home() {
  return (
    <div className="flex h-svh flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">ClauseLens</h1>
        <p className="text-xs text-muted-foreground">
          Consulta normativa (GDPR, EU AI Act) con citas ancladas al artículo exacto.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <Chat />
      </div>
    </div>
  );
}
