import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminPricingView } from '@/components/admin/admin-pricing-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('adminContent.pricing');
  return { title: t('title') };
}

export default function AdminPricingPage() {
  return <AdminPricingView />;
}
