'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { type SiteElementKind, type SiteLayout } from '@archai/floor-plan-engine';
import { PLAN_COLORS } from './plan-palette';
import { cn } from '@/lib/cn';

/**
 * The site plan: the property, drawn in the same language as the floor plans.
 *
 * Same sheet, same ink. The building is poché — the heaviest mark, as on any
 * floor plan — and everything outside it is drawn lighter, because on a site
 * plan the house is the subject and the garden is context. The street edge is
 * marked so the drawing has an orientation: without it a plot is just a
 * rectangle and there is no telling which side you arrive from.
 *
 * Geometry comes from `layoutSite` in the engine, the same call the 3D preview
 * and the PDF make. Nothing here decides where anything goes.
 */

/** Surface washes. Deliberately pale: this is a drawing, not a rendering. */
const SITE_FILLS: Record<SiteElementKind, string> = {
  GARAGE: PLAN_COLORS.slab,
  DRIVEWAY: 'rgb(26 26 24 / 0.09)',
  PATH: 'rgb(26 26 24 / 0.06)',
  TERRACE: 'rgb(200 90 50 / 0.10)',
  POOL: 'rgb(47 127 158 / 0.20)',
  BALCONY: 'rgb(26 26 24 / 0.05)',
};

/** Draw order — paving first, so a terrace edge sits over the lawn beneath it. */
const DRAW_ORDER: SiteElementKind[] = ['DRIVEWAY', 'PATH', 'POOL', 'TERRACE', 'BALCONY', 'GARAGE'];

export interface SitePlanCanvasProps {
  site: SiteLayout;
  className?: string;
}

export function SitePlanCanvas({ site, className }: SitePlanCanvasProps) {
  const t = useTranslations('sitePlan');
  const tFeatures = useTranslations('features');
  const uid = useId();
  const lawnId = `${uid}-lawn`;

  const { plot, house } = site;
  // Margin for the boundary line, the street mark and the dimension text.
  const margin = Math.max(2.5, Math.max(plot.width, plot.height) * 0.09);

  const label = (kind: SiteElementKind): string => {
    switch (kind) {
      case 'GARAGE':
        return tFeatures('garage.label');
      case 'TERRACE':
        return tFeatures('terrace.label');
      case 'POOL':
        return tFeatures('pool.label');
      case 'BALCONY':
        return tFeatures('balcony.label');
      case 'DRIVEWAY':
        return t('driveway');
      case 'PATH':
        return t('path');
    }
  };

  const ordered = DRAW_ORDER.flatMap((kind) => site.elements.filter((e) => e.kind === kind));

  return (
    <svg
      role="img"
      aria-label={t('canvasLabel', { width: plot.width, length: plot.height })}
      viewBox={`${-margin} ${-margin} ${plot.width + margin * 2} ${plot.height + margin * 2}`}
      className={cn('block h-full w-full', className)}
    >
      <defs>
        {/* Soft stipple for open ground — reads as planting without becoming
            a green rectangle competing with the building. */}
        <pattern id={lawnId} width="1.1" height="1.1" patternUnits="userSpaceOnUse">
          <rect width="1.1" height="1.1" fill={PLAN_COLORS.ground} />
          <circle cx="0.55" cy="0.55" r="0.06" fill="rgb(26 26 24 / 0.16)" />
        </pattern>
      </defs>

      {/* The plot */}
      <rect
        x={0}
        y={0}
        width={plot.width}
        height={plot.height}
        fill={site.hasGarden ? `url(#${lawnId})` : PLAN_COLORS.ground}
        stroke={PLAN_COLORS.boundary}
        strokeWidth={0.09}
        strokeDasharray="1.2 0.35 0.18 0.35"
        vectorEffect="non-scaling-stroke"
      />

      {ordered.map((element, index) => {
        const { rect: r, kind } = element;
        const small = Math.min(r.width, r.height) < 2.2;
        return (
          <g key={`${kind}-${index}`}>
            <rect
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={SITE_FILLS[kind]}
              stroke={kind === 'GARAGE' ? PLAN_COLORS.wall : PLAN_COLORS.annotation}
              strokeWidth={kind === 'GARAGE' ? 0.18 : 0.05}
              strokeDasharray={kind === 'BALCONY' ? '0.4 0.3' : undefined}
            />
            {/* A label only where it fits; a name spilling over its own rectangle
                is worse than no name, and the legend carries the rest. */}
            {!small ? (
              <text
                x={r.x + r.width / 2}
                y={r.y + r.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={PLAN_COLORS.annotation}
                style={{ fontSize: 0.72, fontWeight: 600 }}
              >
                {label(kind)}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* The building, poché — the heaviest mark on the sheet. */}
      <rect
        x={house.x}
        y={house.y}
        width={house.width}
        height={house.height}
        fill={PLAN_COLORS.wall}
      />
      <text
        x={house.x + house.width / 2}
        y={house.y + house.height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={PLAN_COLORS.slab}
        style={{ fontSize: 0.95, fontWeight: 700 }}
      >
        {t('house')}
      </text>

      {/* Street edge, so the plot has a front. */}
      <line
        x1={-margin * 0.45}
        y1={-margin * 0.45}
        x2={plot.width + margin * 0.45}
        y2={-margin * 0.45}
        stroke={PLAN_COLORS.annotation}
        strokeWidth={0.14}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={plot.width / 2}
        y={-margin * 0.62}
        textAnchor="middle"
        fill={PLAN_COLORS.annotation}
        style={{ fontSize: 0.8, fontWeight: 700, letterSpacing: 0.12 }}
      >
        {t('street')}
      </text>

      {/* Overall dimensions. */}
      <text
        x={plot.width / 2}
        y={plot.height + margin * 0.62}
        textAnchor="middle"
        fill={PLAN_COLORS.annotation}
        style={{ fontSize: 0.78 }}
      >
        {t('dimension', { value: plot.width })}
      </text>
      <text
        x={-margin * 0.5}
        y={plot.height / 2}
        textAnchor="middle"
        fill={PLAN_COLORS.annotation}
        style={{ fontSize: 0.78 }}
        transform={`rotate(-90 ${-margin * 0.5} ${plot.height / 2})`}
      >
        {t('dimension', { value: plot.height })}
      </text>
    </svg>
  );
}
