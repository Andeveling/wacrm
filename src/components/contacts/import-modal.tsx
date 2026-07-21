'use client';

import { AlertTriangle, CheckCircle, FileText, Loader2, Tag, Upload, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { dedupeByPhone } from '@/lib/contacts/dedupe';
import { type ParsedContactRow, parseContactCsv } from '@/lib/contacts/parse-contact-csv';
import { resolveContactIdentity } from '@/lib/contacts/resolve-identity';
import { resolveImportTagIds } from '@/lib/contacts/resolve-import-tags';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const DEFAULT_TAG_COLOR = '#3b82f6';
const PREVIEW_LIMIT = 5;

function truncateFilename(name: string, max = 48): string {
  if (name.length <= max) return name;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.slice(0, name.length - ext.length);
  const keep = max - ext.length - 1;
  return `${base.slice(0, Math.max(keep, 12))}…${ext}`;
}

function PreviewCell({ value, mono, maxWidth = 'max-w-[9rem]' }: { value: string; mono?: boolean; maxWidth?: string }) {
  return (
    <span className={cn('block truncate', maxWidth, mono && 'font-mono text-[11px]')} title={value}>
      {value}
    </span>
  );
}

function ImportPreviewTags({ tagNames, tagColorByKey }: { tagNames: string[]; tagColorByKey: Map<string, string> }) {
  const t = useTranslations('Contacts.importModal');

  if (tagNames.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex min-w-[4.5rem] flex-wrap gap-1">
      {tagNames.map((name) => {
        const color = tagColorByKey.get(name.trim().toLowerCase()) ?? DEFAULT_TAG_COLOR;
        const isKnown = tagColorByKey.has(name.trim().toLowerCase());
        return (
          <span
            key={name}
            className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[10px] leading-none"
            style={{
              backgroundColor: `${color}18`,
              color,
              border: `1px solid ${color}${isKnown ? '55' : '30'}`,
            }}
            title={isKnown ? name : t('willBeCreated', { name })}
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="truncate">{name}</span>
          </span>
        );
      })}
    </div>
  );
}

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportModal({ open, onOpenChange, onImported }: ImportModalProps) {
  const t = useTranslations('Contacts.importModal');
  const supabase = createClient();
  const { accountId, canEditSettings } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedContactRow[]>([]);
  const [hasTagsColumn, setHasTagsColumn] = useState(false);
  const [hasCompanyColumn, setHasCompanyColumn] = useState(false);
  const [tagColorByKey, setTagColorByKey] = useState<Map<string, string>>(new Map());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    existing: number;
    restored: number;
    failed: number;
    tagsAssigned: number;
  } | null>(null);

  function reset() {
    setFile(null);
    setParsedRows([]);
    setHasTagsColumn(false);
    setHasCompanyColumn(false);
    setTagColorByKey(new Map());
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    const text = await selected.text();
    const { rows, hasTagsColumn: csvHasTags, hasCompanyColumn: csvHasCompany } = parseContactCsv(text);

    if (rows.length === 0) {
      toast.error(t('toastNoValidRows'));
      setParsedRows([]);
      setHasTagsColumn(false);
      setHasCompanyColumn(false);
      setTagColorByKey(new Map());
      return;
    }

    setParsedRows(rows);
    setHasTagsColumn(csvHasTags);
    setHasCompanyColumn(csvHasCompany);

    if (csvHasTags && accountId) {
      const { data: tags } = await supabase.from('tags').select('name, color').eq('account_id', accountId);

      const colors = new Map<string, string>();
      for (const tag of tags ?? []) {
        const key = tag.name.trim().toLowerCase();
        if (!colors.has(key)) colors.set(key, tag.color);
      }
      setTagColorByKey(colors);
    } else {
      setTagColorByKey(new Map());
    }
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');
      if (!accountId) throw new Error('Your profile is not linked to an account.');

      let created = 0;
      let existing = 0;
      let restored = 0;
      let failed = 0;

      // 1) De-dupe within the file by normalized phone, preserving the
      // first non-empty fields and collecting every incoming tag.
      const { unique, duplicates: inFileDupes } = dedupeByPhone(parsedRows, (first, duplicate) => ({
        ...first,
        name: first.name || duplicate.name,
        email: first.email || duplicate.email,
        company: first.company || duplicate.company,
        tagNames: [...new Set([...first.tagNames, ...duplicate.tagNames])],
      }));
      existing += inFileDupes;

      // 2) Resolve tag names → ids (admin+ may auto-create missing tags).
      //    Skip the round-trip when the import carries no tag names.
      const allTagNames = unique.flatMap((row) => row.tagNames);
      let tagIdByKey = new Map<string, string>();
      let skippedNames: string[] = [];
      if (allTagNames.length > 0) {
        ({ tagIdByKey, skippedNames } = await resolveImportTagIds(supabase, {
          accountId,
          userId: user.id,
          tagNames: allTagNames,
          canCreateTags: canEditSettings,
        }));
      }

      // 3) Resolve every identity through the shared policy. Archived
      //    matches are restored and merged; active matches are skipped.
      let tagsAssigned = 0;
      for (const row of unique) {
        try {
          const tagIds = row.tagNames.map((name) => tagIdByKey.get(name.trim().toLowerCase())).filter((id): id is string => Boolean(id));
          const identity = await resolveContactIdentity(supabase, {
            accountId,
            auditUserId: user.id,
            phone: row.phone,
            name: row.name,
            email: row.email,
            company: row.company,
            tagIds,
            intent: 'restore',
          });
          if (identity) {
            if (identity.status === 'created') created++;
            else if (identity.status === 'restored') restored++;
            else existing++;
            tagsAssigned += tagIds.length;
          }
        } catch {
          failed++;
        }
      }

      setResult({ created, existing, restored, failed, tagsAssigned });
      if (created + restored > 0) {
        toast.success(t('toastImported', { count: created + restored }));
        onImported();
      }
      if (tagsAssigned > 0) {
        toast.success(t('toastTagsAssigned', { count: tagsAssigned }));
      }
      if (skippedNames.length > 0) {
        const sample = skippedNames.slice(0, 3).join(', ');
        const more = skippedNames.length > 3 ? ` (+${skippedNames.length - 3} more)` : '';
        toast.info(t('toastTagsSkipped', { sample, more }));
      }
      if (existing > 0) {
        toast.info(t('toastExisting', { count: existing }));
      }
      if (failed > 0) {
        toast.error(t('toastFailed', { count: failed }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('toastError');
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  const preview = parsedRows.slice(0, PREVIEW_LIMIT);
  // Tags: OR — show when the CSV declares a column or preview rows carry
  // values, so an all-empty tags column still renders for validation.
  const previewHasTags = hasTagsColumn || preview.some((row) => row.tagNames.length > 0);
  // Company: AND — hide unless the CSV declares it and preview has data,
  // avoiding an all-dash column that wastes horizontal space.
  const previewHasCompany = hasCompanyColumn && preview.some((row) => row.company?.trim());

  const tagStats = useMemo(() => {
    const names = new Set<string>();
    let rowsWithTags = 0;
    for (const row of parsedRows) {
      if (row.tagNames.length === 0) continue;
      rowsWithTags++;
      for (const name of row.tagNames) names.add(name.trim().toLowerCase());
    }
    return { unique: names.size, rowsWithTags };
  }, [parsedRows]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden border-border/80 bg-popover p-0 text-popover-foreground sm:max-w-2xl">
        <div className="shrink-0 space-y-4 border-border/80 border-b px-6 pt-6 pb-5">
          <DialogHeader className="gap-1.5">
            <DialogTitle className="text-lg text-popover-foreground">{t('title')}</DialogTitle>
            <DialogDescription
              className="text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t.markup('desc', {
                  phoneCode: (chunks) => `<code class="rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">${chunks}</code>`,
                  nameCode: (chunks) => `<code class="rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">${chunks}</code>`,
                  emailCode: (chunks) => `<code class="rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">${chunks}</code>`,
                  companyCode: (chunks) => `<code class="rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">${chunks}</code>`,
                  tagsCode: (chunks) => `<code class="rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">${chunks}</code>`,
                }),
              }}
            />
          </DialogHeader>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-left transition-all',
              file
                ? 'border-primary/35 bg-primary/[0.04]'
                : 'border-border/80 bg-background/40 hover:border-primary/40 hover:bg-background/70'
            )}
          >
            {file ? (
              <>
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25">
                  <FileText className="size-5 text-primary" />
                </div>
                <p className="max-w-full truncate px-2 font-medium text-popover-foreground text-sm" title={file.name}>
                  {truncateFilename(file.name)}
                </p>
                <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-[11px] text-muted-foreground">
                  {t('rowsReady', { count: parsedRows.length })}
                </span>
              </>
            ) : (
              <>
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted/80 ring-1 ring-border/80 transition-colors group-hover:bg-muted">
                  <Upload className="size-5 text-muted-foreground group-hover:text-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">{t('uploadDropzone')}</p>
                <p className="text-[11px] text-muted-foreground">{t('uploadHint')}</p>
              </>
            )}
          </button>

          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {preview.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
                  {t('preview', { count: preview.length })}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tagStats.rowsWithTags > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/90 px-2 py-0.5 text-[11px] text-muted-foreground">
                      <Tag className="size-3 text-primary/80" />
                      {t('previewTags', {
                        tags: tagStats.unique,
                        contacts: tagStats.rowsWithTags,
                      })}
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border ring-1 ring-border/50">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-xs">
                    <thead>
                      <tr className="border-border border-b bg-background/60">
                        <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">{t('columns.phone')}</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">{t('columns.name')}</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">{t('columns.email')}</th>
                        {previewHasCompany && (
                          <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                            {t('columns.company')}
                          </th>
                        )}
                        {previewHasTags && (
                          <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">{t('columns.tags')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {preview.map((row) => (
                        <tr
                          key={row.phone || row.name || JSON.stringify(row)}
                          className="bg-popover/40 transition-colors hover:bg-muted/30"
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                            <PreviewCell value={row.phone} mono maxWidth="max-w-[7.5rem]" />
                          </td>
                          <td className="px-3 py-2 text-popover-foreground">
                            <PreviewCell value={row.name || '—'} maxWidth="max-w-[8.5rem]" />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <PreviewCell value={row.email || '—'} maxWidth="max-w-[10rem]" />
                          </td>
                          {previewHasCompany && (
                            <td className="px-3 py-2 text-muted-foreground">
                              <PreviewCell value={row.company || '—'} maxWidth="max-w-[7rem]" />
                            </td>
                          )}
                          {previewHasTags && (
                            <td className="px-3 py-2 align-top">
                              <ImportPreviewTags tagNames={row.tagNames} tagColorByKey={tagColorByKey} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsedRows.length > PREVIEW_LIMIT && (
                <p className="text-center text-[11px] text-muted-foreground">
                  {t('moreRows', { count: parsedRows.length - PREVIEW_LIMIT })}
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="font-medium text-popover-foreground text-sm">{t('importComplete')}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {result.created > 0 && (
                  <div className="flex items-center gap-1.5 text-primary text-sm">
                    <CheckCircle className="size-4 shrink-0" />
                    {t('resultCreated', { count: result.created })}
                  </div>
                )}
                {result.restored > 0 && (
                  <div className="flex items-center gap-1.5 text-primary text-sm">
                    <CheckCircle className="size-4 shrink-0" />
                    {t('resultRestored', { count: result.restored })}
                  </div>
                )}
                {result.tagsAssigned > 0 && (
                  <div className="flex items-center gap-1.5 text-cyan-400 text-sm">
                    <CheckCircle className="size-4 shrink-0" />
                    {t('resultTags', { count: result.tagsAssigned })}
                  </div>
                )}
                {result.existing > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-400 text-sm">
                    <AlertTriangle className="size-4 shrink-0" />
                    {t('resultExisting', { count: result.existing })}
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5 text-red-400 text-sm">
                    <XCircle className="size-4 shrink-0" />
                    {t('resultFailed', { count: result.failed })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-0 shrink-0 gap-2 border-border/80 border-t bg-background/50 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            {result ? t('close') : t('cancel')}
          </Button>
          {!result && (
            <Button
              type="button"
              disabled={parsedRows.length === 0 || importing}
              onClick={handleImport}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {importing && <Loader2 className="size-4 animate-spin" />}
              {parsedRows.length > 0 ? t('importBtn', { count: parsedRows.length }) : t('importBtn', { count: 0 })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
