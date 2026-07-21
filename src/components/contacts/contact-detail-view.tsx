'use client';

import { Building2, Check, Copy, DollarSign, LayoutTemplate, Loader2, Mail, Phone, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TemplatePicker, type TemplateSendValues } from '@/components/inbox/template-picker';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { formatCurrency } from '@/lib/currency';
import { createClient } from '@/lib/supabase/client';
import type { Contact, ContactNote, CustomField, Deal, MessageTemplate, Tag } from '@/types';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

export function ContactDetailView({ open, onOpenChange, contactId, onUpdated }: ContactDetailViewProps) {
  const t = useTranslations('Contacts.detailView');
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const isArchived = !!contact?.archived_at;
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Send template — lets the business initiate (or re-open) a conversation
  // with this contact by sending an approved template. The send route
  // find-or-creates the conversation, so no inbound message is required.
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Details tab
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  // Tags tab
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // Notes tab
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Custom fields tab
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Deals tab
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase.from('contacts').select('*').eq('id', contactId).single();

    if (data) {
      setContact(data);
      setEditName(data.name ?? '');
      setEditPhone(data.phone);
      setEditEmail(data.email ?? '');
      setEditCompany(data.company ?? '');
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    if (!contactId) return;

    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) {
      setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase]);

  const fetchNotes = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotes(true);

    const { data } = await supabase.from('contact_notes').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });

    if (data) setNotes(data);
    setLoadingNotes(false);
  }, [contactId, supabase]);

  const fetchCustomFields = useCallback(async () => {
    if (!contactId) return;
    setLoadingCustom(true);

    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').order('field_name'),
      supabase.from('contact_custom_values').select('*').eq('contact_id', contactId),
    ]);

    if (fieldsRes.data) setCustomFields(fieldsRes.data);
    if (valuesRes.data) {
      const map: Record<string, string> = {};
      valuesRes.data.forEach((v) => {
        map[v.custom_field_id] = v.value ?? '';
      });
      setCustomValues(map);
    }
    setLoadingCustom(false);
  }, [contactId, supabase]);

  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
      fetchTags();
      fetchNotes();
      fetchCustomFields();
      fetchDeals();
    }
  }, [open, contactId, fetchContact, fetchTags, fetchNotes, fetchCustomFields, fetchDeals]);

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveDetails() {
    if (isArchived || !contactId || !editPhone.trim()) {
      toast.error(t('toastPhoneRequired'));
      return;
    }

    setSavingDetails(true);
    const { error } = await supabase
      .from('contacts')
      .update({
        name: editName.trim() || null,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        company: editCompany.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) {
      toast.error(t('toastUpdateFailed'));
    } else {
      toast.success(t('toastUpdated'));
      fetchContact();
      onUpdated();
    }
    setSavingDetails(false);
  }

  async function toggleTag(tagId: string) {
    if (isArchived || !contactId) return;
    setSavingTags(true);

    const isSelected = contactTagIds.includes(tagId);

    try {
      if (isSelected) {
        await deleteContactTag(contactId, tagId);
        setContactTagIds((prev) => prev.filter((id) => id !== tagId));
      } else {
        await addContactTag(contactId, tagId);
        setContactTagIds((prev) => [...prev, tagId]);
      }
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toastUpdateFailed'));
    }
    setSavingTags(false);
  }

  async function addNote() {
    if (!contactId || !newNote.trim()) return;
    setSavingNote(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) {
      toast.error(t('toastNotAuthenticated'));
      setSavingNote(false);
      return;
    }

    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      account_id: accountId,
      user_id: user.id,
      note_text: newNote.trim(),
    });

    if (error) {
      toast.error(t('toastNoteAddFailed'));
    } else {
      setNewNote('');
      fetchNotes();
      toast.success(t('toastNoteAdded'));
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase.from('contact_notes').delete().eq('id', noteId);

    if (error) {
      toast.error(t('toastNoteDeleteFailed'));
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success(t('toastNoteDeleted'));
    }
  }

  async function saveCustomFields() {
    if (!contactId) return;
    setSavingCustom(true);

    try {
      // Delete existing values and re-insert
      await supabase.from('contact_custom_values').delete().eq('contact_id', contactId);

      const rows = Object.entries(customValues)
        .filter(([, val]) => val.trim())
        .map(([fieldId, val]) => ({
          contact_id: contactId,
          custom_field_id: fieldId,
          value: val.trim(),
        }));

      if (rows.length > 0) {
        const { error } = await supabase.from('contact_custom_values').insert(rows);
        if (error) throw error;
      }

      toast.success(t('toastCustomFieldsSaved'));
    } catch {
      toast.error(t('toastCustomFieldsFailed'));
    }
    setSavingCustom(false);
  }

  async function handleSendTemplate(template: MessageTemplate, values: TemplateSendValues) {
    if (!contactId) return;
    setSendingTemplate(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // No conversation_id — the route find-or-creates one for this
          // contact, mirroring the inbox template-send payload otherwise.
          contact_id: contactId,
          message_type: 'template',
          template_name: template.name,
          template_language: template.language,
          template_message_params: {
            body: values.body,
            headerText: values.headerText,
            buttonParams: values.buttonParams,
          },
          template_params: values.body,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = payload?.error || `HTTP ${res.status}`;
        toast.error(t('toastTemplateFailed', { reason }));
        return;
      }

      toast.success(t('toastTemplateSent', { name: template.name }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'network error';
      toast.error(`Failed to send template: ${reason}`);
    } finally {
      setSendingTemplate(false);
    }
  }

  function getInitials(name?: string | null) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full border-border bg-popover p-0 text-popover-foreground sm:max-w-lg">
          {loading || !contact ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Header */}
              <SheetHeader className="border-border/50 border-b p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-12 border border-border bg-muted">
                    <AvatarFallback className="bg-primary/10 font-medium text-primary text-sm">{getInitials(contact.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate text-popover-foreground">{contact.name || t('unnamed')}</SheetTitle>
                    <SheetDescription className="mt-0.5 text-muted-foreground text-xs">{t('contactDetailsDesc')}</SheetDescription>
                    {isArchived && (
                      <Badge variant="outline" className="mt-1 text-muted-foreground">
                        {t('archivedReadOnly')}
                      </Badge>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                      <button
                        type="button"
                        onClick={copyPhone}
                        className="flex cursor-pointer items-center gap-1 transition-colors hover:text-primary"
                      >
                        <Phone className="size-3" />
                        {contact.phone}
                        {copiedPhone ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
                      </button>
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" />
                          {contact.email}
                        </span>
                      )}
                      {contact.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3" />
                          {contact.company}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={() => setTemplatePickerOpen(true)}
                    disabled={sendingTemplate || isArchived}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {sendingTemplate ? <Loader2 className="size-4 animate-spin" /> : <LayoutTemplate className="size-4" />}
                    {t('sendTemplateBtn')}
                  </Button>
                </div>
              </SheetHeader>

              {/* Tabs */}
              <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="mx-4 mt-3 border-border border-b bg-muted/50">
                  <TabsTrigger value="details" className="text-muted-foreground data-active:bg-muted data-active:text-primary">
                    {t('tabs.details')}
                  </TabsTrigger>
                  <TabsTrigger value="tags" className="text-muted-foreground data-active:bg-muted data-active:text-primary">
                    {t('tabs.tags', { fallback: 'Tags' })}
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-muted-foreground data-active:bg-muted data-active:text-primary">
                    {t('tabs.notes')}
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="text-muted-foreground data-active:bg-muted data-active:text-primary">
                    {t('tabs.custom')}
                  </TabsTrigger>
                  <TabsTrigger value="deals" className="text-muted-foreground data-active:bg-muted data-active:text-primary">
                    {t('tabs.deals')}
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="flex-1 overflow-y-auto px-4 py-3">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">{t('company', { fallback: 'Name' })}</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={isArchived}
                        className="h-8 border-border bg-muted text-foreground text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">
                        {t('phone')} <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        disabled={isArchived}
                        className="h-8 border-border bg-muted text-foreground text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">{t('email')}</Label>
                      <Input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        disabled={isArchived}
                        className="h-8 border-border bg-muted text-foreground text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">{t('company')}</Label>
                      <Input
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        disabled={isArchived}
                        className="h-8 border-border bg-muted text-foreground text-sm"
                      />
                    </div>
                    <Button
                      onClick={saveDetails}
                      disabled={isArchived || savingDetails}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      size="sm"
                    >
                      {savingDetails ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      {t('saveChangesBtn')}
                    </Button>
                  </div>
                </TabsContent>

                {/* Tags Tab */}
                <TabsContent value="tags" className="flex-1 overflow-y-auto px-4 py-3">
                  <div className="space-y-3">
                    <p className="text-muted-foreground text-xs">{t('tagsTab.clickTagDesc')}</p>
                    {allTags.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{t('tagsTab.noTagsAvailable')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allTags.map((tag) => {
                          const selected = contactTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              disabled={isArchived || savingTags}
                              className={`inline-flex cursor-pointer items-center rounded-full px-3 py-1 font-medium text-xs transition-all ${
                                selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-border' : 'opacity-50 hover:opacity-80'
                              }`}
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                              }}
                            >
                              {selected && <Check className="mr-1 size-3" />}
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="flex min-h-0 flex-1 flex-col px-4 py-3">
                  <div className="mb-3 space-y-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      disabled={isArchived}
                      placeholder={t('notesTab.placeholder')}
                      className="min-h-[60px] resize-none border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground"
                    />
                    <Button
                      onClick={addNote}
                      disabled={isArchived || !newNote.trim() || savingNote}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      size="sm"
                    >
                      {savingNote ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                      {t('notesTab.save')}
                    </Button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {loadingNotes ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : notes.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground text-sm">{t('notesTab.noNotes')}</p>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="group rounded-lg border border-border/50 bg-muted/50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="flex-1 whitespace-pre-wrap text-muted-foreground text-sm">{note.note_text}</p>
                            <button
                              type="button"
                              onClick={() => deleteNote(note.id)}
                              disabled={isArchived}
                              className="shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          <p className="mt-1.5 text-muted-foreground text-xs">
                            {new Date(note.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Custom Fields Tab */}
                <TabsContent value="custom" className="flex-1 overflow-y-auto px-4 py-3">
                  {loadingCustom ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : customFields.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground text-sm">{t('noCustomFields')}</p>
                  ) : (
                    <div className="space-y-3">
                      {customFields.map((field) => (
                        <div key={field.id} className="space-y-1.5">
                          <Label className="text-muted-foreground text-xs capitalize">{field.field_name}</Label>
                          <Input
                            value={customValues[field.id] ?? ''}
                            onChange={(e) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }))
                            }
                            disabled={isArchived}
                            placeholder={t('enterCustomField', { name: field.field_name })}
                            className="h-8 border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground"
                          />
                        </div>
                      ))}
                      <Button
                        onClick={saveCustomFields}
                        disabled={isArchived || savingCustom}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                        size="sm"
                      >
                        {savingCustom ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        {t('saveCustomFieldsBtn')}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* Deals Tab */}
                <TabsContent value="deals" className="flex-1 overflow-y-auto px-4 py-3">
                  {loadingDeals ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  ) : deals.length === 0 ? (
                    <p className="text-muted-foreground text-xs">{t('dealsTab.noDeals')}</p>
                  ) : (
                    <div className="space-y-2">
                      {deals.map((deal) => (
                        <div key={deal.id} className="rounded-lg border border-border bg-muted/50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-foreground text-sm">{deal.title}</p>
                            {deal.stage && (
                              <span
                                className="shrink-0 rounded-full px-1.5 py-0.5 font-medium text-[10px]"
                                style={{
                                  backgroundColor: `${deal.stage.color}20`,
                                  color: deal.stage.color,
                                }}
                              >
                                {deal.stage.name}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-muted-foreground text-xs">
                            <span className="flex items-center gap-1">
                              <DollarSign className="size-3" />
                              {formatCurrency(deal.value ?? 0, deal.currency || defaultCurrency)}
                            </span>
                            {deal.status && deal.status !== 'open' && (
                              <span className={deal.status === 'won' ? 'text-primary' : 'text-red-400'}>{deal.status}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <TemplatePicker open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} onSelect={handleSendTemplate} />
    </>
  );
}
