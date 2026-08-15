import { type ProjectContext } from '../types';

/**
 * Neutralises literal `<tag>` / `</tag>` inside untrusted text so it cannot close
 * its own fence and smuggle instructions past it. The words survive; only the
 * angle brackets are escaped.
 */
export function fenceSafe(text: string, tag: string): string {
  const pattern = new RegExp(`<(/?)\\s*${tag}\\s*>`, 'gi');
  return text.replace(pattern, (_match, slash: string) => `&lt;${slash}${tag}&gt;`);
}

/**
 * Compact, readable grounding block for the assistant operations. This is the
 * user's own persisted configuration — trusted data shown directly; only the
 * user's free text (focus / question) is fenced as untrusted by the callers.
 * Null blocks are rendered as "not specified" so the model never guesses.
 */
export function renderProjectContext(project: ProjectContext): string {
  const lines: string[] = [`Name: ${project.name ?? '(unnamed)'}`];

  if (project.land) {
    const dims =
      project.land.widthM != null && project.land.lengthM != null
        ? `, ${project.land.widthM}×${project.land.lengthM} m`
        : '';
    lines.push(`Land: ${project.land.areaM2} m²${dims}`);
  } else {
    lines.push('Land: not specified');
  }

  if (project.house) {
    const style = project.house.style ? `, style ${project.house.style}` : '';
    lines.push(
      `House: ${project.house.widthM}×${project.house.lengthM} m, ${project.house.floorCount} floor(s)${style}`,
    );
  } else {
    lines.push('House: not specified');
  }

  if (project.rooms.length === 0) {
    lines.push('Rooms: none yet');
  } else {
    const byFloor = new Map<number, string[]>();
    for (const room of project.rooms) {
      const size =
        room.widthM != null && room.lengthM != null ? ` (${room.widthM}×${room.lengthM} m)` : '';
      const label = room.label ? ` "${room.label}"` : '';
      const list = byFloor.get(room.floor) ?? [];
      list.push(`${room.type}${label}${size}`);
      byFloor.set(room.floor, list);
    }
    lines.push(`Rooms (${project.rooms.length}):`);
    for (const floor of [...byFloor.keys()].sort((a, b) => a - b)) {
      lines.push(`  Floor ${floor + 1}: ${(byFloor.get(floor) ?? []).join(', ')}`);
    }
  }

  const enabled = Object.entries(project.features)
    .filter(([, on]) => on)
    .map(([name]) => name);
  lines.push(`Features: ${enabled.length > 0 ? enabled.join(', ') : 'none'}`);

  return lines.join('\n');
}
