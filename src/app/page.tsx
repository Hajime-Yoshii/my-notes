'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

// --- READONLY: 本番で NEXT_PUBLIC_READONLY=1 を設定すると「読むだけ」モードになる ---
const READONLY = process.env.NEXT_PUBLIC_READONLY === '1';

// --- Types ---
type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

// --- Utility helpers ---
const STORAGE_KEY = 'studyNotes_v1';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 軽い型の正規化
    return parsed.map((n: any): Note => ({
      id: String(n.id ?? uid()),
      title: String(n.title ?? ''),
      content: String(n.content ?? ''),
      tags: Array.isArray(n.tags) ? n.tags.map((t: any) => String(t)) : [],
      createdAt: String(n.createdAt ?? new Date().toISOString()),
      updatedAt: String(n.updatedAt ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {}
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function classNames(...arr: Array<string | false | null | undefined>): string {
  return arr.filter(Boolean).join(' ');
}

// --- Tag utilities ---
function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length);
}

function allTags(notes: Note[]): string[] {
  const set = new Set<string>();
  notes.forEach((n) => n.tags?.forEach((t) => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// --- Components ---
function NoteCard({
  note,
  onEdit,
  onDelete,
  onQuickTag,
}: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onQuickTag?: (tag: string) => void;
}) {
  return (
    <div className="rounded-2xl shadow p-4 bg-white/70 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold leading-tight mb-1 break-words">
            {note.title || '(無題)'}
          </h3>
          <p className="text-xs text-zinc-500 mb-2">
            作成: {new Date(note.createdAt).toLocaleString()} ・ 更新:{' '}
            {new Date(note.updatedAt).toLocaleString()}
          </p>
        </div>
        {!READONLY && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 rounded-xl text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              aria-label="編集"
            >
              編集
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 rounded-xl text-sm border border-red-300 text-red-600 hover:bg-red-50"
              aria-label="削除"
            >
              削除
            </button>
          </div>
        )}
      </div>
      {note.tags?.length ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {note.tags.map((t) => (
            <button
              key={t}
              onClick={() => onQuickTag?.(t)}
              className="text-xs px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              title={`タグで絞り込み: ${t}`}
            >
              #{t}
            </button>
          ))}
        </div>
      ) : null}
      {note.content ? (
        <pre className="whitespace-pre-wrap text-sm leading-relaxed mt-3 text-zinc-800 dark:text-zinc-200">
          {note.content}
        </pre>
      ) : null}
    </div>
  );
}

function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function NoteEditor({
  initial,
  onSave,
}: {
  initial?: Note;
  onSave: (payload: Pick<Note, 'title' | 'content' | 'tags'>) => void;
}) {
  const [title, setTitle] = useState<string>(initial?.title ?? '');
  const [content, setContent] = useState<string>(initial?.content ?? '');
  const [tagsRaw, setTagsRaw] = useState<string>((initial?.tags ?? []).join(', '));

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">タイトル</label>
        <input
          className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: NDN キャッシュ&再暗号化の要点"
        />
      </div>
      <div className="grid gap-1">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">タグ（カンマ区切り）</label>
        <input
          className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="例: NDN, IB-PRE, AES, 論文メモ"
        />
      </div>
      <div className="grid gap-1">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">本文</label>
        <textarea
          className="w-full min-h-[200px] px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`学習した内容、コード断片、気づきなどを自由にメモできます。\n\n例)\n- ES_CDの弱点: Proxy単一障害→回避案: プロキシ分散 & 任意閾値再暗号化\n- 実験TODO: ndnSIMでコンテンツ鍵を動的発行しキャッシュ評価`}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={() =>
            onSave({
              title: title.trim(),
              content: content.trim(),
              tags: parseTags(tagsRaw),
            })
          }
          className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-20 border-2 border-dashed rounded-2xl dark:border-zinc-800">
      <p className="text-lg mb-3">まだノートがありません。</p>
      <p className="text-zinc-500 mb-6">「新規ノート」から学習メモを作成しましょう。</p>
      {!READONLY && (
        <button
          onClick={onCreate}
          className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          新規ノート
        </button>
      )}
    </div>
  );
}

export default function StudyNotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState<string>('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<'updated' | 'created' | 'title'>('updated');
  // テーマの初期値は一旦falseでSSR安全に。初回effectで実際の設定を反映。
  const [dark, setDark] = useState<boolean>(false);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editing, setEditing] = useState<Note | null>(null);

  // Load notes（READONLYなら /notes.json から取得）
  useEffect(() => {
    if (READONLY) {
      fetch('/notes.json')
        .then((r) => r.json())
        .then((data) => {
          const arr: Note[] = Array.isArray(data) ? data : [];
          // 最低限の正規化
          setNotes(
            arr.map((n: any) => ({
              id: String(n.id ?? uid()),
              title: String(n.title ?? ''),
              content: String(n.content ?? ''),
              tags: Array.isArray(n.tags) ? n.tags.map((t: any) => String(t)) : [],
              createdAt: String(n.createdAt ?? new Date().toISOString()),
              updatedAt: String(n.updatedAt ?? new Date().toISOString()),
            })),
          );
        })
        .catch(() => setNotes([]));
    } else {
      setNotes(loadNotes());
    }
  }, []);

  // Persist（READONLYの時は保存しない）
  useEffect(() => {
    if (!READONLY) {
      saveNotes(notes);
    }
  }, [notes]);

  // Theme（初期反映 + 切替時反映）
  useEffect(() => {
    const prefDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const saved =
      (typeof window !== 'undefined' && localStorage.getItem('theme')) ||
      (prefDark ? 'dark' : 'light');
    const initialDark = saved === 'dark';
    setDark(initialDark);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const tags = useMemo(() => allTags(notes), [notes]);

  const filtered = useMemo(() => {
    let arr = [...notes];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.content?.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (activeTags.length) {
      arr = arr.filter((n) => activeTags.every((t) => n.tags?.includes(t)));
    }
    const sorters: Record<typeof sort, (a: Note, b: Note) => number> = {
      updated: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      created: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      title: (a, b) => (a.title || '').localeCompare(b.title || ''),
    };
    arr.sort(sorters[sort]);
    return arr;
  }, [notes, query, activeTags, sort]);

  const onCreate = () => {
    if (READONLY) return;
    setEditing(null);
    setModalOpen(true);
  };

  const onEdit = (note: Note) => {
    if (READONLY) return;
    setEditing(note);
    setModalOpen(true);
  };

  const handleSave = (payload: Pick<Note, 'title' | 'content' | 'tags'>) => {
    if (editing) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editing.id ? { ...n, ...payload, updatedAt: new Date().toISOString() } : n,
        ),
      );
    } else {
      setNotes((prev) => [
        ...prev,
        {
          id: uid(),
          title: payload.title,
          content: payload.content,
          tags: payload.tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (READONLY) return;
    if (!confirm('このノートを削除しますか？')) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const toggleTag = (t: string) => {
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const clearAll = () => {
    if (READONLY) return;
    if (!confirm('すべてのノートを削除し、初期化しますか？')) return;
    setNotes([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const doExport = () => {
    const filename = `study-notes-${new Date().toISOString().slice(0, 10)}.json`;
    download(filename, JSON.stringify(notes, null, 2));
  };

  const fileRef = useRef<HTMLInputElement | null>(null);
  const doImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(String(evt.target?.result || '[]'));
        if (!Array.isArray(data)) throw new Error('Invalid JSON');
        const normalized: Note[] = data.map((n: any) => ({
          id: String(n.id ?? uid()),
          title: String(n.title ?? ''),
          content: String(n.content ?? ''),
          tags: Array.isArray(n.tags) ? n.tags.map((t: any) => String(t)) : [],
          createdAt: String(n.createdAt ?? new Date().toISOString()),
          updatedAt: String(n.updatedAt ?? new Date().toISOString()),
        }));
        setNotes(normalized);
        alert('インポートしました！');
      } catch (err: any) {
        alert('インポートに失敗しました: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Study Notes Hub</h1>
            <p className="text-zinc-500 text-sm">自分の勉強を積み上げる、軽量で高速な個人ナレッジベース。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              title="ダーク / ライト切替"
            >
              {dark ? '🌙' : '☀️'}
            </button>
            {!READONLY && (
              <button
                onClick={onCreate}
                className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                新規ノート
              </button>
            )}
            <button
              onClick={doExport}
              className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              エクスポート
            </button>
            {!READONLY && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  インポート
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  onChange={doImport}
                  className="hidden"
                />
                <button
                  onClick={clearAll}
                  className="px-3 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50"
                >
                  全消去
                </button>
              </>
            )}
          </div>
        </div>

        {/* 公開モード表示 */}
        {READONLY && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 px-4 py-2 text-sm">
            公開モード（読み取り専用）です。編集はできません。データは <code>/notes.json</code> から配信しています。
          </div>
        )}

        {/* Controls */}
        <div className="grid gap-3 md:grid-cols-3 mb-5">
          <div className="md:col-span-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索（タイトル / 本文 / タグ）"
              className="w-full px-4 py-2 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-500">ソート</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            >
              <option value="updated">更新が新しい順</option>
              <option value="created">作成が新しい順</option>
              <option value="title">タイトル順</option>
            </select>
          </div>
        </div>

        {/* Tag filter */}
        {tags.length ? (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={classNames(
                  'text-xs px-3 py-1.5 rounded-full border',
                  activeTags.includes(t)
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                )}
              >
                #{t}
              </button>
            ))}
            {activeTags.length ? (
              <button
                onClick={() => setActiveTags([])}
                className="text-xs px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                フィルタ解除
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Notes list */}
        {notes.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                onEdit={() => onEdit(n)}
                onDelete={() => handleDelete(n.id)}
                onQuickTag={(t) =>
                  setActiveTags((prev) => (prev.includes(t) ? prev : [...prev, t]))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {!READONLY && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? 'ノートを編集' : '新規ノート'}
        >
          <NoteEditor initial={editing ?? undefined} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}
