'use client';

import { ArrowLeft, Check, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/automations/trigger-meta';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Automation, AutomationLog, AutomationLogStepResult } from '@/types';

export default function AutomationLogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations('Automations.logs');

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [logs, setLogs] = useState<AutomationLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openLogId, setOpenLogId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [autRes, logRes] = await Promise.all([
          supabase.from('automations').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('automation_logs')
            .select('*, contact:contacts(id, name, phone)')
            .eq('automation_id', id)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);
        if (autRes.error) throw autRes.error;
        if (logRes.error) throw logRes.error;
        setAutomation(autRes.data as Automation | null);
        setLogs((logRes.data ?? []) as AutomationLog[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadError'));
      }
    }
    load();
  }, [id, t]);

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <Button variant="outline" onClick={() => router.push('/automations')}>
          {t('back')}
        </Button>
      </div>
    );
  }

  if (!automation || logs === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/automations')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('backAria')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-bold text-2xl text-foreground">{automation.name}</h1>
          <p className="mt-0.5 text-muted-foreground text-sm">{t('title')}</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-border border-dashed bg-card/40">
          <p className="text-foreground text-sm">{t('emptyTitle')}</p>
          <p className="mt-1 text-muted-foreground text-xs">{t('emptyDesc')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => {
            const isOpen = openLogId === log.id;
            return (
              <li key={log.id} className="rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenLogId(isOpen ? null : log.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <StatusBadge status={log.status} t={t} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground text-sm">
                      {log.contact?.name ?? log.contact?.phone ?? t('unknownContact')}
                    </div>
                    <div className="truncate text-muted-foreground text-xs">
                      {log.trigger_event} · {log.steps_executed?.length ?? 0}{' '}
                      {log.steps_executed?.length === 1
                        ? t('step', { count: 1 }).replace('1 ', '')
                        : t('stepPlural', { count: log.steps_executed?.length ?? 0 }).replace(/^[0-9]+ /, '')}
                    </div>
                  </div>
                  <div className="text-muted-foreground text-xs">{formatRelative(log.created_at)}</div>
                </button>
                {isOpen && (
                  <div className="border-border border-t px-4 py-3">
                    {log.error_message && (
                      <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300 text-xs">
                        {log.error_message}
                      </p>
                    )}
                    <ul className="space-y-1.5">
                      {(log.steps_executed ?? []).map((r, i) => (
                        <StepRow key={r.step_id ?? `step_${i}`} result={r} />
                      ))}
                      {(log.steps_executed ?? []).length === 0 && <li className="text-muted-foreground text-xs">{t('noSteps')}</li>}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: AutomationLog['status']; t: ReturnType<typeof useTranslations> }) {
  const classes =
    status === 'success'
      ? 'border-primary/30 bg-primary/10 text-primary'
      : status === 'partial'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-red-500/30 bg-red-500/10 text-red-300';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[11px]', classes)}>
      {t(`status.${status}`)}
    </span>
  );
}

function StepRow({ result }: { result: AutomationLogStepResult }) {
  const ok = result.status === 'success';
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full',
          ok ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-400'
        )}
        aria-hidden
      >
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className="text-muted-foreground">{result.step_type}</span>
      {result.detail && <span className="truncate text-muted-foreground">— {result.detail}</span>}
    </li>
  );
}
