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
  SITE_SURFACES,
  type StyleMaterials,
} from './scene-palette';
import type {
  SceneBounds,
  SceneBox,
  SceneModel,
  SceneRoof,
  SceneSite,
} from './scene-builder';

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
    <instancedMesh
      key={boxes.length}
      ref={ref}
      args={[undefined, undefined, boxes.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      {children}
    </instancedMesh>
  );
}

// ── Roof ──────────────────────────────────────────────────────────────────

/** Which surface each site element is made of. */
const SITE_ELEMENT_SURFACE = {
  GARAGE: SITE_SURFACES.garage,
  DRIVEWAY: SITE_SURFACES.driveway,
  PATH: SITE_SURFACES.path,
  TERRACE: SITE_SURFACES.terrace,
  POOL: SITE_SURFACES.pool,
  BALCONY: SITE_SURFACES.balcony,
} as const;

/**
 * Garage, drive, path, terrace, pool and balcony.
 *
 * Each is a box from the engine's site layout, drawn in the material it is
 * actually made of. The pool is the only translucent one, and it is the only
 * one that does not cast a shadow — water sunk into the ground casting a hard
 * shadow onto the lawn beside it looks like a floating slab.
 */
function SiteElements({ site }: { site: SceneSite }) {
  return (
    <>
      {site.elements.map((element, index) => {
        const surface = SITE_ELEMENT_SURFACE[element.kind];
        const isWater = element.kind === 'POOL';
        return (
          <mesh
            key={`${element.kind}-${index}`}
            position={element.box.center}
            castShadow={!isWater && element.box.size[1] > 0.2}
            receiveShadow
          >
            <boxGeometry args={element.box.size} />
            <meshStandardMaterial
              color={surface.color}
              roughness={surface.roughness}
              metalness={surface.metalness}
              transparent={isWater}
              opacity={isWater ? SITE_SURFACES.pool.opacity : 1}
            />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * Planting along the plot boundary.
 *
 * Deliberately crude — a trunk and a sphere of foliage — because the point is
 * scale, not botany: without something of known height beside it, a house on an
 * empty lawn has nothing to be read against and looks like a toy. Positions are
 * derived from the plot rather than randomised, so the scene stays deterministic
 * and does not reshuffle its garden on every re-render.
 */
function Planting({
  site,
  house,
}: {
  site: SceneSite;
  house: { widthM: number; lengthM: number };
}) {
  const trees = useMemo(() => {
    const [cx, , cz] = site.plot.center;
    const halfW = site.plot.size[0] / 2;
    const halfL = site.plot.size[2] / 2;
    const inset = 1.4;
    const spots: { x: number; z: number; scale: number }[] = [];

    // Along both side boundaries, skipping the band the house occupies so a
    // tree never grows through a wall.
    const rows = Math.max(2, Math.floor(site.plot.size[2] / 7));
    for (let i = 0; i < rows; i++) {
      const t = (i + 0.5) / rows;
      const z = cz - halfL + inset + t * (site.plot.size[2] - 2 * inset);
      if (Math.abs(z) < house.lengthM / 2 + 1.5) continue;
      // A fixed alternating scale keeps the row from looking stamped.
      const scale = i % 3 === 0 ? 1.25 : i % 3 === 1 ? 0.9 : 1.1;
      spots.push({ x: cx - halfW + inset, z, scale });
      spots.push({ x: cx + halfW - inset, z, scale: scale * 0.92 });
    }
    return spots;
  }, [site.plot, house.lengthM]);

  if (trees.length === 0) return null;

  return (
    <>
      {trees.map((tree, index) => {
        const trunkH = 1.5 * tree.scale;
        const crownR = 1.15 * tree.scale;
        return (
          <group key={index} position={[tree.x, 0, tree.z]}>
            <mesh position={[0, trunkH / 2, 0]} castShadow>
              <cylinderGeometry args={[0.11 * tree.scale, 0.15 * tree.scale, trunkH, 6]} />
              <meshStandardMaterial {...SITE_SURFACES.trunk} />
            </mesh>
            <mesh position={[0, trunkH + crownR * 0.72, 0]} castShadow>
              <sphereGeometry args={[crownR, 10, 8]} />
              <meshStandardMaterial {...SITE_SURFACES.foliage} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

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
    <mesh geometry={geometry} castShadow receiveShadow>
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
  const { ground, siteBounds } = model;
  // Framed on the property, not the building: the garage, drive and pool are
  // part of what the user configured, and a camera fitted to the house alone
  // pushes them out of shot.
  const lightDistance = Math.max(siteBounds.radius, 1) * 2.2;
  const materials = materialsForStyle(style);

  return (
    <Canvas
      role="img"
      aria-label={ariaLabel}
      className={cn('touch-none', className)}
      frameloop="demand"
      dpr={[1, 2]}
      // Soft shadow maps: the single biggest step from "massing blocks" to a lit
      // building. `frameloop="demand"` means they are rendered on invalidation
      // rather than every frame, so the cost is paid on interaction, not idle.
      shadows="soft"
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 500, position: [12, 9, 12] }}
    >
      <color attach="background" args={[SCENE_COLORS.background]} />

      <ambientLight intensity={SCENE_LIGHTS.ambientIntensity} />
      {/* Sky/ground bounce. Cheap stand-in for ambient occlusion: it darkens
          undersides and inside corners, which is what makes wall junctions and
          eaves read as solid rather than as flat-shaded boxes. */}
      <hemisphereLight
        intensity={SCENE_LIGHTS.hemisphereIntensity}
        color={SCENE_COLORS.skyLight}
        groundColor={SCENE_COLORS.bounceLight}
      />
      <directionalLight
        castShadow
        intensity={SCENE_LIGHTS.directionalIntensity}
        position={[
          SCENE_LIGHTS.directionalOffset[0] * lightDistance,
          SCENE_LIGHTS.directionalOffset[1] * lightDistance,
          SCENE_LIGHTS.directionalOffset[2] * lightDistance,
        ]}
        // The shadow camera is framed to the model's bounding radius, so a small
        // cottage and a large villa both get the full map resolution instead of
        // a fixed frustum that wastes most of it on empty space.
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={lightDistance * 4}
        shadow-camera-left={-model.siteBounds.radius * 1.15}
        shadow-camera-right={model.siteBounds.radius * 1.15}
        shadow-camera-top={model.siteBounds.radius * 1.15}
        shadow-camera-bottom={-model.siteBounds.radius * 1.15}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />

      {/* The plot. Lawn when a garden was configured, bare grade otherwise —
          the ground is the one surface that tells you whether you are looking
          at a property or at a display plinth. */}
      <mesh position={ground.center} receiveShadow>
        <boxGeometry args={ground.size} />
        <meshStandardMaterial {...(model.site.hasGarden ? SITE_SURFACES.lawn : SITE_SURFACES.grade)} />
      </mesh>

      <SiteElements site={model.site} />
      {model.site.hasGarden ? <Planting site={model.site} house={model.house} /> : null}

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

      <CameraRig bounds={siteBounds} preset={preset} resetToken={resetToken} />
      {/* drei already calls invalidate() on every `change` event — required by frameloop="demand". */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={MIN_POLAR_ANGLE}
        maxPolarAngle={MAX_POLAR_ANGLE}
        minDistance={Math.max(model.bounds.radius * 0.4, 1)}
        maxDistance={Math.max(siteBounds.radius * 6, 20)}
      />
    </Canvas>
  );
}

export default HouseScene;
