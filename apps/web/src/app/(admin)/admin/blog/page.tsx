import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminBlogView } from '@/components/admin/admin-blog-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('adminContent.blog');
  return { title: t('title') };
}

export default function AdminBlogPage() {
  return <AdminBlogView />;
}
