/**
 * Camera preset names (§31), in a module with no three.js imports so the panel
 * toolbar can reference them without pulling the 3D bundle into the main chunk —
 * `house-scene` (behind `next/dynamic`) owns the actual view directions.
 */
export const CAMERA_PRESETS = ['orbit', 'top', 'front', 'side', 'isometric'] as const;
export type CameraPreset = (typeof CAMERA_PRESETS)[number];
