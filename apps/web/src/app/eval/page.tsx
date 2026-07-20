import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listEvalRunSummaries, type EvalRunSummary } from "@/lib/eval-queries";

// El dashboard consulta Postgres en cada visita: no tiene sentido
// prerenderizarlo en build time (ni sería posible sin DB disponible ahí).
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
  // Igual que /api/chat (Hito 4): un fallo de DB no debe tumbar la página con
  // la página de error genérica de Next — se muestra un estado explícito.
  let runs: EvalRunSummary[];
  let loadError: string | null = null;
  try {
    runs = await listEvalRunSummaries();
  } catch (error) {
    runs = [];
    loadError = error instanceof Error ? error.message : "Error desconocido cargando las ejecuciones de eval.";
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Panel de evaluación</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada ejecución corre el golden set completo contra el pipeline de retrieval + generación y
        mide faithfulness, answer relevancy (LLM-as-judge) y context precision (heurística) —
        ver{" "}
        <code className="rounded bg-muted px-1 py-0.5">
          packages/core/src/eval/
        </code>
        . Comparado contra la ejecución inmediatamente anterior.
      </p>

      {loadError ? (
        <p className="mt-8 text-sm text-destructive">No se pudieron cargar las ejecuciones de eval: {loadError}</p>
      ) : runs.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Todavía no hay ejecuciones de eval. Corre <code className="rounded bg-muted px-1 py-0.5">npm run eval</code>{" "}
          para generar la primera.
        </p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Preguntas</TableHead>
              <TableHead>Faithfulness</TableHead>
              <TableHead>Answer relevancy</TableHead>
              <TableHead>Context precision</TableHead>
              <TableHead>Latencia media</TableHead>
              <TableHead>Coste total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run, index) => {
              const previous = runs[index + 1];
              return (
                <TableRow key={run.id}>
                  <TableCell>
                    <div className="font-mono text-xs">{run.gitSha.slice(0, 7)}</div>
                    <div className="text-xs text-muted-foreground">{run.createdAt.toLocaleString("es-ES")}</div>
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
