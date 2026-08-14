import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/components/auth/register-form';
import { safeNextPath } from '@/lib/safe-next-path';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.register');
  return { title: t('title') };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <RegisterForm next={safeNextPath(params.next)} />;
}
