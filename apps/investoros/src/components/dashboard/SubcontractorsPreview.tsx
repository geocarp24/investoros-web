/**
 * SubcontractorsPreview — quick browse of subcontractor network for the tenant.
 *
 * Reads from Airtable Subcontractors table: Name, Trade, City, License.
 * Empty state hints at running El Rastreador (the scout/scraper agent).
 */

interface Sub {
  id: string;
  Name?: string;
  Trade?: string;
  City?: string;
  License?: string;
}

export function SubcontractorsPreview({ subs }: { subs: Sub[] }) {
  return (
    <div className="bg-white border border-[#e5e2db] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e5e2db] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#1B2A4A]">🔨 Subcontractors</h3>
          <p className="text-xs text-[#64748b]">Licensed NE Wisconsin</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-[#FF6B00] hover:text-[#1B2A4A] transition-colors"
        >
          Browse all →
        </button>
      </div>
      {subs.length === 0 ? (
        <p className="p-4 text-xs text-[#94a3b8] italic">Run El Rastreador to populate.</p>
      ) : (
        <ul className="divide-y divide-[#e5e2db]">
          {subs.slice(0, 5).map((s) => (
            <li key={s.id} className="px-4 py-2 flex items-center gap-2">
              <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0 w-16 text-center">
                {s.Trade ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#1B2A4A] truncate">
                  {s.Name ?? "Unknown"}
                </p>
                <p className="text-[10px] text-[#94a3b8]">📍 {s.City ?? "—"}</p>
              </div>
              <button
                type="button"
                className="text-[9px] border border-[#e5e2db] rounded px-2 py-0.5 text-[#64748b] hover:border-[#FF6B00] hover:text-[#FF6B00] transition-colors"
              >
                Contact
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
