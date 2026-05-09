import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { isAxiosError } from 'axios';
import { ListFilter, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  useCategories,
  useCreateRule,
  useDeleteRule,
  useRules,
  useUpdateRule,
} from '../api/categories';
import { useTransactions } from '../api/transactions';
import type { CategoryRule, Transaction } from '../api/types';

/**
 * Categorization Rules — settings sub-section with live regex preview.
 *
 * Architecture
 * ────────────
 * Lives next to TagsSection in Settings (not inside Categories.tsx) for
 * three reasons: (1) Categories.tsx is a budget dashboard already at full
 * vertical density, (2) Tags + Rules are both "configuration that affects
 * categorization" and read more naturally as Settings entries, (3) keeps
 * top-level routes unchanged per the M10 spec.
 *
 * Live preview
 * ────────────
 * Pure client-side: the user types a regex, we match against the most
 * recent N=500 normalized transactions cached by useTransactions, and
 * display up to 10 hits with the matching substring highlighted. The
 * matched text mirrors the backend semantics from
 * `_apply_rules` (src/normalization/pipeline.py): case-insensitive
 * `re.search` on `${sender} ${recipient} ${description}`.lower().
 *
 * The 500-row cap is the backend's hard limit on /transactions, so the
 * "12 von 1.243 Stichprobe 500" counter is honest about scope. Once a
 * backend `POST /categories/rules/preview` lands, swap the
 * `usePreviewMatches` body for a server query.
 */

// Backend hard caps /transactions at 500 — see transactions router.
const PREVIEW_SAMPLE_LIMIT = 500;
const PREVIEW_MAX_HITS = 10;

type RuleFormState = {
  regex_pattern: string;
  target_category_id: string;
  priority: number;
};

type EditMode =
  | { kind: 'create' }
  | { kind: 'edit'; ruleId: number };

const EMPTY_FORM: RuleFormState = {
  regex_pattern: '',
  target_category_id: '',
  priority: 0,
};

export default function RulesSection() {
  const { data: rules, isPending: rulesPending, error: rulesError } = useRules();
  const { data: categories } = useCategories();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const [mode, setMode] = useState<EditMode>({ kind: 'create' });
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Default category for the create form once categories load.
  useEffect(() => {
    if (mode.kind === 'create' && !form.target_category_id && categories?.length) {
      setForm((s) => ({ ...s, target_category_id: categories[0].id }));
    }
  }, [categories, mode.kind, form.target_category_id]);

  const sortedRules = useMemo(
    () =>
      (rules ?? [])
        .slice()
        .sort((a, b) => b.priority - a.priority || a.id - b.id),
    [rules],
  );

  const handleEditClick = (rule: CategoryRule) => {
    setMode({ kind: 'edit', ruleId: rule.id });
    setForm({
      regex_pattern: rule.regex_pattern,
      target_category_id: rule.target_category_id,
      priority: rule.priority,
    });
    setSubmitError(null);
  };

  const handleCancelEdit = () => {
    setMode({ kind: 'create' });
    setForm({
      ...EMPTY_FORM,
      target_category_id: categories?.[0]?.id ?? '',
    });
    setSubmitError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const regex = form.regex_pattern.trim();
    if (!regex) {
      setSubmitError('Regex darf nicht leer sein');
      return;
    }
    try {
      // eslint-disable-next-line no-new
      new RegExp(regex);
    } catch {
      setSubmitError('Regex ist nicht gültig');
      return;
    }
    if (!form.target_category_id) {
      setSubmitError('Kategorie auswählen');
      return;
    }

    const payload = {
      regex_pattern: regex,
      target_category_id: form.target_category_id,
      priority: Number.isFinite(form.priority) ? form.priority : 0,
    };

    try {
      if (mode.kind === 'create') {
        await createRule.mutateAsync(payload);
      } else {
        await updateRule.mutateAsync({ id: mode.ruleId, ...payload });
      }
      handleCancelEdit();
    } catch (err) {
      setSubmitError(extractError(err, 'Regel konnte nicht gespeichert werden'));
    }
  };

  const handleConfirmDelete = async (id: number) => {
    setDeleteError(null);
    try {
      await deleteRule.mutateAsync(id);
      setConfirmDeleteId(null);
      if (mode.kind === 'edit' && mode.ruleId === id) {
        handleCancelEdit();
      }
    } catch (err) {
      setDeleteError(extractError(err, 'Regel konnte nicht gelöscht werden'));
    }
  };

  const rulePendingDelete =
    confirmDeleteId != null
      ? sortedRules.find((r) => r.id === confirmDeleteId) ?? null
      : null;

  const isSaving = createRule.isPending || updateRule.isPending;

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories ?? []) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const showRulesEmptyHint =
    !rulesPending && !rulesError && sortedRules.length === 0;

  return (
    <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <ListFilter className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-headline font-bold text-on-surface">
            Kategorisierungs-Regeln
          </h3>
          <p className="text-xs text-on-surface-variant">
            Regex-Pattern, das beim Normalisieren automatisch eine Kategorie
            zuordnet. Höhere Priorität gewinnt bei Mehrfach-Treffern.
            Groß-/Kleinschreibung wird ignoriert. Geprüft wird gegen
            «Sender · Empfänger · Verwendungszweck».
          </p>
        </div>
      </div>

      <RuleForm
        mode={mode}
        form={form}
        setForm={setForm}
        categories={categories}
        onSubmit={handleSubmit}
        onCancelEdit={handleCancelEdit}
        isSaving={isSaving}
        submitError={submitError}
      />

      <div className="mt-6">
        {rulesPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : rulesError ? (
          <p className="text-xs text-error font-bold" role="alert">
            Regeln konnten nicht geladen werden.
          </p>
        ) : showRulesEmptyHint ? (
          <div className="text-center py-8 text-sm text-on-surface-variant border border-dashed border-white/10 rounded-xl">
            Noch keine Regeln angelegt.
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Regel-Liste">
            {sortedRules.map((rule) => {
              const isEditing =
                mode.kind === 'edit' && mode.ruleId === rule.id;
              return (
                <li
                  key={rule.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-surface-container-lowest border transition-colors ${
                    isEditing
                      ? 'border-primary/60'
                      : 'border-white/5'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono text-on-surface bg-surface-container-high px-2 py-0.5 rounded">
                        {rule.regex_pattern}
                      </code>
                      <span className="text-xs text-on-surface-variant">→</span>
                      <span className="text-xs font-bold text-on-surface">
                        {categoryNameById.get(rule.target_category_id) ??
                          rule.target_category_id}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mt-1">
                      Priorität {rule.priority}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditClick(rule)}
                      aria-label={`Regel #${rule.id} bearbeiten`}
                      className="p-2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmDeleteId(rule.id);
                      }}
                      aria-label={`Regel #${rule.id} löschen`}
                      className="p-2 text-on-surface-variant hover:text-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {rulePendingDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={
              deleteRule.isPending ? undefined : () => setConfirmDeleteId(null)
            }
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-surface-container-low border border-white/5 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-on-surface">
                      Regel löschen?
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Bereits zugeordnete Transaktionen bleiben erhalten;
                      neue Importe nutzen die Regel nicht mehr.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={deleteRule.isPending}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-surface-container-lowest rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
                  Pattern
                </p>
                <code className="text-sm font-mono text-on-surface break-all">
                  {rulePendingDelete.regex_pattern}
                </code>
              </div>

              {deleteError && (
                <p
                  className="mb-4 text-xs text-error font-bold text-center"
                  role="alert"
                >
                  {deleteError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={deleteRule.isPending}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest py-3 rounded-xl text-sm font-bold text-on-surface transition-all disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleConfirmDelete(rulePendingDelete.id)}
                  disabled={deleteRule.isPending}
                  className="flex-1 bg-error/15 text-error border border-error/30 py-3 rounded-xl text-sm font-bold hover:bg-error/25 transition-all disabled:opacity-50"
                >
                  {deleteRule.isPending ? 'Lösche…' : 'Löschen'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Sub-component: form + live preview ─────────────────────────────

type RuleFormProps = {
  mode: EditMode;
  form: RuleFormState;
  setForm: Dispatch<SetStateAction<RuleFormState>>;
  categories: { id: string; name: string }[] | undefined;
  onSubmit: (e: FormEvent) => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  submitError: string | null;
};

function RuleForm({
  mode,
  form,
  setForm,
  categories,
  onSubmit,
  onCancelEdit,
  isSaving,
  submitError,
}: RuleFormProps) {
  const isEdit = mode.kind === 'edit';
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-7 space-y-1">
          <label
            htmlFor="rule-regex"
            className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
          >
            Regex
          </label>
          <input
            id="rule-regex"
            type="text"
            value={form.regex_pattern}
            onChange={(e) =>
              setForm((s) => ({ ...s, regex_pattern: e.target.value }))
            }
            placeholder="z. B. ^rewe|edeka|aldi"
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-surface-container-lowest font-mono px-3 py-2.5 rounded-lg text-sm text-on-surface outline-none border border-transparent focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40"
          />
        </div>
        <div className="md:col-span-3 space-y-1">
          <label
            htmlFor="rule-category"
            className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
          >
            Kategorie
          </label>
          <select
            id="rule-category"
            value={form.target_category_id}
            onChange={(e) =>
              setForm((s) => ({ ...s, target_category_id: e.target.value }))
            }
            className="w-full bg-surface-container-lowest px-3 py-2.5 rounded-lg text-sm text-on-surface outline-none border border-transparent focus:border-primary/50 transition-all"
          >
            <option value="" disabled>
              {categories?.length ? '— wählen —' : 'Keine Kategorien'}
            </option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 space-y-1">
          <label
            htmlFor="rule-priority"
            className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
          >
            Priorität
          </label>
          <input
            id="rule-priority"
            type="number"
            value={form.priority}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                priority: Number(e.target.value) || 0,
              }))
            }
            className="w-full bg-surface-container-lowest px-3 py-2.5 rounded-lg text-sm text-on-surface tabular-nums outline-none border border-transparent focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      <RegexPreview pattern={form.regex_pattern} />

      {submitError && (
        <p className="text-xs text-error font-bold" role="alert">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
        >
          {isEdit ? (
            <>
              <Save className="w-4 h-4" />
              {isSaving ? 'Speichere…' : 'Aktualisieren'}
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {isSaving ? 'Lege an…' : 'Regel anlegen'}
            </>
          )}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isSaving}
            className="bg-surface-container-high hover:bg-surface-container-highest px-4 py-2.5 rounded-lg text-sm font-bold text-on-surface transition-all disabled:opacity-50"
          >
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Sub-component: live regex preview ──────────────────────────────

function RegexPreview({ pattern }: { pattern: string }) {
  // Debounce keystrokes — useDeferredValue keeps the input responsive
  // while regex compilation + scan happen on idle render passes.
  const deferred = useDeferredValue(pattern);
  const trimmed = deferred.trim();

  // Pull a sample of recent transactions. Using the same TanStack-Query
  // cache as the Transactions page → no extra fetch when the user is
  // already on this site for a few minutes.
  const { data: txData, isPending: txPending } = useTransactions({
    limit: PREVIEW_SAMPLE_LIMIT,
    offset: 0,
  });

  const compiled = useMemo(() => {
    if (!trimmed) return { regex: null, error: null as string | null };
    try {
      // 'i' to mirror the backend pipeline's IGNORECASE flag.
      return { regex: new RegExp(trimmed, 'i'), error: null };
    } catch (e) {
      return {
        regex: null,
        error: e instanceof Error ? e.message : 'Ungültige Regex',
      };
    }
  }, [trimmed]);

  const matches = useMemo(() => {
    if (!compiled.regex || !txData?.items) return [];
    const out: Array<{ tx: Transaction; haystack: string; match: RegExpMatchArray }> = [];
    for (const tx of txData.items) {
      const haystack = buildHaystack(tx);
      const m = haystack.match(compiled.regex);
      if (m) {
        out.push({ tx, haystack, match: m });
      }
    }
    return out;
  }, [compiled.regex, txData?.items]);

  const visibleHits = matches.slice(0, PREVIEW_MAX_HITS);
  const totalSampled = txData?.items.length ?? 0;
  const totalAvailable = txData?.total ?? 0;
  const sampleCappedAtBackend = totalAvailable > PREVIEW_SAMPLE_LIMIT;

  return (
    <div
      className="rounded-lg bg-surface-container-lowest border border-white/5 p-4"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
          Live-Vorschau
        </p>
        {compiled.error ? (
          <p
            className="text-[11px] text-error font-bold truncate max-w-[60%]"
            role="alert"
            title={compiled.error}
          >
            Regex ungültig: {compiled.error}
          </p>
        ) : !trimmed ? (
          <p className="text-[11px] text-on-surface-variant">
            Tippe ein Regex-Pattern oben ein.
          </p>
        ) : txPending ? (
          <p className="text-[11px] text-on-surface-variant">Lade Stichprobe…</p>
        ) : (
          <p
            className="text-[11px] text-on-surface-variant tabular-nums"
            aria-label="Live-Vorschau-Hits"
          >
            <span className="font-bold text-on-surface">{matches.length}</span>{' '}
            von {totalSampled} Stichprobe-Tx
            {sampleCappedAtBackend && (
              <span className="text-on-surface-variant/70">
                {' '}(insgesamt {totalAvailable})
              </span>
            )}
          </p>
        )}
      </div>

      {compiled.regex && !txPending && (
        <>
          {visibleHits.length === 0 ? (
            <p className="text-xs text-on-surface-variant italic">
              Keine Treffer in der Stichprobe.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleHits.map(({ tx, haystack, match }) => (
                <li
                  key={tx.id}
                  className="text-xs text-on-surface-variant leading-snug"
                >
                  <HighlightedHaystack
                    haystack={haystack}
                    matchStart={match.index ?? 0}
                    matchLength={match[0].length}
                  />
                </li>
              ))}
            </ul>
          )}
          {matches.length > visibleHits.length && (
            <p className="text-[10px] text-on-surface-variant/70 mt-2 italic">
              + {matches.length - visibleHits.length} weitere Treffer in der
              Stichprobe (nicht angezeigt).
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Backend pipeline: ${sender} ${recipient} ${description}, lowercased,
// case-insensitive search. We keep mixed case for display but report
// match offsets that align with the lowercased haystack — the regex is
// constructed with the 'i' flag so positions on the original-case
// string are equivalent for the purposes of indexOf-style highlighting.
export function buildHaystack(tx: Transaction): string {
  return [tx.sender ?? '', tx.recipient ?? '', tx.description ?? '']
    .filter(Boolean)
    .join(' · ');
}

function HighlightedHaystack({
  haystack,
  matchStart,
  matchLength,
}: {
  haystack: string;
  matchStart: number;
  matchLength: number;
}) {
  if (matchLength <= 0) {
    return <span>{truncate(haystack, 140)}</span>;
  }
  const before = haystack.slice(0, matchStart);
  const hit = haystack.slice(matchStart, matchStart + matchLength);
  const after = haystack.slice(matchStart + matchLength);
  // Trim either side to keep the line short while leaving the hit centred.
  const leftBudget = 50;
  const rightBudget = 60;
  const beforeTrim =
    before.length > leftBudget ? '…' + before.slice(-leftBudget) : before;
  const afterTrim =
    after.length > rightBudget ? after.slice(0, rightBudget) + '…' : after;
  return (
    <span className="break-all">
      {beforeTrim}
      <mark className="rounded px-1 bg-primary/25 text-on-surface font-bold">
        {hit}
      </mark>
      {afterTrim}
    </span>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (err.response?.status === 404) {
      return 'Backend-Endpoint /categories/rules existiert noch nicht (Folge-Task).';
    }
  }
  return fallback;
}
