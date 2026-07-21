'use client';

import { Archive, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GatedButton } from '@/components/ui/gated-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ContactListItem } from '@/lib/contacts/contact-list';
import type { ContactListQuery } from '@/lib/contacts/contact-list-query';
import type { Contact } from '@/types';

interface ContactsTableProps {
  contacts: ContactListItem[];
  loading: boolean;
  hasActiveFilters: boolean;
  status: ContactListQuery['status'];
  selectedIds: Set<string>;
  canEdit: boolean;
  onSelectAll: () => void;
  onSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onArchiveOrRestore: (id: string) => void;
  onAdd: () => void;
}

export function ContactsTable({
  contacts,
  loading,
  hasActiveFilters,
  status,
  selectedIds,
  canEdit,
  onSelectAll,
  onSelect,
  onOpenDetail,
  onEdit,
  onArchiveOrRestore,
  onAdd,
}: ContactsTableProps) {
  const t = useTranslations('Contacts.page');

  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));
  const someOnPageSelected = contacts.some((c) => selectedIds.has(c.id));

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="grid w-10 items-center">
              <Checkbox
                checked={allOnPageSelected}
                indeterminate={!allOnPageSelected && someOnPageSelected}
                onCheckedChange={onSelectAll}
                disabled={contacts.length === 0}
                aria-label="Select all contacts on this page"
              />
            </TableHead>
            <TableHead className="text-muted-foreground">{t('tableColumns.name')}</TableHead>
            <TableHead className="text-muted-foreground">{t('tableColumns.phone')}</TableHead>
            <TableHead className="hidden text-muted-foreground md:table-cell">{t('tableColumns.email')}</TableHead>
            <TableHead className="hidden text-muted-foreground lg:table-cell">{t('tableColumns.company')}</TableHead>
            <TableHead className="hidden text-muted-foreground md:table-cell">{t('tableColumns.tags')}</TableHead>
            <TableHead className="hidden text-muted-foreground lg:table-cell">{t('tableColumns.createdAt')}</TableHead>
            <TableHead className="w-12 text-muted-foreground" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow className="border-border">
              <TableCell colSpan={8} className="py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">{t('loading')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : contacts.length === 0 ? (
            <TableRow className="border-border">
              <TableCell colSpan={8} className="py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Users className="size-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">{hasActiveFilters ? t('noContactsMatch') : t('noContactsYet')}</p>
                  {!hasActiveFilters && (
                    <GatedButton
                      canAct={canEdit}
                      gateReason="add or import contacts"
                      variant="outline"
                      size="sm"
                      onClick={onAdd}
                      className="mt-2 border-border text-muted-foreground hover:bg-muted"
                    >
                      <Plus className="size-3.5" />
                      {t('addFirstContact')}
                    </GatedButton>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer border-border hover:bg-muted/50"
                onClick={() => onOpenDetail(contact.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()} className="grid w-10 items-center">
                  <Checkbox
                    checked={selectedIds.has(contact.id)}
                    onCheckedChange={() => onSelect(contact.id)}
                    aria-label={`Select ${contact.name || contact.phone}`}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {contact.name || <span className="text-muted-foreground italic">{t('unnamed')}</span>}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground text-xs">{contact.phone}</TableCell>
                <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                  {contact.email || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="hidden text-muted-foreground text-sm lg:table-cell">
                  {contact.company || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {contact.tags && contact.tags.length > 0 ? (
                      contact.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[10px]"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                    {contact.tags && contact.tags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{contact.tags.length - 3}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground text-xs lg:table-cell">
                  {new Date(contact.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-border bg-popover">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(contact);
                        }}
                        className="text-popover-foreground focus:bg-muted focus:text-foreground"
                      >
                        <Pencil className="size-4" />
                        {t('editAction')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchiveOrRestore(contact.id);
                        }}
                      >
                        {status === 'active' ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}
                        {t(status === 'active' ? 'archiveAction' : 'restoreAction')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
