import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NewProjectView } from '@/components/project/new-project-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projectNew');
  return { title: t('title') };
}

export default function NewProjectPage() {
  return <NewProjectView />;
}
