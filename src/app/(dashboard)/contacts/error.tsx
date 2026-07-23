'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent } from '@/components/ui/card';

export default function ContactsError({ unstable_retry }: { unstable_retry: () => void }) {
  const t = useTranslations('Contacts.page');

  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-sm">{t('loadError')}</p>
      </CardContent>
      <CardAction>
        <Button className="mt-4" onClick={unstable_retry}>
          {t('retry')}
        </Button>
      </CardAction>
    </Card>
  );
}
