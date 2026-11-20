// THE OUTCOMES PAGE  (/staff/outcomes)
// A small summary for the operations lead: is work being owned and finished, as opposed
// to merely answered quickly. Numbers come from getOutcomes in src/server/staff-view.ts.

import { pageUser } from "@/server/page-auth";
import { getOutcomes } from "@/server/staff-view";

function Tile({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default async function OutcomesPage() {
  await pageUser("staff");
  const o = await getOutcomes();
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Outcomes</h1>
      <p className="mb-6 text-sm text-slate-600">Whether client problems were solved, not how fast the first reply went out.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Open requests" value={o.open} hint={`${o.waitingOnClient} of these are waiting on the client`} />
        <Tile label="Unowned for over a day" value={o.unownedOverADay} hint="Work nobody is accountable for. Aim for zero." />
        <Tile label="Reopened after closing" value={o.reopened} hint="Closed before the problem was solved." />
        <Tile
          label="Average days to outcome"
          value={o.averageDaysToOutcome === null ? "–" : o.averageDaysToOutcome.toFixed(1)}
          hint="From request created to closed with an outcome."
        />
      </div>
      <h2 className="mt-8 mb-2 font-semibold">Closed requests by outcome ({o.closed})</h2>
      <table className="card w-full max-w-md text-sm">
        <tbody>
          {o.byOutcome.map((row) => (
            <tr key={row.label} className="border-b border-slate-100 last:border-0">
              <td className="p-3">{row.label}</td>
              <td className="p-3 text-right font-medium tabular-nums">{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
