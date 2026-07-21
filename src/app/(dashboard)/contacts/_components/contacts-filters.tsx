'use client';

import { Filter, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ContactListQuery } from '@/lib/contacts/contact-list-query';
import type { Tag } from '@/types';

interface ContactsFiltersProps {
  status: ContactListQuery['status'];
  onStatusChange: (status: ContactListQuery['status']) => void;
  search: string;
  onSearchChange: (value: string) => void;
  allTags: Tag[];
  selectedTagIds: string[];
  tagsById: Record<string, Tag>;
  onToggleTag: (id: string) => void;
  onClearTags: () => void;
}

export function ContactsFilters({
  status,
  onStatusChange,
  search,
  onSearchChange,
  allTags,
  selectedTagIds,
  tagsById,
  onToggleTag,
  onClearTags,
}: ContactsFiltersProps) {
  const t = useTranslations('Contacts.page');

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['active', 'archived'] as const).map((nextStatus) => (
          <Button
            key={nextStatus}
            variant={status === nextStatus ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusChange(nextStatus)}
          >
            {t(nextStatus)}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="border-border bg-card pl-8 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <Popover>
          <PopoverTrigger render={<Button variant="outline" className="shrink-0 border-border text-muted-foreground hover:bg-muted" />}>
            <Filter className="size-4" />
            {t('filterByTags')}
            {selectedTagIds.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary px-1.5 font-semibold text-[10px] text-primary-foreground">
                {selectedTagIds.length}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <div className="flex items-center justify-between border-border border-b px-3 py-2">
              <span className="font-medium text-popover-foreground text-sm">{t('filterByTags')}</span>
              {selectedTagIds.length > 0 && (
                <button type="button" onClick={onClearTags} className="text-muted-foreground text-xs hover:text-foreground">
                  {t('clearAll')}
                </button>
              )}
            </div>
            {allTags.length === 0 ? (
              <p className="px-3 py-4 text-center text-muted-foreground text-sm">{t('noTagsYet')}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto py-1">
                {allTags.map((tag) => (
                  <label
                    key={tag.id}
                    htmlFor={`tag-filter-${tag.id}`}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`tag-filter-${tag.id}`}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => onToggleTag(tag.id)}
                      aria-label={`Filter by ${tag.name}`}
                    />
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="truncate text-popover-foreground text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {selectedTagIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedTagIds.map((id) => {
            const tag = tagsById[id];
            if (!tag) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[11px]"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
                <button type="button" onClick={() => onToggleTag(id)} aria-label={`Remove ${tag.name} filter`} className="hover:opacity-70">
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          <button type="button" onClick={onClearTags} className="px-1 text-muted-foreground text-xs hover:text-foreground">
            {t('clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}
