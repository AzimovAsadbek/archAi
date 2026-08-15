'use client';

import { useId, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  type FloorGeometry,
  type HouseSpec,
  type PlacedRoom,
  type Wall,
} from '@archai/floor-plan-engine';
import { cn } from '@/lib/cn';
import { PLAN_COLORS, ROOM_TINTS } from './plan-palette';
import { Dimension, DoorSymbol, StairsSymbol, WindowSymbol, isHorizontalWall } from './plan-symbols';
import { type PanZoom } from './use-pan-zoom';

/** Screen sizes the annotation layer keeps at every zoom level. */
const NAME_PX = 12;
const AREA_PX = 10.5;
const DIMENSION_PX = 11;
const ARROW_PX = 5;
/** Rough advance width per character of semibold Manrope, in ems. */
const CHAR_RATIO = 0.62;
/** Breathing room kept between a label and the walls, in pixels. */
const LABEL_PADDING_PX = 12;
/** Assumed frame width for the very first paint, before the observer reports. */
const FALLBACK_FRAME_PX = 760;

export interface FloorPlanCanvasProps {
  house: HouseSpec;
  floor: FloorGeometry;
  panZoom: PanZoom;
  /** Blank border around the footprint, in metres — the annotations live here. */
  marginM: number;
  /** Key of the highlighted room; its own dimension lines are drawn (§20/§23). */
  selectedRoomKey?: string | null;
  /** Click/keyboard selection callback; `null` clears (background click, Esc). */
  onSelectRoom?: (key: string | null) => void;
  className?: string;
}

function roomName(room: PlacedRoom, typeName: string): string {
  return room.label?.trim() ? room.label.trim() : typeName;
}

export function FloorPlanCanvas({
  house,
  floor,
  panZoom,
  marginM,
  selectedRoomKey = null,
  onSelectRoom,
  className,
}: FloorPlanCanvasProps) {
  const t = useTranslations('floorPlan');
  const tRoomTypes = useTranslations('roomTypes');
  const hatchId = `${useId()}-hatch`;
  const { view, pxPerM, panning, svgRef, onPointerDown, onPointerMove, onPointerEnd } = panZoom;

  // Where the pointer went down, in client px — a click that travelled further
  // than a few pixels was a pan, not a selection.
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);
  const CLICK_SLOP_PX = 5;

  const wasClick = (event: React.MouseEvent): boolean => {
    const origin = pointerOrigin.current;
    if (!origin) return true;
    return (
      Math.abs(event.clientX - origin.x) <= CLICK_SLOP_PX &&
      Math.abs(event.clientY - origin.y) <= CLICK_SLOP_PX
    );
  };

  const wallsById = useMemo(() => {
    const map = new Map<string, Wall>();
    for (const wall of floor.walls) map.set(wall.id, wall);
    return map;
  }, [floor.walls]);

  const roomsByKey = useMemo(() => {
    const map = new Map<string, PlacedRoom>();
    for (const room of floor.rooms) map.set(room.key, room);
    return map;
  }, [floor.rooms]);

  // Metres per screen pixel: the annotation layer multiplies px sizes by this so
  // labels, arrows and hairlines stay legible however far the plan is zoomed.
  const scale = pxPerM > 0 ? pxPerM : FALLBACK_FRAME_PX / view.width;
  const mPerPx = 1 / scale;

  const dimensionOffset = Math.max(marginM * 0.5, DIMENSION_PX * 2.2 * mPerPx);

  return (
    <svg
      ref={svgRef}
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t('canvasLabel', {
        floor: floor.index + 1,
        rooms: floor.rooms.length,
        width: house.widthM,
        length: house.lengthM,
      })}
      className={cn(
        'h-full w-full touch-none select-none',
        panning ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
      onPointerDown={(event) => {
        pointerOrigin.current = { x: event.clientX, y: event.clientY };
        onPointerDown(event);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={(event) => {
        // Background click (a real click, not the tail of a pan) clears selection.
        if (onSelectRoom && wasClick(event)) onSelectRoom(null);
      }}
    >
      <defs>
        <pattern id={hatchId} width={0.42} height={0.42} patternUnits="userSpaceOnUse">
          <path
            d="M -0.1 0.1 L 0.1 -0.1 M 0 0.42 L 0.42 0 M 0.32 0.52 L 0.52 0.32"
            stroke={PLAN_COLORS.corridorHatch}
            strokeWidth={0.045}
            fill="none"
          />
        </pattern>
      </defs>

      {/* Footprint slab, then the usable area inside the exterior walls. */}
      <rect x={0} y={0} width={house.widthM} height={house.lengthM} fill={PLAN_COLORS.slab} />
      <rect
        x={floor.outline.x}
        y={floor.outline.y}
        width={floor.outline.width}
        height={floor.outline.height}
        fill={PLAN_COLORS.ground}
      />

      {floor.corridor ? (
        <g>
          <title>{t('legend.corridor')}</title>
          <rect
            x={floor.corridor.x}
            y={floor.corridor.y}
            width={floor.corridor.width}
            height={floor.corridor.height}
            fill={PLAN_COLORS.corridor}
          />
          <rect
            x={floor.corridor.x}
            y={floor.corridor.y}
            width={floor.corridor.width}
            height={floor.corridor.height}
            fill={`url(#${hatchId})`}
          />
        </g>
      ) : null}

      <g>
        {floor.rooms.map((room) => (
          <rect
            key={room.key}
            x={room.rect.x}
            y={room.rect.y}
            width={room.rect.width}
            height={room.rect.height}
            fill={ROOM_TINTS[room.type]}
          />
        ))}
      </g>

      {floor.stairs ? (
        <StairsSymbol
          stairs={floor.stairs}
          title={<title>{t(`stairs.${floor.stairs.direction}`)}</title>}
        />
      ) : null}

      {/* Centre lines with stroke-width = thickness render walls exactly. */}
      <g stroke={PLAN_COLORS.wall} strokeLinecap="square">
        {floor.walls.map((wall) => (
          <line
            key={wall.id}
            x1={wall.segment.x1}
            y1={wall.segment.y1}
            x2={wall.segment.x2}
            y2={wall.segment.y2}
            strokeWidth={wall.thickness}
          />
        ))}
      </g>

      <g>
        {floor.doors.map((door) => {
          const wall = wallsById.get(door.wallId);
          if (!wall) return null;
          // The leaf swings into the door's primary room; without one (an
          // exterior entry) it swings inward, away from the footprint edge.
          const room = roomsByKey.get(door.roomKeys[0]);
          const horizontal = isHorizontalWall(wall);
          const roomCenter = room
            ? horizontal
              ? room.rect.y + room.rect.height / 2
              : room.rect.x + room.rect.width / 2
            : null;
          const doorAt = horizontal ? door.center.y : door.center.x;
          const swing: 1 | -1 =
            roomCenter !== null
              ? roomCenter >= doorAt
                ? 1
                : -1
              : doorAt < (horizontal ? house.lengthM : house.widthM) / 2
                ? 1
                : -1;
          return <DoorSymbol key={door.id} door={door} wall={wall} swing={swing} />;
        })}
      </g>

      <g>
        {floor.windows.map((opening) => {
          const wall = wallsById.get(opening.wallId);
          if (!wall) return null;
          return <WindowSymbol key={opening.id} window={opening} wall={wall} />;
        })}
      </g>

      {(() => {
        // Selection ring + the selected room's own dimensions (§20/§23), drawn
        // inside the room so they never collide with neighbouring rooms.
        const selected = floor.rooms.find((room) => room.key === selectedRoomKey);
        if (!selected) return null;
        const { rect } = selected;
        const inset = Math.min(0.45, Math.min(rect.width, rect.height) * 0.18);
        // Room dimensions appear once both sides can host the ~11 px labels
        // legibly; below that only the ring shows (progressive disclosure, §66).
        const showDims = rect.width * scale >= 64 && rect.height * scale >= 64;
        return (
          <g pointerEvents="none">
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="none"
              stroke={PLAN_COLORS.selection}
              strokeWidth={2.5}
              style={{ vectorEffect: 'non-scaling-stroke' }}
            />
            {showDims ? (
              <>
                <Dimension
                  orientation="horizontal"
                  from={rect.x}
                  to={rect.x + rect.width}
                  edge={rect.y + rect.height}
                  offset={-inset}
                  label={t('dimensionValue', { value: rect.width })}
                  arrow={ARROW_PX * mPerPx}
                  font={DIMENSION_PX * mPerPx}
                  color={PLAN_COLORS.selection}
                />
                <Dimension
                  orientation="vertical"
                  from={rect.y}
                  to={rect.y + rect.height}
                  edge={rect.x}
                  offset={inset}
                  label={t('dimensionValue', { value: rect.height })}
                  arrow={ARROW_PX * mPerPx}
                  font={DIMENSION_PX * mPerPx}
                  color={PLAN_COLORS.selection}
                />
              </>
            ) : null}
          </g>
        );
      })()}

      <g>
        {floor.rooms.map((room) => {
          const typeName = tRoomTypes(room.type);
          const name = roomName(room, typeName);
          const area = t('areaValue', { area: room.areaM2 });
          const widthPx = room.rect.width * scale;
          const heightPx = room.rect.height * scale;

          const showName =
            heightPx >= 26 && widthPx >= name.length * NAME_PX * CHAR_RATIO + LABEL_PADDING_PX;
          const showArea =
            heightPx >= (showName ? 42 : 22) &&
            widthPx >= area.length * AREA_PX * CHAR_RATIO + LABEL_PADDING_PX;

          const centerX = room.rect.x + room.rect.width / 2;
          const centerY = room.rect.y + room.rect.height / 2;
          const stacked = showName && showArea;
          const nameY = stacked ? centerY - AREA_PX * 0.62 * mPerPx : centerY;
          const areaY = stacked ? centerY + NAME_PX * 0.62 * mPerPx : centerY;

          // A single string child: React 19 renders a multi-child SVG <title>
          // empty, which also breaks hydration.
          const tooltip =
            t('roomTooltip', {
              name,
              type: typeName,
              width: room.rect.width,
              length: room.rect.height,
              area: room.areaM2,
            }) +
            (room.requestedAreaM2 !== null && room.requestedAreaM2 !== room.areaM2
              ? ` ${t('roomTooltipRequested', { requested: room.requestedAreaM2 })}`
              : '');

          const selected = room.key === selectedRoomKey;

          return (
            <g key={room.key}>
              <title>{tooltip}</title>
              {/* Transparent hit area = the room's accessible, selectable surface. */}
              <rect
                x={room.rect.x}
                y={room.rect.y}
                width={room.rect.width}
                height={room.rect.height}
                fill="transparent"
                {...(onSelectRoom
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': tooltip,
                      'aria-pressed': selected,
                      style: { cursor: 'pointer', outline: 'none' },
                      onClick: (event: React.MouseEvent) => {
                        if (!wasClick(event)) return;
                        event.stopPropagation();
                        onSelectRoom(selected ? null : room.key);
                      },
                      onKeyDown: (event: React.KeyboardEvent) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectRoom(selected ? null : room.key);
                        } else if (event.key === 'Escape' && selected) {
                          onSelectRoom(null);
                        }
                      },
                    }
                  : {})}
              />
              {showName ? (
                <text
                  x={centerX}
                  y={nameY}
                  fill={PLAN_COLORS.label}
                  fontSize={NAME_PX * mPerPx}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {name}
                </text>
              ) : null}
              {showArea ? (
                <text
                  className="numeric"
                  x={centerX}
                  y={areaY}
                  fill={PLAN_COLORS.annotation}
                  fontSize={AREA_PX * mPerPx}
                  fontWeight={600}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {area}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>

      <Dimension
        orientation="horizontal"
        from={0}
        to={house.widthM}
        edge={house.lengthM}
        offset={dimensionOffset}
        label={t('dimensionValue', { value: house.widthM })}
        arrow={ARROW_PX * mPerPx}
        font={DIMENSION_PX * mPerPx}
      />
      <Dimension
        orientation="vertical"
        from={0}
        to={house.lengthM}
        edge={0}
        offset={-dimensionOffset}
        label={t('dimensionValue', { value: house.lengthM })}
        arrow={ARROW_PX * mPerPx}
        font={DIMENSION_PX * mPerPx}
      />
    </svg>
  );
}
