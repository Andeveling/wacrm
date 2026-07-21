'use client';

import { useTranslations } from 'next-intl';
import { PasswordForm } from './password-form';
import { SessionsCard } from './sessions-card';
import { SettingsPanelHead } from './settings-panel-head';

/**
 * "Login & security" section — groups the former Profile-tab password
 * and active-sessions cards into their own dedicated home.
 */
export function SecurityPanel() {
  const t = useTranslations('Settings.security');
  return (
    <section className="fade-in-50 max-w-2xl animate-in duration-200">
      <SettingsPanelHead title={t('title')} description={t('description')} />
      <div className="space-y-4">
        <PasswordForm />
        <SessionsCard />
      </div>
    </section>
  );
}
