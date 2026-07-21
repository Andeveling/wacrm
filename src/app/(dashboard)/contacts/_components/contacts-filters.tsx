"use client";

import { useTranslations } from "next-intl";
import { Filter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Tag } from "@/types";

import type { ContactStatus } from "../_hooks/use-contacts";

interface ContactsFiltersProps {
  status: ContactStatus;
  onStatusChange: (status: ContactStatus) => void;
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
  const t = useTranslations("Contacts.page");

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(["active", "archived"] as const).map((nextStatus) => (
          <Button
            key={nextStatus}
            variant={status === nextStatus ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusChange(nextStatus)}
          >
            {t(nextStatus)}
          </Button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:bg-muted shrink-0"
              />
            }
          >
            <Filter className="size-4" />
            {t("filterByTags")}
            {selectedTagIds.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {selectedTagIds.length}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-medium text-popover-foreground">
                {t("filterByTags")}
              </span>
              {selectedTagIds.length > 0 && (
                <button
                  type="button"
                  onClick={onClearTags}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("clearAll")}
                </button>
              )}
            </div>
            {allTags.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                {t("noTagsYet")}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto py-1">
                {allTags.map((tag) => (
                  <label
                    key={tag.id}
                    htmlFor={`tag-filter-${tag.id}`}
                    className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`tag-filter-${tag.id}`}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => onToggleTag(tag.id)}
                      aria-label={`Filter by ${tag.name}`}
                    />
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-popover-foreground truncate">
                      {tag.name}
                    </span>
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
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: tag.color + "20",
                  color: tag.color,
                }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => onToggleTag(id)}
                  aria-label={`Remove ${tag.name} filter`}
                  className="hover:opacity-70"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={onClearTags}
            className="text-xs text-muted-foreground hover:text-foreground px-1"
          >
            {t("clearAll")}
          </button>
        </div>
      )}
    </div>
  );
}
