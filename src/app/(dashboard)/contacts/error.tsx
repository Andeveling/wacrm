"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function ContactsError({
  unstable_retry,
}: {
  unstable_retry: () => void;
}) {
  const t = useTranslations("Contacts.page");

  return (
    <div className="rounded-lg border border-destructive/50 p-6 text-center">
      <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      <Button className="mt-4" onClick={unstable_retry}>
        {t("retry")}
      </Button>
    </div>
  );
}
