import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Configurator } from '@/components/project/configurator';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('wizard');
  return { title: t('metaTitle') };
}

export default async function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Configurator projectId={id} />;
}
