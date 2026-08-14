import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
import { safeNextPath } from '@/lib/safe-next-path';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login');
  return { title: t('title') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <LoginForm next={safeNextPath(params.next)} />;
}
