import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listEvalRunSummaries, type EvalRunSummary } from "@/lib/eval-queries";

// The dashboard queries Postgres on every visit: no point prerendering it
// at build time (and it wouldn't be possible without a DB available there).
export const dynamic = "force-dynamic";

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function TrendIndicator({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) return null;
  const deltaPoints = (current - previous) * 100;
  if (Math.abs(deltaPoints) < 1) {
    return <span className="ml-1 text-xs text-muted-foreground">=</span>;
  }
  const improved = deltaPoints > 0;
  return (
    <span className={`ml-1 text-xs ${improved ? "text-green-600" : "text-red-600"}`}>
      {improved ? "↑" : "↓"} {Math.abs(deltaPoints).toFixed(1)}pp
    </span>
  );
}

export default async function EvalPage() {
  // Same as /api/chat: a DB failure shouldn't take down the page with
  // Next's generic error page — an explicit state is shown instead.
  let runs: EvalRunSummary[];
  let loadError: string | null = null;
  try {
    runs = await listEvalRunSummaries();
  } catch (error) {
    runs = [];
    loadError = error instanceof Error ? error.message : "Unknown error loading eval runs.";
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Evaluation dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each run executes the full golden set against the retrieval + generation pipeline and
        measures faithfulness, answer relevancy (LLM-as-judge) and context precision (heuristic) —
        see{" "}
        <code className="rounded bg-muted px-1 py-0.5">
          packages/core/src/eval/
        </code>
        . Compared against the immediately preceding run.
      </p>

      {loadError ? (
        <p className="mt-8 text-sm text-destructive">Could not load eval runs: {loadError}</p>
      ) : runs.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No eval runs yet. Run <code className="rounded bg-muted px-1 py-0.5">npm run eval</code>{" "}
          to generate the first one.
        </p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Faithfulness</TableHead>
              <TableHead>Answer relevancy</TableHead>
              <TableHead>Context precision</TableHead>
              <TableHead>Avg latency</TableHead>
              <TableHead>Total cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run, index) => {
              const previous = runs[index + 1];
              return (
                <TableRow key={run.id}>
                  <TableCell>
                    <div className="font-mono text-xs">{run.gitSha.slice(0, 7)}</div>
                    <div className="text-xs text-muted-foreground">{run.createdAt.toLocaleString("en-US")}</div>
                  </TableCell>
                  <TableCell>{run.questionCount}</TableCell>
                  <TableCell>
                    {formatPct(run.avgFaithfulness)}
                    <TrendIndicator current={run.avgFaithfulness} previous={previous?.avgFaithfulness} />
                  </TableCell>
                  <TableCell>
                    {formatPct(run.avgAnswerRelevancy)}
                    <TrendIndicator current={run.avgAnswerRelevancy} previous={previous?.avgAnswerRelevancy} />
                  </TableCell>
                  <TableCell>
                    {formatPct(run.avgContextPrecision)}
                    <TrendIndicator current={run.avgContextPrecision} previous={previous?.avgContextPrecision} />
                  </TableCell>
                  <TableCell>{Math.round(run.avgLatencyMs)} ms</TableCell>
                  <TableCell>${run.totalCostUsd.toFixed(4)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
