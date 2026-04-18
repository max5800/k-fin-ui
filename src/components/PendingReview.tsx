import { Check, HelpCircle, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import {
  useAcceptSuggestion,
  usePendingSuggestions,
  useRejectSuggestion,
} from '../api/categorization';
import { useCategories } from '../api/categories';
import { formatDate } from '../lib/format';
import type { PendingSuggestion } from '../api/types';

const formatEur = (n: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);

export default function PendingReview() {
  const { data, isPending, error } = usePendingSuggestions();

  return (
    <div className="pt-24 px-8 pb-12 overflow-y-auto h-screen">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h3 className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold mb-1">
            Categorization
          </h3>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">
            Review
          </h1>
          {data && (
            <p className="text-sm text-on-surface-variant mt-2">
              {data.items.length} offene Vorschläge
              {' · '}
              Auto-Apply ab {(data.threshold * 100).toFixed(0)}%
            </p>
          )}
        </div>
      </div>

      {isPending && (
        <div className="text-center py-16 text-on-surface-variant">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          Lade Vorschläge…
        </div>
      )}

      {error && (
        <div className="bg-error/10 text-error rounded-xl p-6 text-sm">
          Konnte Vorschläge nicht laden: {String(error)}
        </div>
      )}

      {data && data.items.length === 0 && !isPending && (
        <div className="text-center py-20 text-on-surface-variant">
          <HelpCircle className="w-10 h-10 mx-auto mb-4 opacity-50" />
          <p className="text-sm">
            Keine offenen Vorschläge — alles auto-kategorisiert oder bereits
            entschieden.
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((s) => (
            <SuggestionCard key={s.transaction_id} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
}: {
  suggestion: PendingSuggestion;
  key?: string;
}) {
  const { data: categories } = useCategories();
  const accept = useAcceptSuggestion();
  const reject = useRejectSuggestion();
  const [override, setOverride] = useState<string>('');

  const isBusy = accept.isPending || reject.isPending;
  const tx = suggestion.transaction;
  const confidencePct = Math.round(suggestion.confidence * 100);

  const handleAccept = () => {
    accept.mutate({
      transaction_id: suggestion.transaction_id,
      category_id: override || undefined,
    });
  };

  const handleReject = () => {
    reject.mutate(suggestion.transaction_id);
  };

  return (
    <div className="bg-surface-container-low rounded-2xl border border-white/5 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-xs text-on-surface-variant tabular-nums">
              {formatDate(tx.booking_date, 'dd.MM.yyyy')}
            </span>
            <span
              className={`font-bold tabular-nums ${
                tx.amount < 0 ? 'text-on-surface' : 'text-secondary'
              }`}
            >
              {formatEur(tx.amount)}
            </span>
          </div>
          <p className="text-sm text-on-surface font-bold truncate">
            {tx.recipient || tx.sender || 'Unbekannt'}
          </p>
          {tx.description && (
            <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
              {tx.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
            {suggestion.suggested_category_name ?? suggestion.suggested_category_id}
            {' · '}
            {confidencePct}%
          </span>
        </div>
      </div>

      {suggestion.reasoning && (
        <p className="text-xs text-on-surface-variant italic mb-4 border-l-2 border-white/10 pl-3">
          {suggestion.reasoning}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleAccept}
          disabled={isBusy}
          className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
        >
          {accept.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          {override
            ? `Übernehmen als ${categories?.find((c) => c.id === override)?.name ?? override}`
            : 'Akzeptieren'}
        </button>

        <select
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          disabled={isBusy}
          className="bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/50 disabled:opacity-50"
        >
          <option value="">— Andere Kategorie —</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleReject}
          disabled={isBusy}
          className="flex items-center gap-2 bg-surface-container-high hover:bg-error/10 hover:text-error text-on-surface-variant px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ml-auto"
        >
          {reject.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
          Verwerfen
        </button>
      </div>
    </div>
  );
}
