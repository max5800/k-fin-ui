import { useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { Hash, Plus, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTags, useCreateTag, useDeleteTag } from '../api/categories';
import { useEscapeKey } from '../lib/useEscapeKey';
import type { Tag } from '../api/types';

/**
 * Tags-Management lebt als Sub-Section in Settings — Tags sind keine
 * eigene Top-Level-Section. Liste, Inline-Anlegen, Löschen mit Confirm.
 *
 * Backend (`Tag` in `src/api/types.ts`) hat aktuell nur `id` + `name`,
 * also keinen Color-Picker. Falls das Modell um eine Farbe erweitert
 * wird, lässt sich die UI hier ohne Strukturänderung erweitern.
 */
export default function TagsSection() {
  const { data: tags, isPending } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();

  const [draftName, setDraftName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const name = draftName.trim();
    if (!name) {
      setCreateError('Name darf nicht leer sein');
      return;
    }
    if (
      tags?.some((t) => t.name.toLowerCase() === name.toLowerCase())
    ) {
      setCreateError('Tag mit diesem Namen existiert bereits');
      return;
    }
    try {
      await createTag.mutateAsync({ name });
      setDraftName('');
    } catch (err) {
      setCreateError(extractError(err, 'Tag konnte nicht angelegt werden'));
    }
  };

  const handleConfirmDelete = async (tag: Tag) => {
    setDeleteError(null);
    try {
      await deleteTag.mutateAsync(tag.id);
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(extractError(err, 'Tag konnte nicht gelöscht werden'));
    }
  };

  const tagPendingDelete =
    confirmDeleteId != null
      ? tags?.find((t) => t.id === confirmDeleteId) ?? null
      : null;

  // Escape schließt das Lösch-Bestätigungs-Modal — gesperrt, solange der
  // Löschvorgang läuft.
  useEscapeKey(!!tagPendingDelete && !deleteTag.isPending, () =>
    setConfirmDeleteId(null),
  );

  return (
    <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Hash className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-headline font-bold text-on-surface">Tags</h3>
          <p className="text-xs text-on-surface-variant">
            Freie Labels für Transaktionen — neben Kategorien. Werden in der
            Transaktionsliste als Badge angezeigt und lassen sich dort filtern.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Neues Tag, z. B. urlaub"
          className="flex-1 bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface outline-none border border-transparent focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40"
          maxLength={64}
          aria-label="Neuer Tag-Name"
        />
        <button
          type="submit"
          disabled={createTag.isPending || !draftName.trim()}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {createTag.isPending ? 'Lege an…' : 'Anlegen'}
        </button>
      </form>

      {createError && (
        <p className="mb-4 text-xs text-error font-bold" role="alert">
          {createError}
        </p>
      )}

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 bg-white/5 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : !tags || tags.length === 0 ? (
        <div className="text-center py-8 text-sm text-on-surface-variant border border-dashed border-white/10 rounded-xl">
          Noch keine Tags angelegt.
        </div>
      ) : (
        <ul className="space-y-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-surface-container-lowest border border-white/5"
            >
              <span className="inline-flex items-center gap-2 text-sm font-bold text-on-surface">
                <span className="text-secondary">#</span>
                {tag.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDeleteId(tag.id);
                }}
                aria-label={`Tag «${tag.name}» löschen`}
                className="p-1.5 text-on-surface-variant hover:text-error transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {tagPendingDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={
              deleteTag.isPending ? undefined : () => setConfirmDeleteId(null)
            }
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tag-delete-title"
              className="w-full max-w-md bg-surface-container-low border border-white/5 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="tag-delete-title" className="font-headline font-bold text-on-surface">
                      Tag löschen?
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      «{tagPendingDelete.name}» wird von allen Transaktionen
                      entfernt.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={deleteTag.isPending}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                Diese Aktion lässt sich nicht rückgängig machen. Die
                Zuordnung zu Transaktionen wird unwiderruflich entfernt; die
                Transaktionen selbst bleiben erhalten.
              </p>

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
                  disabled={deleteTag.isPending}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest py-3 rounded-xl text-sm font-bold text-on-surface transition-all disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleConfirmDelete(tagPendingDelete)}
                  disabled={deleteTag.isPending}
                  className="flex-1 bg-error/15 text-error border border-error/30 py-3 rounded-xl text-sm font-bold hover:bg-error/25 transition-all disabled:opacity-50"
                >
                  {deleteTag.isPending ? 'Lösche…' : 'Löschen'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}
