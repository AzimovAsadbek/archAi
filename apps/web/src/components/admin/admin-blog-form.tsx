'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { BLOG_STATUSES, type BlogStatus } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import {
  createAdminBlog,
  updateAdminBlog,
  type AdminBlogRow,
  type BlogInput,
} from '@/lib/endpoints';
import { Markdown } from '@/lib/markdown';
import { slugify } from '@/lib/slugify';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface BlogFormState {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  authorName: string;
  category: string;
  tags: string;
  coverImageUrl: string;
  status: BlogStatus;
  metaTitle: string;
  metaDescription: string;
}

function initialState(item: AdminBlogRow | null): BlogFormState {
  return {
    title: item?.title ?? '',
    slug: item?.slug ?? '',
    excerpt: item?.excerpt ?? '',
    body: item?.body ?? '',
    authorName: item?.authorName ?? '',
    category: item?.category ?? '',
    tags: item?.tags.join(', ') ?? '',
    coverImageUrl: item?.coverImageUrl ?? '',
    status: item?.status ?? 'DRAFT',
    metaTitle: item?.metaTitle ?? '',
    metaDescription: item?.metaDescription ?? '',
  };
}

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
}

export function AdminBlogForm({ item, onDone }: { item: AdminBlogRow | null; onDone: () => void }) {
  const t = useTranslations('adminContent.blog');
  const tCommon = useTranslations('common');
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<BlogFormState>(() => initialState(item));
  // On create, keep the slug in sync with the title until the admin edits it.
  const [slugTouched, setSlugTouched] = useState(item !== null);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BlogFormState, string>>>({});

  const mutation = useMutation({
    mutationFn: (body: BlogInput) =>
      item ? updateAdminBlog(item.id, body) : createAdminBlog(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      onDone();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === 'SLUG_EXISTS') {
        setErrors((current) => ({ ...current, slug: t('form.slugExists') }));
      }
    },
  });

  const update = (patch: Partial<BlogFormState>) => setForm((current) => ({ ...current, ...patch }));

  const onTitleChange = (title: string) => {
    update(slugTouched ? { title } : { title, slug: slugify(title) });
  };

  const submit = () => {
    mutation.reset();
    const nextErrors: Partial<Record<keyof BlogFormState, string>> = {};
    if (form.title.trim() === '') nextErrors.title = fieldError('required');
    if (form.slug.trim() === '') nextErrors.slug = fieldError('required');
    else if (!SLUG_PATTERN.test(form.slug.trim())) nextErrors.slug = t('form.slugInvalid');
    if (form.excerpt.trim() === '') nextErrors.excerpt = fieldError('required');
    if (form.body.trim() === '') nextErrors.body = fieldError('required');
    if (form.authorName.trim() === '') nextErrors.authorName = fieldError('required');

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    mutation.mutate({
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim(),
      body: form.body,
      authorName: form.authorName.trim(),
      category: form.category.trim() === '' ? null : form.category.trim(),
      tags: parseTags(form.tags),
      coverImageUrl: form.coverImageUrl.trim() === '' ? null : form.coverImageUrl.trim(),
      status: form.status,
      metaTitle: form.metaTitle.trim() === '' ? null : form.metaTitle.trim(),
      metaDescription: form.metaDescription.trim() === '' ? null : form.metaDescription.trim(),
    });
  };

  const disabled = mutation.isPending;

  return (
    <div>
      <button
        type="button"
        onClick={onDone}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('backToList')}
      </button>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
        {item ? t('form.editTitle') : t('form.createTitle')}
      </h1>

      <form
        noValidate
        className="mt-6 flex max-w-3xl flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {mutation.isError ? (
          <Alert tone="danger" live>
            {apiErrorMessage(mutation.error)}
          </Alert>
        ) : null}

        <Field label={t('form.title')} error={errors.title} required>
          {(control) => (
            <Input
              {...control}
              value={form.title}
              disabled={disabled}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          )}
        </Field>

        <Field label={t('form.slug')} error={errors.slug} hint={t('form.slugHint')} required>
          {(control) => (
            <Input
              {...control}
              value={form.slug}
              disabled={disabled}
              placeholder="uy-loyihasini-boshlash"
              onChange={(event) => {
                setSlugTouched(true);
                update({ slug: event.target.value });
                setErrors((current) => ({ ...current, slug: undefined }));
              }}
            />
          )}
        </Field>

        <Field label={t('form.excerpt')} error={errors.excerpt} hint={t('form.excerptHint')} required>
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              value={form.excerpt}
              disabled={disabled}
              onChange={(event) => update({ excerpt: event.target.value })}
            />
          )}
        </Field>

        <Field
          label={t('form.body')}
          error={errors.body}
          hint={t('form.bodyHint')}
          required
          labelSuffix={
            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-strong hover:underline"
            >
              {showPreview ? (
                <EyeOff className="size-3.5" aria-hidden="true" />
              ) : (
                <Eye className="size-3.5" aria-hidden="true" />
              )}
              {showPreview ? t('form.hidePreview') : t('form.showPreview')}
            </button>
          }
        >
          {(control) => (
            <Textarea
              {...control}
              rows={14}
              value={form.body}
              disabled={disabled}
              className="font-mono text-[13px]"
              onChange={(event) => update({ body: event.target.value })}
            />
          )}
        </Field>

        {showPreview ? (
          <div className="rounded-md border border-line bg-surface p-5">
            <p className="mb-2 text-xs font-bold tracking-wide text-ink-faint uppercase">
              {t('form.previewTitle')}
            </p>
            {form.body.trim() === '' ? (
              <p className="text-sm text-ink-faint">{t('form.previewEmpty')}</p>
            ) : (
              <Markdown source={form.body} />
            )}
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('form.authorName')} error={errors.authorName} required>
            {(control) => (
              <Input
                {...control}
                value={form.authorName}
                disabled={disabled}
                onChange={(event) => update({ authorName: event.target.value })}
              />
            )}
          </Field>

          <Field label={t('form.status')} hint={t('form.statusHint')}>
            {(control) => (
              <Select
                {...control}
                label={t('form.status')}
                value={form.status}
                disabled={disabled}
                onChange={(next) => update({ status: next as BlogStatus })}
                options={BLOG_STATUSES.map((status) => ({
                  value: status,
                  label: status === 'PUBLISHED' ? t('status.PUBLISHED') : t('status.DRAFT'),
                }))}
              />
            )}
          </Field>

          <Field label={t('form.category')} hint={t('form.categoryHint')}>
            {(control) => (
              <Input
                {...control}
                value={form.category}
                disabled={disabled}
                onChange={(event) => update({ category: event.target.value })}
              />
            )}
          </Field>

          <Field label={t('form.tags')} hint={t('form.tagsHint')}>
            {(control) => (
              <Input
                {...control}
                value={form.tags}
                disabled={disabled}
                placeholder={t('form.tagsPlaceholder')}
                onChange={(event) => update({ tags: event.target.value })}
              />
            )}
          </Field>
        </div>

        {parseTags(form.tags).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {parseTags(form.tags).map((tag) => (
              <Badge key={tag} tone="neutral" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <Field label={t('form.coverImageUrl')} hint={t('form.coverImageUrlHint')}>
          {(control) => (
            <Input
              {...control}
              type="url"
              value={form.coverImageUrl}
              disabled={disabled}
              placeholder="https://…"
              onChange={(event) => update({ coverImageUrl: event.target.value })}
            />
          )}
        </Field>

        <fieldset className="rounded-md border border-line bg-surface p-5">
          <legend className="px-1 text-sm font-bold tracking-wide text-ink uppercase">
            {t('form.seoGroup')}
          </legend>
          <div className="mt-3 flex flex-col gap-5">
            <Field label={t('form.metaTitle')} hint={t('form.metaTitleHint')}>
              {(control) => (
                <Input
                  {...control}
                  value={form.metaTitle}
                  disabled={disabled}
                  onChange={(event) => update({ metaTitle: event.target.value })}
                />
              )}
            </Field>
            <Field label={t('form.metaDescription')} hint={t('form.metaDescriptionHint')}>
              {(control) => (
                <Textarea
                  {...control}
                  rows={2}
                  value={form.metaDescription}
                  disabled={disabled}
                  onChange={(event) => update({ metaDescription: event.target.value })}
                />
              )}
            </Field>
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          <Button variant="ghost" onClick={onDone} disabled={disabled}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="accent" loading={mutation.isPending}>
            {item ? t('form.save') : t('form.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
