/**
 * ContentQueue — preview of upcoming/in-progress content from Airtable Content_Queue.
 *
 * Reads from Airtable rows: title, status, content_type, language, scheduled_date.
 * Status colors aligned with Geo Carpentry editorial palette.
 */

interface QueueItem {
  id: string;
  title?: string;
  status?: string;
  content_type?: string;
  language?: string;
}

const statusStyles: Record<string, string> = {
  Planned:   "bg-blue-50 text-blue-700",
  Drafting:  "bg-yellow-50 text-yellow-700",
  Review:    "bg-orange-50 text-orange-700",
  Published: "bg-green-50 text-green-700",
};

export function ContentQueue({ items }: { items: QueueItem[] }) {
  return (
    <div className="bg-white border border-[#e5e2db] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e5e2db]">
        <h3 className="text-sm font-bold text-[#1B2A4A]">✍️ Content Queue</h3>
        <p className="text-xs text-[#64748b]">El Escriba · {items.length} items</p>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-xs text-[#94a3b8] italic">No content queued.</p>
      ) : (
        <ul className="divide-y divide-[#e5e2db]">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="px-4 py-2.5 flex items-center gap-2">
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  statusStyles[item.status ?? ""] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {item.status ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#1B2A4A] truncate">
                  {item.title ?? "Untitled"}
                </p>
                <p className="text-[10px] text-[#94a3b8]">
                  {item.content_type ?? "post"} · {item.language ?? "en"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
