import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminProjectsView } from '@/components/admin/admin-projects-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.projects');
  return { title: t('title') };
}

export default function AdminProjectsPage() {
  return <AdminProjectsView />;
}
