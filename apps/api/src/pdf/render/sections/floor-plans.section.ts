import {
  type Door,
  type FloorGeometry,
  type FloorPlanWindow,
  type HouseSpec,
  type PlacedRoom,
  type Stair,
  type Wall,
} from '@archai/floor-plan-engine';
import { COLORS, CONTENT_WIDTH, FONTS, PAGE, ROOM_TINTS, TYPE } from '../theme';
import { formatNumber, sanitize } from '../format';
import { type Doc, ensureSpace, gap, sectionTitle } from '../layout';
import { fill, type PdfStrings } from '../../pdf-strings';
import { type PdfReport } from '../report';

/** Height of one floor block: heading + drawing + note. Two fit on a page. */
const HEADING_HEIGHT = 20;
const DRAWING_HEIGHT = 282;
const NOTE_HEIGHT = 16;
const BLOCK_HEIGHT = HEADING_HEIGHT + DRAWING_HEIGHT + NOTE_HEIGHT;

/** Blank border inside the drawing box where the dimension lines live. */
const PADDING = 30;
/** Distance from the footprint edge to the dimension line. */
const DIMENSION_OFFSET = 15;
const ARROW = 4;

/** Metres to points, plus the offset that centres the footprint in its box. */
interface Transform {
  scale: number;
  originX: number;
  originY: number;
}

function toX(t: Transform, metres: number): number {
  return t.originX + metres * t.scale;
}

function toY(t: Transform, metres: number): number {
  return t.originY + metres * t.scale;
}

function toLength(t: Transform, metres: number): number {
  return metres * t.scale;
}

/** Wall segments are axis-aligned centre lines, so orientation is a comparison. */
function isHorizontal(wall: Wall): boolean {
  return Math.abs(wall.segment.y2 - wall.segment.y1) < 1e-6;
}

function line(doc: Doc, x1: number, y1: number, x2: number, y2: number): void {
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
}

/** Triangle pointing along the unit vector (dx, dy), in points. */
function arrowHead(doc: Doc, x: number, y: number, dx: number, dy: number, size: number): void {
  const wingX = -dy * size * 0.45;
  const wingY = dx * size * 0.45;
  const baseX = x - dx * size;
  const baseY = y - dy * size;
  doc
    .moveTo(x, y)
    .lineTo(baseX + wingX, baseY + wingY)
    .lineTo(baseX - wingX, baseY - wingY)
    .closePath()
    .fill();
}

/** Erases the wall band across an opening so it reads as a real gap. */
function openingGap(doc: Doc, t: Transform, wall: Wall, from: Point, to: Point): void {
  doc
    .lineCap('butt')
    .lineWidth(toLength(t, wall.thickness + 0.02))
    .strokeColor(COLORS.planSlab);
  line(doc, toX(t, from.x), toY(t, from.y), toX(t, to.x), toY(t, to.y));
}

interface Point {
  x: number;
  y: number;
}

function drawWalls(doc: Doc, t: Transform, floor: FloorGeometry): void {
  doc.lineCap('square').strokeColor(COLORS.ink);
  for (const wall of floor.walls) {
    doc.lineWidth(Math.max(toLength(t, wall.thickness), 0.4));
    line(
      doc,
      toX(t, wall.segment.x1),
      toY(t, wall.segment.y1),
      toX(t, wall.segment.x2),
      toY(t, wall.segment.y2),
    );
  }
}

/**
 * Opening gap, quarter-circle swing arc and hinge leaf — the same construction
 * the 2D tab draws, so a printed plan matches the screen.
 */
function drawDoor(
  doc: Doc,
  t: Transform,
  door: Door,
  wall: Wall,
  room: PlacedRoom | undefined,
  house: HouseSpec,
): void {
  const horizontal = isHorizontal(wall);
  const half = door.width / 2;
  const { x, y } = door.center;

  const hinge = horizontal ? { x: x - half, y } : { x, y: y - half };
  const jamb = horizontal ? { x: x + half, y } : { x, y: y + half };
  const roomCenter = room
    ? horizontal
      ? room.rect.y + room.rect.height / 2
      : room.rect.x + room.rect.width / 2
    : null;
  const doorAt = horizontal ? y : x;
  const swing =
    roomCenter !== null
      ? roomCenter >= doorAt
        ? 1
        : -1
      : doorAt < (horizontal ? house.lengthM : house.widthM) / 2
        ? 1
        : -1;
  const tip = horizontal
    ? { x: hinge.x, y: hinge.y + swing * door.width }
    : { x: hinge.x + swing * door.width, y: hinge.y };

  openingGap(doc, t, wall, hinge, jamb);

  const fromAngle = Math.atan2(jamb.y - hinge.y, jamb.x - hinge.x);
  const toAngle = Math.atan2(tip.y - hinge.y, tip.x - hinge.x);
  let delta = toAngle - fromAngle;
  while (delta <= -Math.PI) {
    delta += Math.PI * 2;
  }
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  const sweep = delta > 0 ? 1 : 0;
  const radius = toLength(t, door.width);

  doc
    .lineCap('butt')
    .lineWidth(0.5)
    .strokeColor(COLORS.inkFaint)
    .path(
      `M ${toX(t, jamb.x)} ${toY(t, jamb.y)} A ${radius} ${radius} 0 0 ${sweep} ` +
        `${toX(t, tip.x)} ${toY(t, tip.y)}`,
    )
    .stroke();

  doc.lineWidth(0.9).strokeColor(COLORS.inkSoft);
  line(doc, toX(t, hinge.x), toY(t, hinge.y), toX(t, tip.x), toY(t, tip.y));
}

/** Opening gap, the two wall-face lines and the end ticks across the wall. */
function drawWindow(doc: Doc, t: Transform, opening: FloorPlanWindow, wall: Wall): void {
  const horizontal = isHorizontal(wall);
  const half = opening.length / 2;
  const face = wall.thickness / 2;
  const { x, y } = opening.center;

  const start = horizontal ? { x: x - half, y } : { x, y: y - half };
  const end = horizontal ? { x: x + half, y } : { x, y: y + half };
  const offset = horizontal ? { x: 0, y: face } : { x: face, y: 0 };

  openingGap(doc, t, wall, start, end);

  doc.lineCap('butt').lineWidth(0.5).strokeColor(COLORS.inkSoft);
  for (const side of [1, -1]) {
    line(
      doc,
      toX(t, start.x + offset.x * side),
      toY(t, start.y + offset.y * side),
      toX(t, end.x + offset.x * side),
      toY(t, end.y + offset.y * side),
    );
  }
  for (const point of [start, end]) {
    line(
      doc,
      toX(t, point.x - offset.x),
      toY(t, point.y - offset.y),
      toX(t, point.x + offset.x),
      toY(t, point.y + offset.y),
    );
  }
}

/** Stair core: treads across the run plus a direction arrow along it. */
function drawStairs(doc: Doc, t: Transform, stairs: Stair): void {
  const { rect, direction } = stairs;
  doc
    .rect(toX(t, rect.x), toY(t, rect.y), toLength(t, rect.width), toLength(t, rect.height))
    .fillColor(COLORS.planStair)
    .fill();

  const alongX = rect.width >= rect.height;
  const runLength = alongX ? rect.width : rect.height;
  const treads = Math.max(3, Math.min(12, Math.round(runLength / 0.32)));
  const step = runLength / treads;

  doc.lineCap('butt').lineWidth(0.4).strokeColor(COLORS.inkSoft);
  for (let index = 1; index < treads; index++) {
    const at = index * step;
    if (alongX) {
      line(
        doc,
        toX(t, rect.x + at),
        toY(t, rect.y),
        toX(t, rect.x + at),
        toY(t, rect.y + rect.height),
      );
    } else {
      line(
        doc,
        toX(t, rect.x),
        toY(t, rect.y + at),
        toX(t, rect.x + rect.width),
        toY(t, rect.y + at),
      );
    }
  }

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const inset = Math.min(runLength * 0.14, 0.35);
  const start = alongX ? { x: rect.x + inset, y: centerY } : { x: centerX, y: rect.y + inset };
  const end = alongX
    ? { x: rect.x + rect.width - inset, y: centerY }
    : { x: centerX, y: rect.y + rect.height - inset };

  doc.lineWidth(0.9).strokeColor(COLORS.ink);
  line(doc, toX(t, start.x), toY(t, start.y), toX(t, end.x), toY(t, end.y));

  doc.fillColor(COLORS.ink);
  const forward = alongX ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
  if (direction === 'up' || direction === 'both') {
    arrowHead(doc, toX(t, end.x), toY(t, end.y), forward.dx, forward.dy, ARROW);
  }
  if (direction === 'down' || direction === 'both') {
    arrowHead(doc, toX(t, start.x), toY(t, start.y), -forward.dx, -forward.dy, ARROW);
  }
}

/** Room name and area, printed only where the room is big enough to hold them. */
function drawRoomLabels(doc: Doc, t: Transform, floor: FloorGeometry, strings: PdfStrings): void {
  for (const room of floor.rooms) {
    const name = sanitize(room.label?.trim() ?? '') || strings.roomTypes[room.type];
    const area = `${formatNumber(room.areaM2, 1)} ${strings.unitM2}`;
    const widthPt = toLength(t, room.rect.width);
    const heightPt = toLength(t, room.rect.height);
    const centerX = toX(t, room.rect.x + room.rect.width / 2);
    const centerY = toY(t, room.rect.y + room.rect.height / 2);

    const nameWidth = doc.font(FONTS.bold).fontSize(TYPE.planLabel).widthOfString(name);
    const areaWidth = doc.font(FONTS.regular).fontSize(TYPE.planArea).widthOfString(area);
    const showName = heightPt >= 14 && widthPt >= nameWidth + 6;
    const showArea = heightPt >= (showName ? 26 : 12) && widthPt >= areaWidth + 6;
    if (!showName && !showArea) {
      continue;
    }

    const stacked = showName && showArea;
    if (showName) {
      doc
        .font(FONTS.bold)
        .fontSize(TYPE.planLabel)
        .fillColor(COLORS.ink)
        .text(
          name,
          centerX - widthPt / 2,
          centerY - (stacked ? TYPE.planLabel : TYPE.planLabel / 2) - 1,
          {
            width: widthPt,
            align: 'center',
            lineBreak: false,
          },
        );
    }
    if (showArea) {
      doc
        .font(FONTS.regular)
        .fontSize(TYPE.planArea)
        .fillColor(COLORS.inkFaint)
        .text(area, centerX - widthPt / 2, centerY + (stacked ? 1 : -TYPE.planArea / 2), {
          width: widthPt,
          align: 'center',
          lineBreak: false,
        });
    }
  }
}

/** Architectural dimension: extension lines, arrowed line and a centred label. */
function drawDimensions(doc: Doc, t: Transform, house: HouseSpec, strings: PdfStrings): void {
  const x0 = toX(t, 0);
  const y0 = toY(t, 0);
  const x1 = toX(t, house.widthM);
  const y1 = toY(t, house.lengthM);

  doc.lineCap('butt').lineWidth(0.4).strokeColor(COLORS.inkFaint).fillColor(COLORS.inkFaint);

  // Width, under the footprint.
  const widthLine = y1 + DIMENSION_OFFSET;
  doc.dash(2, { space: 2 });
  line(doc, x0, y1, x0, widthLine + 3);
  line(doc, x1, y1, x1, widthLine + 3);
  doc.undash();
  line(doc, x0, widthLine, x1, widthLine);
  arrowHead(doc, x1, widthLine, 1, 0, ARROW);
  arrowHead(doc, x0, widthLine, -1, 0, ARROW);
  const widthLabel = `${formatNumber(house.widthM, 2)} ${strings.unitM}`;
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.planDimension)
    .text(widthLabel, x0, widthLine + 3, { width: x1 - x0, align: 'center', lineBreak: false });

  // Length, left of the footprint, rotated a quarter turn.
  const lengthLine = x0 - DIMENSION_OFFSET;
  doc.dash(2, { space: 2 });
  line(doc, x0, y0, lengthLine - 3, y0);
  line(doc, x0, y1, lengthLine - 3, y1);
  doc.undash();
  line(doc, lengthLine, y0, lengthLine, y1);
  arrowHead(doc, lengthLine, y1, 0, 1, ARROW);
  arrowHead(doc, lengthLine, y0, 0, -1, ARROW);

  // Rotated a quarter turn about its own centre: `rotate` keeps the origin
  // point fixed, so a box centred there stays centred after the turn.
  const lengthLabel = `${formatNumber(house.lengthM, 2)} ${strings.unitM}`;
  const centerX = lengthLine - 5;
  const centerY = (y0 + y1) / 2;
  const boxWidth = Math.max(y1 - y0, 40);
  doc.save();
  doc.rotate(-90, { origin: [centerX, centerY] });
  doc.text(lengthLabel, centerX - boxWidth / 2, centerY - doc.currentLineHeight() / 2, {
    width: boxWidth,
    align: 'center',
    lineBreak: false,
  });
  doc.restore();
}

/** One floor: slab, rooms, walls, openings, labels and overall dimensions. */
function drawFloor(
  doc: Doc,
  house: HouseSpec,
  floor: FloorGeometry,
  box: { x: number; y: number; width: number; height: number },
  strings: PdfStrings,
): void {
  const usableW = box.width - PADDING * 2;
  const usableH = box.height - PADDING * 2;
  const scale = Math.min(usableW / house.widthM, usableH / house.lengthM);
  const t: Transform = {
    scale,
    originX: box.x + (box.width - house.widthM * scale) / 2,
    originY: box.y + (box.height - house.lengthM * scale) / 2,
  };

  doc.save();

  // Footprint slab, then the usable area inside the exterior walls.
  doc
    .rect(toX(t, 0), toY(t, 0), toLength(t, house.widthM), toLength(t, house.lengthM))
    .fillColor(COLORS.planSlab)
    .fill();
  doc
    .rect(
      toX(t, floor.outline.x),
      toY(t, floor.outline.y),
      toLength(t, floor.outline.width),
      toLength(t, floor.outline.height),
    )
    .fillColor(COLORS.planGround)
    .fill();

  if (floor.corridor !== null) {
    doc
      .rect(
        toX(t, floor.corridor.x),
        toY(t, floor.corridor.y),
        toLength(t, floor.corridor.width),
        toLength(t, floor.corridor.height),
      )
      .fillColor(COLORS.planCorridor)
      .fill();
  }

  for (const room of floor.rooms) {
    doc
      .rect(
        toX(t, room.rect.x),
        toY(t, room.rect.y),
        toLength(t, room.rect.width),
        toLength(t, room.rect.height),
      )
      .fillColor(ROOM_TINTS[room.type])
      .fill();
  }

  if (floor.stairs !== null) {
    drawStairs(doc, t, floor.stairs);
  }

  drawWalls(doc, t, floor);

  const wallsById = new Map(floor.walls.map((wall) => [wall.id, wall]));
  const roomsByKey = new Map(floor.rooms.map((room) => [room.key, room]));
  for (const door of floor.doors) {
    const wall = wallsById.get(door.wallId);
    if (wall !== undefined) {
      drawDoor(doc, t, door, wall, roomsByKey.get(door.roomKeys[0]), house);
    }
  }
  for (const opening of floor.windows) {
    const wall = wallsById.get(opening.wallId);
    if (wall !== undefined) {
      drawWindow(doc, t, opening, wall);
    }
  }

  drawRoomLabels(doc, t, floor, strings);
  drawDimensions(doc, t, house, strings);

  doc.restore();
}

/** Draws one legend symbol inside a 22×10 pt slot at (x, y). */
function legendSymbol(doc: Doc, kind: LegendKind, x: number, y: number): void {
  const midY = y + 5;
  doc.lineCap('butt');
  if (kind === 'door') {
    doc.lineWidth(0.5).strokeColor(COLORS.inkFaint);
    doc.path(`M ${x + 16} ${midY + 4} A 12 12 0 0 0 ${x + 4} ${midY - 6}`).stroke();
    doc.lineWidth(0.9).strokeColor(COLORS.inkSoft);
    line(doc, x + 4, midY + 4, x + 4, midY - 6);
    return;
  }
  if (kind === 'window') {
    doc.lineWidth(0.5).strokeColor(COLORS.inkSoft);
    line(doc, x + 2, midY - 2, x + 18, midY - 2);
    line(doc, x + 2, midY + 2, x + 18, midY + 2);
    line(doc, x + 2, midY - 2, x + 2, midY + 2);
    line(doc, x + 18, midY - 2, x + 18, midY + 2);
    return;
  }
  if (kind === 'stairs') {
    doc
      .rect(x + 2, midY - 4, 16, 8)
      .fillColor(COLORS.planStair)
      .fill();
    doc.lineWidth(0.4).strokeColor(COLORS.inkSoft);
    for (let index = 1; index < 4; index++) {
      line(doc, x + 2 + index * 4, midY - 4, x + 2 + index * 4, midY + 4);
    }
    return;
  }
  doc
    .rect(x + 2, midY - 4, 16, 8)
    .fillColor(COLORS.planCorridor)
    .fill();
}

type LegendKind = 'door' | 'window' | 'stairs' | 'corridor';

/** Symbol key for the drawings, so a printed plan reads without the app. */
function drawLegend(doc: Doc, strings: PdfStrings): void {
  const items: { kind: LegendKind; label: string }[] = [
    { kind: 'door', label: strings.planLegendDoor },
    { kind: 'window', label: strings.planLegendWindow },
    { kind: 'stairs', label: strings.planLegendStairs },
    { kind: 'corridor', label: strings.planLegendCorridor },
  ];
  const y = doc.y;
  let x = PAGE.margin;

  doc.font(FONTS.bold).fontSize(TYPE.tiny).fillColor(COLORS.inkFaint);
  const titleWidth = doc.widthOfString(sanitize(strings.planLegendTitle)) + 8;
  doc.text(sanitize(strings.planLegendTitle), x, y + 1, { lineBreak: false });
  x += titleWidth;

  doc.font(FONTS.regular);
  for (const item of items) {
    legendSymbol(doc, item.kind, x, y - 3);
    const label = sanitize(item.label);
    doc.fillColor(COLORS.inkSoft).text(label, x + 24, y + 1, { lineBreak: false });
    x += 24 + doc.widthOfString(label) + 16;
  }
  doc.y = y + 16;
}

/**
 * One drawing per floor, from the persisted geometry — the same data the 2D tab
 * renders. Nothing is invented here: a floor with no rooms still prints its
 * outline, and a plan the engine could not produce is simply absent.
 */
export function renderFloorPlans(doc: Doc, report: PdfReport, strings: PdfStrings): void {
  const plan = report.plan;
  if (plan === null || plan.floors.length === 0) {
    return;
  }

  doc.addPage();
  sectionTitle(doc, strings.plansTitle);
  drawLegend(doc, strings);
  gap(doc, 4);

  for (const floor of plan.floors) {
    ensureSpace(doc, BLOCK_HEIGHT);

    const headingY = doc.y;
    doc
      .font(FONTS.bold)
      .fontSize(TYPE.subsection)
      .fillColor(COLORS.ink)
      .text(
        sanitize(fill(strings.planFloorHeading, { floor: floor.index + 1 })),
        PAGE.margin,
        headingY,
        {
          width: CONTENT_WIDTH,
          lineBreak: false,
        },
      );

    const box = {
      x: PAGE.margin,
      y: headingY + HEADING_HEIGHT,
      width: CONTENT_WIDTH,
      height: DRAWING_HEIGHT,
    };
    drawFloor(doc, plan.house, floor, box, strings);

    doc
      .font(FONTS.regular)
      .fontSize(TYPE.tiny)
      .fillColor(COLORS.inkFaint)
      .text(sanitize(strings.planScaleNote), PAGE.margin, box.y + box.height + 2, {
        width: CONTENT_WIDTH,
        align: 'center',
        lineBreak: false,
      });

    doc.y = box.y + box.height + NOTE_HEIGHT;
    gap(doc, 10);
  }
}
