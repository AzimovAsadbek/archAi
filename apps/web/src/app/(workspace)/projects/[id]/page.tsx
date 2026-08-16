import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProjectWorkspace } from '@/components/project/project-workspace';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workspace');
  return { title: t('metaTitle') };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectWorkspace projectId={id} />;
}
