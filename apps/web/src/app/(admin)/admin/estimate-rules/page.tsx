import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminEstimateRulesView } from '@/components/admin/admin-estimate-rules-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.rules');
  return { title: t('title') };
}

export default function AdminEstimateRulesPage() {
  return <AdminEstimateRulesView />;
}
