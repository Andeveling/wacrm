"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import type { Contact, Tag } from "@/types";

export const PAGE_SIZE = 25;

export type ContactWithTags = Contact & { tags?: Tag[] };
export type ContactStatus = "active" | "archived";

interface UseContactsOptions {
  onContactsWillRefresh?: () => void;
}

export function useContacts({
  onContactsWillRefresh,
}: UseContactsOptions = {}) {
  const supabase = createClient();
  const t = useTranslations("Contacts.page");

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<ContactStatus>("active");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagsById, setTagsById] = useState<Record<string, Tag>>({});

  const latestRequestId = useRef(0);
  const onContactsWillRefreshRef = useRef(onContactsWillRefresh);
  onContactsWillRefreshRef.current = onContactsWillRefresh;

  const loadTags = useCallback(async () => {
    const { data } = await supabase.from("tags").select("*");
    if (!data) return;
    const tagsById: Record<string, Tag> = {};
    data.forEach((row) => {
      tagsById[row.id] = row;
    });
    setTagsById(tagsById);
    setSelectedTagIds((prev) => {
      const pruned = prev.filter((id) => tagsById[id]);
      return pruned.length === prev.length ? prev : pruned;
    });
  }, [supabase]);

  const loadContacts = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    onContactsWillRefreshRef.current?.();

    const firstContactIndex = page * PAGE_SIZE;
    const lastContactIndex = firstContactIndex + PAGE_SIZE - 1;
    const searchTerm = search.trim();

    let matchingContacts: Contact[];
    let totalMatchingContacts: number;

    if (selectedTagIds.length > 0) {
      // Tag filter active — resolve it server-side (join + distinct +
      // windowed total count + pagination) so a tag covering many
      // contacts can't silently truncate the result or overflow an IN
      // clause. See migration 025_filter_contacts_by_tags.
      const { data, error } = await supabase.rpc("filter_contacts_by_tags", {
        p_tag_ids: selectedTagIds,
        p_search: searchTerm || null,
        p_limit: PAGE_SIZE,
        p_offset: firstContactIndex,
        p_status: status,
      });
      if (requestId !== latestRequestId.current) return;
      if (error) {
        toast.error(t("toastFailedLoad"));
        setLoading(false);
        return;
      }
      const filteredContacts = (data ?? []) as {
        contact: Contact;
        total_count: number;
      }[];
      matchingContacts = filteredContacts.map((row) => row.contact);
      totalMatchingContacts =
        filteredContacts.length > 0
          ? Number(filteredContacts[0].total_count)
          : 0;
    } else {
      let query = supabase
        .from("contacts")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(firstContactIndex, lastContactIndex);

      query =
        status === "active"
          ? query.is("archived_at", null)
          : query.not("archived_at", "is", null);

      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        query = query.or(
          `name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern}`,
        );
      }

      const { data, count: exactCount, error } = await query;
      if (requestId !== latestRequestId.current) return;
      if (error) {
        toast.error(t("toastFailedLoad"));
        setLoading(false);
        return;
      }
      matchingContacts = data ?? [];
      totalMatchingContacts = exactCount ?? 0;
    }

    setTotalCount(totalMatchingContacts);

    if (matchingContacts.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const contactIds = matchingContacts.map((contact) => contact.id);
    const { data: contactTags } = await supabase
      .from("contact_tags")
      .select("contact_id, tag_id")
      .in("contact_id", contactIds);
    if (requestId !== latestRequestId.current) return;

    const tagsByContact: Record<string, string[]> = {};
    contactTags?.forEach((contactTag) => {
      if (!tagsByContact[contactTag.contact_id]) {
        tagsByContact[contactTag.contact_id] = [];
      }
      tagsByContact[contactTag.contact_id].push(contactTag.tag_id);
    });

    const contactsWithTags: ContactWithTags[] = matchingContacts.map((contact) => ({
      ...contact,
      tags: (tagsByContact[contact.id] ?? [])
        .map((tagId) => tagsById[tagId])
        .filter(Boolean),
    }));

    setContacts(contactsWithTags);
    setLoading(false);
  }, [supabase, page, search, selectedTagIds, tagsById, t, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadContacts();
  }, [loadContacts]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return {
    contacts,
    loading,
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(0);
    },
    page,
    setPage,
    totalCount,
    totalPages,
    hasNext: page < totalPages - 1,
    hasPrev: page > 0,
    status,
    setStatus: (next: ContactStatus) => {
      setStatus(next);
      setPage(0);
    },
    selectedTagIds,
    toggleTagFilter: (tagId: string) => {
      setSelectedTagIds((prev) =>
        prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId],
      );
      setPage(0);
    },
    clearTagFilters: () => {
      setSelectedTagIds([]);
      setPage(0);
    },
    tagsById,
    allTags: Object.values(tagsById).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    hasActiveFilters: search.trim().length > 0 || selectedTagIds.length > 0,
    reloadContacts: loadContacts,
    reloadTags: loadTags,
    removeDisplayedContacts: (rows: ContactWithTags[]) => {
      const ids = new Set(rows.map((r) => r.id));
      setContacts((current) => current.filter((c) => !ids.has(c.id)));
      setTotalCount((count) => Math.max(0, count - rows.length));
    },
    restoreDisplayedContacts: (rows: ContactWithTags[]) => {
      if (rows.length === 0) return;
      setContacts((current) =>
        [...rows, ...current].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
      setTotalCount((count) => count + rows.length);
    },
  };
}

export type UseContactsReturn = ReturnType<typeof useContacts>;
