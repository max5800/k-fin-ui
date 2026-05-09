import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Hash,
  Receipt,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  downloadTransactionsCsv,
  useTransactions,
  useUpdateTransaction,
} from '../api/transactions';
import { useCategories, useTags } from '../api/categories';
import { formatCurrency, formatDate } from '../lib/format';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Transaction } from '../api/types';

const editSchema = z.object({
  category_id: z.string().min(1, 'Kategorie erforderlich'),
  notes: z.string().optional(),
  is_refund: z.boolean().optional(),
  internal_transfer: z.boolean().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

// Quick-filter options for the row-flag dropdown. The query param is a
// stringy tri-state ('' = all, 'true' = only flagged, 'false' = only
// unflagged) so it reuses URL state without separate keys per flag.
type FlagQuery = 'true' | 'false' | undefined;
function parseFlag(v: string | null): FlagQuery {
  return v === 'true' || v === 'false' ? v : undefined;
}

const PAGE_SIZE = 25;

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const categoryId = searchParams.get('category_id') || undefined;
  const q = searchParams.get('q') || '';
  const isRefundFilter = parseFlag(searchParams.get('is_refund'));
  const internalTransferFilter = parseFlag(searchParams.get('internal_transfer'));
  // Multi-Tag-Filter: ?tag_ids=a,b,c — kommt als CSV in der URL, wird ans
  // Backend als wiederholter Query-Param weitergereicht
  // (?tag_ids=a&tag_ids=b, OR-Semantik). Server-seitig gefiltert seit
  // k-fin v1.34, daher steckt der Filter im Query-Key und im total-Count.
  const tagIdsParam = searchParams.get('tag_ids') || '';
  const selectedTagIds = useMemo(
    () => tagIdsParam.split(',').map((s) => s.trim()).filter(Boolean),
    [tagIdsParam],
  );
  const offset = (page - 1) * PAGE_SIZE;

  const { data: txData, isPending: isTxsPending } = useTransactions({
    limit: PAGE_SIZE,
    offset,
    category_id: categoryId,
    tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    search: q || undefined,
    is_refund: isRefundFilter,
    internal_transfer: internalTransferFilter,
  });
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { mutate: updateTx, isPending: isUpdating } = useUpdateTransaction();

  const visibleItems = txData?.items ?? [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  });
  const isRefundActive = !!watch('is_refund');
  const internalTransferActive = !!watch('internal_transfer');

  const handleEdit = (tx: Transaction) => {
    setSelectedTx(tx);
    reset({
      category_id: tx.category?.id || '',
      notes: '',
      is_refund: tx.is_refund,
      internal_transfer: tx.internal_transfer,
    });
  };

  const onSubmit = (data: EditFormData) => {
    if (!selectedTx) return;
    updateTx(
      {
        id: selectedTx.id,
        category_id: data.category_id,
        is_refund: data.is_refund,
        internal_transfer: data.internal_transfer,
      },
      { onSuccess: () => setSelectedTx(null) },
    );
  };

  const updateParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      if (value) prev.set(key, value);
      else prev.delete(key);
      prev.set('page', '1');
      return prev;
    });
  };

  const goToPage = (p: number) => {
    setSearchParams((prev) => {
      prev.set('page', String(p));
      return prev;
    });
  };

  const handleExportCsv = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      await downloadTransactionsCsv({
        category_id: categoryId,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        search: q || undefined,
      });
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'CSV-Export fehlgeschlagen',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const total = txData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setTagIds = (ids: string[]) => {
    setSearchParams((prev) => {
      if (ids.length === 0) {
        prev.delete('tag_ids');
      } else {
        prev.set('tag_ids', ids.join(','));
      }
      prev.set('page', '1');
      return prev;
    });
  };
  const toggleTag = (id: string) => {
    if (selectedTagIds.includes(id)) {
      setTagIds(selectedTagIds.filter((x) => x !== id));
    } else {
      setTagIds([...selectedTagIds, id]);
    }
  };

  return (
    <div className="pt-24 px-8 pb-12 flex flex-col h-screen overflow-hidden">
      <div className="mb-6 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Suche
          </label>
          <div className="bg-surface-container-low px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium text-on-surface border border-transparent focus-within:border-primary/50 transition-all">
            <Search className="w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Empfänger, Beschreibung..."
              defaultValue={q}
              onChange={(e) => updateParam('q', e.target.value || null)}
              className="bg-transparent border-none outline-none w-64 placeholder:text-on-surface-variant/40"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Kategorie
          </label>
          <div className="relative">
            <select
              value={categoryId || ''}
              onChange={(e) => updateParam('category_id', e.target.value || null)}
              className="bg-surface-container-low px-4 pr-10 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-transparent hover:border-primary/30 cursor-pointer transition-all appearance-none outline-none min-w-[200px]"
            >
              <option value="">Alle Kategorien</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Erstattung
          </label>
          <div className="relative">
            <select
              value={isRefundFilter ?? ''}
              onChange={(e) => updateParam('is_refund', e.target.value || null)}
              className="bg-surface-container-low px-4 pr-10 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-transparent hover:border-primary/30 cursor-pointer transition-all appearance-none outline-none"
            >
              <option value="">Alle</option>
              <option value="true">Nur Erstattungen</option>
              <option value="false">Ohne Erstattungen</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Umbuchung
          </label>
          <div className="relative">
            <select
              value={internalTransferFilter ?? ''}
              onChange={(e) => updateParam('internal_transfer', e.target.value || null)}
              className="bg-surface-container-low px-4 pr-10 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-transparent hover:border-primary/30 cursor-pointer transition-all appearance-none outline-none"
            >
              <option value="">Alle</option>
              <option value="true">Nur Umbuchungen</option>
              <option value="false">Ohne Umbuchungen</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Tags
          </label>
          <TagFilter
            tags={tags ?? []}
            selectedIds={selectedTagIds}
            onToggle={toggleTag}
            onClear={() => setTagIds([])}
          />
        </div>

        <div className="md:ml-auto flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant invisible">
            Export
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            aria-label="Transaktionen als CSV exportieren"
            className="bg-surface-container-low px-4 py-2.5 rounded-lg text-sm font-bold text-on-surface border border-transparent hover:border-primary/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exportiere...' : 'CSV-Export'}
          </button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          className="mb-4 px-4 py-2.5 rounded-lg bg-error/10 border border-error/30 text-error text-sm font-medium"
        >
          {exportError}
        </div>
      )}

      <div className="flex gap-6 flex-1 overflow-hidden">
        <div className="flex-1 bg-surface-container-low rounded-2xl overflow-hidden flex flex-col border border-white/5">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container/50 border-b border-white/5 sticky top-0 z-10">
                <tr>
                  {['Datum', 'Empfänger', 'Betrag', 'Kategorie', 'Tags', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-4 text-[11px] font-black uppercase tracking-widest text-on-surface-variant/60 ${
                        h === 'Betrag' ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isTxsPending ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="h-8 bg-white/5 rounded-lg w-full" />
                      </td>
                    </tr>
                  ))
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-on-surface-variant text-sm">
                      Keine Transaktionen gefunden
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => handleEdit(tx)}
                      className={`hover:bg-surface-container-high/40 transition-colors cursor-pointer ${
                        selectedTx?.id === tx.id ? 'bg-surface-container-high/60' : ''
                      }`}
                    >
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-on-surface-variant tabular-nums">
                        {formatDate(tx.booking_date, 'dd.MM.yyyy')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                            <Receipt
                              className={`w-4 h-4 ${
                                tx.amount < 0 ? 'text-error' : 'text-primary'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-on-surface truncate max-w-[260px]">
                              {tx.recipient || tx.sender || tx.description || 'Unbekannt'}
                            </p>
                            {tx.description && (
                              <p className="text-[10px] text-on-surface-variant/60 truncate max-w-[260px]">
                                {tx.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <span
                          className={`tabular-nums text-sm font-bold ${
                            tx.amount > 0 ? 'text-primary' : 'text-on-surface'
                          }`}
                        >
                          {tx.amount > 0 ? '+' : ''}
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wider rounded">
                            {tx.category?.name || 'Unkategorisiert'}
                          </span>
                          {tx.is_refund ? (
                            <span className="px-2 py-0.5 bg-amber-400/15 text-amber-300 text-[10px] font-bold uppercase tracking-wider rounded">
                              Erstattung
                            </span>
                          ) : null}
                          {tx.internal_transfer ? (
                            <span className="px-2 py-0.5 bg-secondary/15 text-secondary text-[10px] font-bold uppercase tracking-wider rounded">
                              Umbuchung
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1.5 flex-wrap max-w-[150px]">
                          {tx.tags?.map((t) => (
                            <span
                              key={t.id}
                              className="text-[10px] font-bold text-secondary"
                            >
                              #{t.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-on-surface-variant opacity-40" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-surface-container/30 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">
              {total > 0
                ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} von ${total}`
                : 'Keine Ergebnisse'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded bg-surface-container-high text-on-surface disabled:opacity-20 hover:bg-surface-container-highest transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs font-bold text-on-surface-variant tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded bg-surface-container-high text-on-surface disabled:opacity-20 hover:bg-surface-container-highest transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {selectedTx && (
            <motion.aside
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-96 bg-surface-container border border-white/5 rounded-2xl p-6 flex flex-col shadow-2xl overflow-y-auto z-20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">
                  Transaktion bearbeiten
                </h3>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-surface-container-lowest rounded-xl border border-white/5">
                <h4 className="text-lg font-headline font-bold text-on-surface leading-tight mb-1">
                  {selectedTx.recipient || selectedTx.sender || 'Unbekannt'}
                </h4>
                <p
                  className={`font-bold tabular-nums text-2xl ${
                    selectedTx.amount > 0 ? 'text-primary' : 'text-on-surface'
                  }`}
                >
                  {selectedTx.amount > 0 ? '+' : ''}
                  {formatCurrency(selectedTx.amount)}
                </p>
                <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest mt-2">
                  {formatDate(selectedTx.booking_date, 'dd.MM.yyyy')}
                </p>
              </div>

              <form
                id="edit-tx-form"
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-4 flex-1"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Kategorie
                  </label>
                  <div className="relative">
                    <select
                      {...register('category_id')}
                      className="w-full bg-surface-container-lowest border border-white/5 rounded-lg py-2.5 px-4 text-sm text-on-surface appearance-none focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer"
                    >
                      <option value="">Kategorie wählen</option>
                      {categories?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
                  </div>
                  {errors.category_id && (
                    <p className="text-[10px] text-error font-bold">{errors.category_id.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Sondertyp
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <label
                      title="Positive Buchung, die eine frühere Ausgabe storniert (Krankenkasse, Splitwise, Retoure)."
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                        isRefundActive
                          ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                          : 'bg-surface-container-high text-on-surface-variant border-white/10 hover:border-white/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        {...register('is_refund')}
                      />
                      <RotateCcw className="w-3 h-3" />
                      Erstattung
                    </label>
                    <label
                      title="Geld zwischen eigenen Konten — wird in Cashflow und Budgets ignoriert."
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                        internalTransferActive
                          ? 'bg-secondary/20 text-secondary border-secondary/40'
                          : 'bg-surface-container-high text-on-surface-variant border-white/10 hover:border-white/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        {...register('internal_transfer')}
                      />
                      <ArrowLeftRight className="w-3 h-3" />
                      Umbuchung
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Notiz
                  </label>
                  <textarea
                    {...register('notes')}
                    className="w-full bg-surface-container-lowest border border-white/5 rounded-lg py-2.5 px-4 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none resize-none h-20 placeholder:text-on-surface-variant/30"
                    placeholder="Optional"
                  />
                </div>
              </form>

              <div className="pt-6 border-t border-white/5 space-y-2 mt-4">
                <button
                  type="submit"
                  form="edit-tx-form"
                  disabled={isUpdating}
                  className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {isUpdating ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="w-full bg-transparent border border-white/10 hover:bg-surface-container-high text-on-surface-variant font-bold py-3 rounded-lg transition-all"
                >
                  Abbrechen
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type TagOption = { id: string; name: string };

function TagFilter({
  tags,
  selectedIds,
  onToggle,
  onClear,
}: {
  tags: TagOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, query]);

  const selectedSet = new Set(selectedIds);
  const summary =
    selectedIds.length === 0
      ? 'Alle Tags'
      : selectedIds.length === 1
        ? `#${tags.find((t) => t.id === selectedIds[0])?.name ?? '?'}`
        : `${selectedIds.length} Tags`;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`bg-surface-container-low px-4 pr-10 py-2.5 rounded-lg text-sm font-medium text-on-surface border transition-all min-w-[200px] flex items-center gap-2 ${
          selectedIds.length > 0
            ? 'border-primary/40'
            : 'border-transparent hover:border-primary/30'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Hash className="w-4 h-4 text-on-surface-variant" />
        <span className="flex-1 text-left truncate">{summary}</span>
        <ChevronDown
          className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-surface-container border border-white/10 rounded-lg shadow-2xl z-30 max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-white/5">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen…"
              className="w-full bg-surface-container-lowest px-3 py-2 rounded-md text-sm text-on-surface outline-none border border-transparent focus:border-primary/50"
              aria-label="Tags filtern"
            />
          </div>

          <ul className="flex-1 overflow-y-auto py-1" role="listbox">
            {tags.length === 0 ? (
              <li className="px-3 py-4 text-xs text-on-surface-variant text-center">
                Keine Tags vorhanden — anlegen unter Einstellungen.
              </li>
            ) : filteredTags.length === 0 ? (
              <li className="px-3 py-4 text-xs text-on-surface-variant text-center">
                Keine Treffer
              </li>
            ) : (
              filteredTags.map((tag) => {
                const checked = selectedSet.has(tag.id);
                return (
                  <li key={tag.id} role="option" aria-selected={checked}>
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-surface-container-high cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(tag.id)}
                        className="accent-primary"
                      />
                      <span className="text-secondary">#</span>
                      <span className="text-sm text-on-surface flex-1 truncate">
                        {tag.name}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>

          {selectedIds.length > 0 && (
            <div className="p-2 border-t border-white/5 flex justify-between items-center">
              <span className="text-[11px] text-on-surface-variant tabular-nums">
                {selectedIds.length} ausgewählt
              </span>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-3 h-3" />
                Zurücksetzen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
