"use client";

import {
  Archive,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GatedButton } from "@/components/ui/gated-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Contact } from "@/types";

import type { ContactStatus, ContactWithTags } from "../_hooks/use-contacts";

interface ContactsTableProps {
  contacts: ContactWithTags[];
  loading: boolean;
  hasActiveFilters: boolean;
  status: ContactStatus;
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
  const t = useTranslations("Contacts.page");

  const allOnPageSelected =
    contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));
  const someOnPageSelected = contacts.some((c) => selectedIds.has(c.id));

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allOnPageSelected}
                indeterminate={!allOnPageSelected && someOnPageSelected}
                onCheckedChange={onSelectAll}
                disabled={contacts.length === 0}
                aria-label="Select all contacts on this page"
              />
            </TableHead>
            <TableHead className="text-muted-foreground">
              {t("tableColumns.name")}
            </TableHead>
            <TableHead className="text-muted-foreground">
              {t("tableColumns.phone")}
            </TableHead>
            <TableHead className="text-muted-foreground hidden md:table-cell">
              {t("tableColumns.email")}
            </TableHead>
            <TableHead className="text-muted-foreground hidden lg:table-cell">
              {t("tableColumns.company")}
            </TableHead>
            <TableHead className="text-muted-foreground hidden md:table-cell">
              {t("tableColumns.tags")}
            </TableHead>
            <TableHead className="text-muted-foreground hidden lg:table-cell">
              {t("tableColumns.createdAt")}
            </TableHead>
            <TableHead className="text-muted-foreground w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow className="border-border">
              <TableCell colSpan={8} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {t("loading")}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : contacts.length === 0 ? (
            <TableRow className="border-border">
              <TableCell colSpan={8} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <Users className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? t("noContactsMatch")
                      : t("noContactsYet")}
                  </p>
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
                      {t("addFirstContact")}
                    </GatedButton>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className="border-border hover:bg-muted/50 cursor-pointer"
                onClick={() => onOpenDetail(contact.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(contact.id)}
                    onCheckedChange={() => onSelect(contact.id)}
                    aria-label={`Select ${contact.name || contact.phone}`}
                  />
                </TableCell>
                <TableCell className="text-foreground font-medium">
                  {contact.name || (
                    <span className="text-muted-foreground italic">
                      {t("unnamed")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {contact.phone}
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell text-sm">
                  {contact.email || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground hidden lg:table-cell text-sm">
                  {contact.company || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {contact.tags && contact.tags.length > 0 ? (
                      contact.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: tag.color + "20",
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
                      <span className="text-[10px] text-muted-foreground">
                        +{contact.tags.length - 3}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs hidden lg:table-cell">
                  {new Date(contact.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
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
                    <DropdownMenuContent
                      align="end"
                      className="bg-popover border-border"
                    >
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(contact);
                        }}
                        className="text-popover-foreground focus:bg-muted focus:text-foreground"
                      >
                        <Pencil className="size-4" />
                        {t("editAction")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchiveOrRestore(contact.id);
                        }}
                      >
                        {status === "active" ? (
                          <Archive className="size-4" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        {t(
                          status === "active"
                            ? "archiveAction"
                            : "restoreAction",
                        )}
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
