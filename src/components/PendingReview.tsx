import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Undo2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useRefundAudit,
  type RefundAuditCandidate,
} from '../api/aggregates';
import {
  useAcceptSuggestion,
  usePendingSuggestions,
  useRejectSuggestion,
} from '../api/categorization';
import { useCategories } from '../api/categories';
import { useUpdateTransaction } from '../api/transactions';
import { formatCurrency, formatDate } from '../lib/format';
import type { Category, PendingSuggestion } from '../api/types';

type ReviewTab = 'suggestions' | 'refunds';

// Two streams that both ask the user to correct the classifier:
//   - `suggestions` — low-confidence agent picks for *uncategorized* tx.
//   - `refunds`     — historic `erstattungen`-Tx that need re-flagging
//     under the post-2026-05-08 is_refund convention.
// Distinct lists, distinct actions, but one entrypoint so the UI doesn't
// fragment into a separate page per workflow.
export default function PendingReview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: ReviewTab =
    searchParams.get('tab') === 'refunds' ? 'refunds' : 'suggestions';
  const [tab, setTab] = useState<ReviewTab>(initialTab);

  const suggestions = usePendingSuggestions();
  const refunds = useRefundAudit();

  // Keep the URL in sync so the sidebar badge link can deep-link to a tab.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        if (tab === 'refunds') prev.set('tab', 'refunds');
        else prev.delete('tab');
        return prev;
      },
      { replace: true },
    );
  }, [tab, setSearchParams]);

  const suggestionCount = suggestions.data?.items.length ?? 0;
  const refundCount = refunds.data?.total ?? 0;

  return (
    <div className="pt-28 px-8 pb-12 overflow-y-auto h-screen">
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold mb-1">
            Categorization
          </p>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">
            Review
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-white/5">
        <TabButton
          active={tab === 'suggestions'}
          onClick={() => setTab('suggestions')}
          label="Vorschläge"
          count={suggestionCount}
          subtitle={
            suggestions.data
              ? `Auto-Apply ab ${(suggestions.data.threshold * 100).toFixed(0)}%`
              : null
          }
        />
        <TabButton
          active={tab === 'refunds'}
          onClick={() => setTab('refunds')}
          label="Erstattungs-Audit"
          count={refundCount}
          subtitle="Altlasten prüfen"
        />
      </div>

      {tab === 'suggestions' ? (
        <SuggestionsTab query={suggestions} />
      ) : (
        <RefundsTab query={refunds} />
      )}
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  subtitle: string | null;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`px-4 py-2.5 text-sm font-headline font-bold border-b-2 transition-colors ${
        props.active
          ? 'border-primary text-primary'
          : 'border-transparent text-on-surface-variant hover:text-on-surface'
      }`}
    >
      <span className="flex items-center gap-2">
        {props.label}
        {props.count > 0 ? (
          <span
            className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
              props.active
                ? 'bg-primary/15 text-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {props.count}
          </span>
        ) : null}
      </span>
      {props.subtitle ? (
        <span className="block text-[10px] font-normal text-on-surface-variant/70 mt-0.5">
          {props.subtitle}
        </span>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: agent suggestions
// ---------------------------------------------------------------------------

function SuggestionsTab(props: {
  query: ReturnType<typeof usePendingSuggestions>;
}) {
  const { data, isPending, error } = props.query;
  if (isPending) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        Lade Vorschläge…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-error/10 text-error rounded-xl p-6 text-sm">
        Konnte Vorschläge nicht laden: {String(error)}
      </div>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-20 text-on-surface-variant">
        <HelpCircle className="w-10 h-10 mx-auto mb-4 opacity-50" />
        <p className="text-sm">
          Keine offenen Vorschläge — alles auto-kategorisiert oder bereits
          entschieden.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {data.items.map((s) => (
        <SuggestionCard key={s.transaction_id} suggestion={s} />
      ))}
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
  // Refund-flag override — the user can flip the agent's call before
  // accepting. Click on the badge toggles it; we drop the verbose
  // checkbox-with-helper-text the audit identified as buried UI.
  const [refundOverride, setRefundOverride] = useState<boolean>(suggestion.is_refund);

  const isBusy = accept.isPending || reject.isPending;
  const tx = suggestion.transaction;
  const confidencePct = Math.round(suggestion.confidence * 100);

  const handleAccept = () => {
    accept.mutate({
      transaction_id: suggestion.transaction_id,
      category_id: override || undefined,
      is_refund: refundOverride,
    });
  };
  const handleReject = () => {
    reject.mutate(suggestion.transaction_id);
  };

  // Refund tx aren't income — render neutral, not green. Negative tx stay
  // on the default text color too. Only positive *non-refund* tx (real
  // income flagged by the agent) lean into the secondary color.
  const amountColor =
    tx.amount > 0 && !refundOverride ? 'text-secondary' : 'text-on-surface';

  return (
    <div className="bg-surface-container-low rounded-2xl border border-white/5 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-xs text-on-surface-variant tabular-nums">
              {formatDate(tx.booking_date, 'dd.MM.yyyy')}
            </span>
            <span className={`font-bold tabular-nums ${amountColor}`}>
              {refundOverride ? '↻ ' : ''}
              {formatCurrency(tx.amount)}
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
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
            {suggestion.suggested_category_name ?? suggestion.suggested_category_id}
            {' · '}
            {confidencePct}%
          </span>
          <button
            type="button"
            onClick={() => setRefundOverride((v) => !v)}
            disabled={isBusy}
            aria-pressed={refundOverride}
            title={
              refundOverride
                ? 'Klick: nicht als Erstattung markieren'
                : 'Klick: als Erstattung markieren (reduziert Budget statt Income)'
            }
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
              refundOverride
                ? 'bg-warning/20 text-warning border-warning/40 hover:bg-warning/30'
                : 'bg-surface-container-high text-on-surface-variant border-white/10 hover:border-warning/40 hover:text-warning/80'
            }`}
          >
            <RotateCcw className="w-3 h-3" />
            Erstattung
          </button>
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

// ---------------------------------------------------------------------------
// Tab 2: Erstattungs-Audit
// ---------------------------------------------------------------------------

const REFUND_TARGETS = new Set<string>([
  'gesundheit', 'restaurant-cafe', 'lebensmittel', 'drogerie', 'tanken',
  'auto-variabel', 'auto-fix', 'haushalt', 'kleidung', 'elektronik',
  'freizeit', 'reisen', 'geschenke', 'bildung', 'mitgliedschaften',
  'abos-streaming', 'bars-ausgehen', 'miete', 'strom-gas', 'internet-telefon',
  'versicherungen', 'kredit-tilgung', 'oepnv-abo', 'gez',
]);

const UNDO_WINDOW_MS = 5_000;

type AuditDecision =
  | { kind: 'refund'; categoryId: string }
  | { kind: 'income' };

function senderKey(c: RefundAuditCandidate): string {
  // Stable bucket key for grouping — first non-empty of sender/recipient,
  // lower-cased, trimmed. Robust enough for recurring counterparties
  // ("TECHNIKER KRANKENKASSE", "Splitwise", ...) without overfitting on
  // amounts or descriptions.
  return ((c.sender || c.recipient || '—').trim().toLowerCase()) || '—';
}

function senderLabel(c: RefundAuditCandidate): string {
  return (c.sender || c.recipient || '—').trim() || '—';
}

type RefundGroup = {
  key: string;
  label: string;
  candidates: RefundAuditCandidate[];
  suggestedCategoryId: string | null;
  suggestedReason: string | null;
};

function groupBySender(candidates: RefundAuditCandidate[]): RefundGroup[] {
  const map = new Map<string, RefundGroup>();
  for (const c of candidates) {
    const key = senderKey(c);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        label: senderLabel(c),
        candidates: [],
        suggestedCategoryId: c.suggested_category_id,
        suggestedReason: c.suggested_reason,
      };
      map.set(key, group);
    }
    group.candidates.push(c);
    // First-seen suggestion wins; if a later candidate diverges we leave
    // the group's hint as-is — the user picks per-row anyway.
    if (!group.suggestedCategoryId && c.suggested_category_id) {
      group.suggestedCategoryId = c.suggested_category_id;
      group.suggestedReason = c.suggested_reason;
    }
  }
  // Largest groups first — bulk-actions pay off the most there.
  return Array.from(map.values()).sort(
    (a, b) => b.candidates.length - a.candidates.length,
  );
}

function RefundsTab(props: {
  query: ReturnType<typeof useRefundAudit>;
}) {
  const cats = useCategories();
  const update = useUpdateTransaction();
  const [decisions, setDecisions] = useState<Record<string, AuditDecision>>({});
  // Per-tx pick (for the "different category than the suggestion" case);
  // empty string = use the group's default.
  const [picks, setPicks] = useState<Record<string, string>>({});
  // Per-group pick override.
  const [groupPicks, setGroupPicks] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState<boolean>(() => {
    // Default-collapsed once the user has already worked through any
    // candidate (proxied via localStorage); first-time visitors see it.
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('kfin_audit_help_seen') !== '1';
  });

  const expenseCategories: Category[] = (cats.data ?? [])
    .filter((c: Category) => REFUND_TARGETS.has(c.id))
    .sort((a: Category, b: Category) => a.name.localeCompare(b.name, 'de'));
  const categoryName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of cats.data ?? []) m[c.id] = c.name;
    return m;
  }, [cats.data]);

  const dismissHelp = () => {
    setHelpOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kfin_audit_help_seen', '1');
    }
  };

  if (props.query.isPending) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        Lade Audit-Kandidaten…
      </div>
    );
  }
  if (props.query.error) {
    return (
      <div className="bg-error/10 text-error rounded-xl p-6 text-sm">
        Audit konnte nicht geladen werden: {String(props.query.error)}
      </div>
    );
  }

  const candidates = props.query.data?.candidates ?? [];
  // Backend lifespan + post-sync hooks already auto-apply the high-confidence
  // heuristic patterns (Krankenkasse, Finanzamt, Booking, …), so this list
  // only ever surfaces ambiguous rows. Same posture as the categorization
  // queue: review is exception-handling, not the default path.
  const pending = candidates.filter((c) => !decisions[c.id]);
  const uncertainGroups = groupBySender(pending);

  const onMarkRefund = async (id: string, categoryId: string) => {
    await update.mutateAsync({
      id,
      category_id: categoryId,
      is_refund: true,
    });
    setDecisions((d) => ({ ...d, [id]: { kind: 'refund', categoryId } }));
    // Auto-clear the in-memory marker after the undo window so the
    // success pill doesn't stick around forever in long sessions.
    window.setTimeout(() => {
      setDecisions((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    }, UNDO_WINDOW_MS);
  };

  const onMarkIncome = async (id: string) => {
    await update.mutateAsync({
      id,
      refund_audit_decided: true,
    });
    setDecisions((d) => ({ ...d, [id]: { kind: 'income' } }));
    window.setTimeout(() => {
      setDecisions((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    }, UNDO_WINDOW_MS);
  };

  const onUndo = async (id: string, decision: AuditDecision) => {
    if (decision.kind === 'refund') {
      // Roll back: clear is_refund, return to erstattungen, drop the
      // audit-decided stamp so the row re-surfaces.
      await update.mutateAsync({
        id,
        category_id: 'erstattungen',
        is_refund: false,
        refund_audit_decided: false,
      });
    } else {
      await update.mutateAsync({
        id,
        refund_audit_decided: false,
      });
    }
    setDecisions((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  };

  const onBulkRefund = async (group: RefundGroup, categoryId: string) => {
    // Walk pending candidates in the group; rows already decided in this
    // session keep their existing status.
    for (const c of group.candidates) {
      if (decisions[c.id]) continue;
      // eslint-disable-next-line no-await-in-loop
      await onMarkRefund(c.id, categoryId);
    }
  };


  return (
    <div>
      <button
        type="button"
        onClick={() => (helpOpen ? dismissHelp() : setHelpOpen(true))}
        className="mb-4 inline-flex items-center gap-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        Was ist eine Erstattung?
        {helpOpen ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>
      {helpOpen ? (
        <div className="mb-6 p-5 bg-surface-container-low border border-white/5 rounded-2xl text-sm text-on-surface-variant max-w-3xl">
          <p className="mb-2">
            Eine Erstattung ist eine *positive* Buchung, die eine frühere Ausgabe
            storniert — kein eigenständiges Einkommen.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>
              Apotheke −50&nbsp;€ + Krankenkasse +30&nbsp;€ → Erstattung in
              <code className="mx-1 text-xs">gesundheit</code>, netto −20&nbsp;€
              verbraucht.
            </li>
            <li>
              Splitwise-Ausgleich, Amazon-Retoure, Arbeitgeber-Spesen → jeweils
              auf die Original-Ausgaben-Kategorie.
            </li>
            <li>
              Steuerrückzahlung, Cashback, Boni → bleibt echtes Einkommen in
              <code className="mx-1 text-xs">erstattungen</code>.
            </li>
          </ul>
          <p className="mt-3 text-xs">
            Die Spar­quote ignoriert Erstattungen, das Budget der Ziel-Kategorie
            verrechnet sie automatisch.
          </p>
        </div>
      ) : null}

      {pending.length === 0 ? (
        <div className="bg-surface-container-low border border-success/20 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="text-sm text-on-surface-variant">
            Keine offenen Audit-Kandidaten — die Heuristik hat alle klaren Fälle
            (Krankenkasse, Finanzamt, Booking, …) bereits automatisch
            verarbeitet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {uncertainGroups.map((g) => (
            <div key={g.key}>
              <RefundGroupBlock
                group={g}
                expenseCategories={expenseCategories}
                groupPick={groupPicks[g.key] ?? g.suggestedCategoryId ?? ''}
                setGroupPick={(v) =>
                  setGroupPicks((s) => ({ ...s, [g.key]: v }))
                }
                picks={picks}
                setPicks={setPicks}
                decisions={decisions}
                categoryName={categoryName}
                isBusy={update.isPending}
                onMarkRefund={onMarkRefund}
                onMarkIncome={onMarkIncome}
                onUndo={onUndo}
                onBulkRefund={onBulkRefund}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RefundGroupBlock(props: {
  group: RefundGroup;
  expenseCategories: Category[];
  groupPick: string;
  setGroupPick: (v: string) => void;
  picks: Record<string, string>;
  setPicks: Dispatch<SetStateAction<Record<string, string>>>;
  decisions: Record<string, AuditDecision>;
  categoryName: Record<string, string>;
  isBusy: boolean;
  onMarkRefund: (id: string, categoryId: string) => Promise<void>;
  onMarkIncome: (id: string) => Promise<void>;
  onUndo: (id: string, decision: AuditDecision) => Promise<void>;
  onBulkRefund: (group: RefundGroup, categoryId: string) => Promise<void>;
}) {
  const {
    group, expenseCategories, groupPick, setGroupPick,
    picks, setPicks, decisions, categoryName, isBusy,
    onMarkRefund, onMarkIncome, onUndo, onBulkRefund,
  } = props;

  const undecided = group.candidates.filter((c) => !decisions[c.id]);
  const totalAmount = group.candidates.reduce((sum, c) => sum + c.amount, 0);
  const showBulk = group.candidates.length > 1 && undecided.length > 0;

  return (
    <section className="bg-surface-container-low border border-white/5 rounded-2xl overflow-hidden">
      <header className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="font-headline font-bold text-base flex-1 truncate">
          {group.label}
        </h3>
        <span className="text-xs text-on-surface-variant tabular-nums">
          {group.candidates.length}{' '}
          Buchung{group.candidates.length === 1 ? '' : 'en'}
          {' · '}
          {formatCurrency(totalAmount)}
        </span>
      </header>

      {group.suggestedReason ? (
        <div className="px-5 py-2 bg-warning/5 border-b border-warning/15 flex items-center gap-2 text-xs text-warning/90">
          <Info className="w-3.5 h-3.5 shrink-0" />
          {group.suggestedReason}
        </div>
      ) : null}

      {showBulk ? (
        <div className="px-5 py-3 bg-surface-container/40 border-b border-white/5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-on-surface-variant">
            Alle {undecided.length} auf einmal:
          </span>
          <select
            value={groupPick}
            onChange={(e) => setGroupPick(e.target.value)}
            className="bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5 text-xs flex-1 min-w-[180px] focus:outline-none focus:border-primary/40"
          >
            <option value="">— Original-Kategorie —</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => groupPick && onBulkRefund(group, groupPick)}
            disabled={!groupPick || isBusy}
            className="flex items-center gap-1.5 bg-primary text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
          >
            <RotateCcw className="w-3 h-3" />
            Alle als Erstattung
          </button>
        </div>
      ) : null}

      <div className="divide-y divide-white/5">
        {group.candidates.map((c) => (
          <div key={c.id}>
            <RefundRow
              candidate={c}
              expenseCategories={expenseCategories}
              pick={picks[c.id] ?? groupPick ?? c.suggested_category_id ?? ''}
              onPickChange={(v) => setPicks((s) => ({ ...s, [c.id]: v }))}
              decision={decisions[c.id]}
              decisionLabel={
                decisions[c.id]?.kind === 'refund'
                  ? `→ ${categoryName[(decisions[c.id] as { categoryId: string }).categoryId] ?? ''}`
                  : null
              }
              isBusy={isBusy}
              onMarkRefund={onMarkRefund}
              onMarkIncome={onMarkIncome}
              onUndo={onUndo}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function RefundRow(props: {
  candidate: RefundAuditCandidate;
  expenseCategories: Category[];
  pick: string;
  onPickChange: (v: string) => void;
  decision: AuditDecision | undefined;
  decisionLabel: string | null;
  isBusy: boolean;
  onMarkRefund: (id: string, categoryId: string) => Promise<void>;
  onMarkIncome: (id: string) => Promise<void>;
  onUndo: (id: string, decision: AuditDecision) => Promise<void>;
}) {
  const { candidate: c, expenseCategories, pick, onPickChange,
    decision, decisionLabel, isBusy, onMarkRefund, onMarkIncome, onUndo } = props;

  if (decision) {
    return (
      <div
        className={`px-5 py-3 flex items-center gap-3 text-sm ${
          decision.kind === 'refund'
            ? 'bg-success/5 text-on-surface-variant'
            : 'bg-secondary/5 text-on-surface-variant'
        }`}
      >
        {decision.kind === 'refund' ? (
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-secondary shrink-0" />
        )}
        <span className="flex-1 truncate">
          {decision.kind === 'refund' ? 'Erstattung' : 'Echtes Einkommen'}{' '}
          {decisionLabel}
        </span>
        <button
          type="button"
          onClick={() => onUndo(c.id, decision)}
          disabled={isBusy}
          className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface"
        >
          <Undo2 className="w-3 h-3" />
          Rückgängig
        </button>
      </div>
    );
  }

  const flagAsRefund = () => pick && onMarkRefund(c.id, pick);

  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
        <span className="text-xs text-on-surface-variant tabular-nums">
          {formatDate(c.booking_date)}
        </span>
        <span className="text-sm font-headline font-semibold flex-1 truncate">
          {c.description || c.recipient || c.sender || '—'}
        </span>
        {/* Refund context: not income → render neutral, prefix with the
            ↻ glyph to reinforce it's a reversal of an earlier expense. */}
        <span className="text-sm font-bold tabular-nums text-on-surface">
          ↻ {formatCurrency(c.amount)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pick}
          onChange={(e) => onPickChange(e.target.value)}
          className="bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5 text-xs flex-1 min-w-[160px] focus:outline-none focus:border-primary/40"
        >
          <option value="">— Original-Kategorie wählen —</option>
          {expenseCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button
          onClick={flagAsRefund}
          disabled={!pick || isBusy}
          className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
        >
          <RotateCcw className="w-3 h-3" />
          Als Erstattung
        </button>
        <button
          onClick={() => onMarkIncome(c.id)}
          disabled={isBusy}
          className="px-3 py-1.5 rounded-lg text-xs bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
        >
          Echtes Einkommen
        </button>
      </div>
    </div>
  );
}
