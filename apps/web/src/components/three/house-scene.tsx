'use client';

import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  type PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three';
import { type HouseStyle } from '@archai/shared';
import { cn } from '@/lib/cn';
import { type CameraPreset } from './camera-presets';
import {
  materialsForStyle,
  SCENE_COLORS,
  SCENE_LIGHTS,
  SCENE_SURFACES,
  type StyleMaterials,
} from './scene-palette';
import type { SceneBounds, SceneBox, SceneModel, SceneRoof } from './scene-builder';

/**
 * R3F layer for the 3D preview. It owns no geometry decisions — `scene-builder`
 * produces every box and triangle, this file only uploads them.
 *
 * Performance shape: one instanced draw per material, `frameloop="demand"` so
 * nothing renders while the user is idle, DPR clamped to 2, and no shadow maps
 * in v1. Everything three.js touches lives in this module (and its imports) so
 * `next/dynamic` can keep it out of the main bundle.
 */

/**
 * View directions per camera preset (§31): each is the direction the camera sits
 * along from the model centre, framed against the bounding sphere. The sphere
 * circumscribes the house, so fitting it exactly already guarantees nothing
 * clips at any orbit angle — the padding is only a hair of breathing room.
 * "Top" stops shy of the pole so OrbitControls never gimbal-locks.
 */
const PRESET_DIRECTIONS: Record<CameraPreset, Vector3> = {
  orbit: new Vector3(1, 0.72, 1).normalize(),
  // Slightly off-axis so the polar angle clears MIN_POLAR_ANGLE (no clamp snap).
  top: new Vector3(0.1, 1, 0.1).normalize(),
  front: new Vector3(0, 0.22, 1).normalize(),
  side: new Vector3(1, 0.22, 0).normalize(),
  // The classic 30° architectural axonometric direction.
  isometric: new Vector3(1, Math.tan(Math.PI / 6) * Math.SQRT2, 1).normalize(),
};

const FRAMING_PADDING = 1.02;
/** Never look from below the horizon, and never straight down the pole. */
const MIN_POLAR_ANGLE = 0.12;
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.04;

// ── Instanced boxes ───────────────────────────────────────────────────────

/**
 * Draws a whole material group in a single call. Every box is axis-aligned, so
 * an instance is just a translate + scale of a unit cube.
 */
function BoxCluster({ boxes, children }: { boxes: readonly SceneBox[]; children: ReactNode }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    const rotation = new Quaternion();

    for (let index = 0; index < boxes.length; index++) {
      const item = boxes[index];
      if (!item) continue;
      position.set(item.center[0], item.center[1], item.center[2]);
      scale.set(item.size[0], item.size[1], item.size[2]);
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
    }

    mesh.count = boxes.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [boxes, invalidate]);

  if (boxes.length === 0) return null;

  return (
    // `count` is a constructor argument, so a changed length needs a new object.
    <instancedMesh key={boxes.length} ref={ref} args={[undefined, undefined, boxes.length]}>
      <boxGeometry args={[1, 1, 1]} />
      {children}
    </instancedMesh>
  );
}

// ── Roof ──────────────────────────────────────────────────────────────────

function Roof({ roof, materials }: { roof: SceneRoof; materials: StyleMaterials }) {
  const geometry = useMemo(() => {
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(roof.positions), 3));
    buffer.setAttribute('normal', new BufferAttribute(new Float32Array(roof.normals), 3));
    buffer.computeBoundingSphere();
    return buffer;
  }, [roof]);

  // R3F disposes what it created; this geometry is ours, so we release it too.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={materials.roof}
        side={DoubleSide}
        roughness={materials.roofRoughness}
        metalness={0}
      />
    </mesh>
  );
}

// ── Camera ────────────────────────────────────────────────────────────────

/** The slice of OrbitControls the rig needs; R3F types `state.controls` loosely. */
interface OrbitLike {
  target: Vector3;
  update: () => void;
}

/**
 * Frames the building inside the bounding sphere the builder reports, using the
 * tighter of the horizontal and vertical field of view so a wide-but-short
 * canvas never clips the roof. Re-runs when the plan, the preset or the reset
 * token changes — not on resize, so an orbit survives a window drag.
 */
function CameraRig({
  bounds,
  preset,
  resetToken,
}: {
  bounds: SceneBounds;
  preset: CameraPreset;
  resetToken: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);

  // Kept in a ref on purpose: framing must not restart when the canvas resizes.
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const aspect = Math.max(sizeRef.current.width / Math.max(sizeRef.current.height, 1), 0.2);
    const verticalFov = ((perspective.fov ?? 45) * Math.PI) / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const usableFov = Math.min(verticalFov, horizontalFov);
    const distance = (bounds.radius / Math.sin(usableFov / 2)) * FRAMING_PADDING;

    const target = new Vector3(bounds.center[0], bounds.center[1], bounds.center[2]);
    camera.position.copy(PRESET_DIRECTIONS[preset]).multiplyScalar(distance).add(target);
    camera.lookAt(target);
    perspective.near = Math.max(0.05, distance / 200);
    perspective.far = distance * 8;
    camera.updateProjectionMatrix();

    // `makeDefault` publishes OrbitControls here; before it mounts the lookAt above stands in.
    const orbit = controls as unknown as OrbitLike | null;
    if (orbit) {
      orbit.target.copy(target);
      orbit.update();
    }
    invalidate();
  }, [bounds, preset, resetToken, camera, controls, invalidate]);

  return null;
}

// ── Building ──────────────────────────────────────────────────────────────

interface BuildingProps {
  model: SceneModel;
  visibleFloorCount: number;
  showRoof: boolean;
  materials: StyleMaterials;
}

function Building({ model, visibleFloorCount, showRoof, materials }: BuildingProps) {
  const invalidate = useThree((state) => state.invalidate);

  const groups = useMemo(() => {
    const visible = model.floors.slice(0, Math.max(1, visibleFloorCount));
    return {
      slabs: visible.map((floor) => floor.slab),
      finishes: visible.map((floor) => floor.finish),
      walls: visible.flatMap((floor) => floor.walls),
      glass: visible.flatMap((floor) => floor.glass),
      steps: visible.flatMap((floor) => floor.steps),
    };
  }, [model, visibleFloorCount]);

  // Cutaway changes swap whole object trees; nudge the on-demand loop.
  useEffect(() => invalidate(), [groups, showRoof, invalidate]);

  return (
    <group>
      <BoxCluster boxes={groups.slabs}>
        <meshStandardMaterial color={SCENE_COLORS.slab} {...SCENE_SURFACES.slab} />
      </BoxCluster>
      <BoxCluster boxes={groups.finishes}>
        <meshStandardMaterial color={materials.floor} {...SCENE_SURFACES.floor} />
      </BoxCluster>
      <BoxCluster boxes={groups.walls}>
        <meshStandardMaterial color={materials.wall} {...SCENE_SURFACES.wall} />
      </BoxCluster>
      <BoxCluster boxes={groups.steps}>
        <meshStandardMaterial color={SCENE_COLORS.step} {...SCENE_SURFACES.step} />
      </BoxCluster>
      <BoxCluster boxes={groups.glass}>
        <meshStandardMaterial
          color={materials.glass}
          transparent
          depthWrite={false}
          {...SCENE_SURFACES.glass}
        />
      </BoxCluster>
      {showRoof && model.roof ? <Roof roof={model.roof} materials={materials} /> : null}
    </group>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────

export interface HouseSceneProps {
  model: SceneModel;
  /** Floors drawn from grade up; anything above is cut away. */
  visibleFloorCount: number;
  showRoof: boolean;
  /** Architectural style — tunes materials only, never geometry (§56). */
  style: HouseStyle | null;
  /** Camera preset the rig frames from; orbiting away from it is free. */
  preset: CameraPreset;
  /** Any change re-frames the camera — the reset-view control bumps it. */
  resetToken: number;
  /** Localized description of the view; the canvas is exposed as an image. */
  ariaLabel: string;
  className?: string;
}

export function HouseScene({
  model,
  visibleFloorCount,
  showRoof,
  style,
  preset,
  resetToken,
  ariaLabel,
  className,
}: HouseSceneProps) {
  const { ground, bounds } = model;
  const lightDistance = Math.max(bounds.radius, 1) * 2.2;
  const materials = materialsForStyle(style);

  return (
    <Canvas
      role="img"
      aria-label={ariaLabel}
      className={cn('touch-none', className)}
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 500, position: [12, 9, 12] }}
    >
      <color attach="background" args={[SCENE_COLORS.background]} />

      <ambientLight intensity={SCENE_LIGHTS.ambientIntensity} />
      <directionalLight
        intensity={SCENE_LIGHTS.directionalIntensity}
        position={[
          SCENE_LIGHTS.directionalOffset[0] * lightDistance,
          SCENE_LIGHTS.directionalOffset[1] * lightDistance,
          SCENE_LIGHTS.directionalOffset[2] * lightDistance,
        ]}
      />

      <mesh position={ground.center}>
        <boxGeometry args={ground.size} />
        <meshStandardMaterial color={SCENE_COLORS.ground} {...SCENE_SURFACES.ground} />
      </mesh>

      {/*
       * Soft grounding shadow, rendered once per invalidation batch (`frames={1}`)
       * so it stays compatible with the on-demand frame loop — no per-frame cost,
       * no shadow maps. `key` re-bakes it when the building or cutaway changes.
       */}
      <ContactShadows
        key={`${model.engineVersion}-${visibleFloorCount}-${showRoof}`}
        frames={1}
        position={[0, 0.01, 0]}
        scale={Math.max(ground.size[0], ground.size[2]) * 1.1}
        far={model.heightM + 1}
        blur={2.4}
        opacity={0.32}
        resolution={512}
      />

      <Building
        model={model}
        visibleFloorCount={visibleFloorCount}
        showRoof={showRoof}
        materials={materials}
      />

      <CameraRig bounds={bounds} preset={preset} resetToken={resetToken} />
      {/* drei already calls invalidate() on every `change` event — required by frameloop="demand". */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={MIN_POLAR_ANGLE}
        maxPolarAngle={MAX_POLAR_ANGLE}
        minDistance={Math.max(bounds.radius * 0.4, 1)}
        maxDistance={Math.max(bounds.radius * 8, 20)}
      />
    </Canvas>
  );
}

export default HouseScene;
