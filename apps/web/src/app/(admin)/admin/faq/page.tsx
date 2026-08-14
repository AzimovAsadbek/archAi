import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminFaqView } from '@/components/admin/admin-faq-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('adminContent.faq');
  return { title: t('title') };
}

export default function AdminFaqPage() {
  return <AdminFaqView />;
}
