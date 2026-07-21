"use client";

import { Plus, SlidersHorizontal, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";

interface ContactsHeaderProps {
  totalCount: number;
  canEdit: boolean;
  canEditSettings: boolean;
  onAdd: () => void;
  onImport: () => void;
  onCustomFields: () => void;
}

export function ContactsHeader({
  totalCount,
  canEdit,
  canEditSettings,
  onAdd,
  onImport,
  onCustomFields,
}: ContactsHeaderProps) {
  const t = useTranslations("Contacts.page");

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalCount > 0
            ? t("subtitle", { count: totalCount })
            : t("subtitleZero")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {canEditSettings && (
          <Button
            variant="outline"
            onClick={onCustomFields}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <SlidersHorizontal className="size-4" />
            {t("customFieldsBtn")}
          </Button>
        )}
        <GatedButton
          variant="outline"
          canAct={canEdit}
          gateReason="add or import contacts"
          onClick={onImport}
          className="border-border text-muted-foreground hover:bg-muted"
        >
          <Upload className="size-4" />
          {t("importBtn")}
        </GatedButton>
        <GatedButton
          canAct={canEdit}
          gateReason="add or import contacts"
          onClick={onAdd}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="size-4" />
          {t("addContactBtn")}
        </GatedButton>
      </div>
    </div>
  );
}
