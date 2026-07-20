import Link from "next/link";
import { Chat } from "@/components/chat/chat";

export default function Home() {
  return (
    <div className="flex h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">ClauseLens</h1>
          <p className="text-xs text-muted-foreground">
            Regulatory Q&A (GDPR, EU AI Act) with citations anchored to the exact article.
          </p>
        </div>
        <Link href="/eval" className="text-xs text-muted-foreground underline underline-offset-4">
          Evaluation dashboard
        </Link>
      </header>
      <div className="min-h-0 flex-1">
        <Chat />
      </div>
    </div>
  );
}
