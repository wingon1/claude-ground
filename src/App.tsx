import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  Lightformer,
  SoftShadows,
} from '@react-three/drei'
import * as THREE from 'three'

import { Ground } from './components/Ground'
import { Tree } from './components/Tree'
import { Mushroom } from './components/Mushroom'
import { Boulder } from './components/Boulder'
import { Cottage } from './components/Cottage'
import { Stream } from './components/Stream'

/**
 * The whole diorama, gently breathing. A barely-perceptible bob + rotation on the
 * root group makes the island feel hand-held and alive without distracting from
 * the orbit controls.
 */
function Diorama() {
  const root = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!root.current) return
    const t = clock.getElapsedTime()
    root.current.position.y = Math.sin(t * 0.5) * 0.05
    root.current.rotation.z = Math.sin(t * 0.4) * 0.004
  })

  return (
    <group ref={root}>
      <Ground />

      {/* Cozy cottage, angled toward the camera */}
      <group position={[-2.3, 0, -1.4]} rotation={[0, 0.55, 0]}>
        <Cottage />
      </group>

      {/* Trees — a curated mix of variants and gentle scales */}
      <Tree position={[3.2, 0, -2.3]} scale={1.15} variant="oak" windOffset={0.0} />
      <Tree position={[-4.1, 0, -2.7]} scale={0.9} variant="oak" windOffset={2.1} />
      <Tree position={[4.0, 0, 2.5]} scale={1.05} variant="pine" windOffset={1.2} />
      <Tree position={[-3.7, 0, 2.5]} scale={0.95} variant="round" windOffset={3.4} />
      <Tree position={[1.9, 0, 3.7]} scale={0.8} variant="round" windOffset={4.7} />
      <Tree position={[-0.6, 0, -3.6]} scale={0.85} variant="pine" windOffset={0.8} />

      {/* Plump little mushrooms tucked beside the trees */}
      <Mushroom position={[3.9, 0, -1.3]} scale={1.0} capColor="#E8433A" />
      <Mushroom position={[-3.0, 0, 3.0]} scale={1.15} capColor="#E89B3A" />
      <Mushroom position={[2.6, 0, 3.1]} scale={0.85} capColor="#7AA8E8" />
      <Mushroom position={[-3.3, 0, -2.0]} scale={0.7} capColor="#E8433A" />
      <Mushroom position={[0.7, 0, 3.2]} scale={0.95} capColor="#C77DD8" />

      {/* Clay-like boulders */}
      <Boulder position={[-1.1, 0.1, 2.7]} scale={1.15} />
      <Boulder position={[4.5, 0.1, -0.3]} scale={0.8} color="#C2BAB0" />
      <Boulder position={[1.3, 0.1, -3.4]} scale={0.95} color="#ACA49A" />

      {/* The shimmering little stream */}
      <Stream />
    </group>
  )
}

/** Soft, slow-drifting puffy clouds built from clustered spheres. */
function Clouds() {
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.getElapsedTime()
    group.current.children.forEach((c, i) => {
      c.position.x = ((i * 7.3 + t * 0.25) % 26) - 13
    })
  })

  const puffs: [number, number][] = [
    [0, 0],
    [0.9, 0.15],
    [-0.9, 0.1],
    [0.45, 0.45],
    [-0.4, 0.4],
  ]

  return (
    <group ref={group}>
      {[
        { z: -7, y: 8.5, s: 1.0 },
        { z: 6, y: 9.5, s: 1.3 },
        { z: -2, y: 10.5, s: 0.85 },
      ].map((c, i) => (
        <group key={i} position={[0, c.y, c.z]} scale={c.s}>
          {puffs.map(([dx, dy], j) => (
            <mesh key={j} position={[dx, dy, 0]} castShadow>
              <sphereGeometry args={[0.7, 24, 24]} />
              <meshStandardMaterial
                color="#FFFFFF"
                roughness={1}
                metalness={0}
                emissive="#FFF6E8"
                emissiveIntensity={0.12}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export default function App() {
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{ position: [10.5, 7.5, 11.5], fov: 34, near: 0.1, far: 120 }}
      >
        {/* Warm pastel sky + matching fog for soft atmospheric depth */}
        <color attach="background" args={['#CDEBF5']} />
        <fog attach="fog" args={['#D6ECF2', 24, 48]} />

        {/* High-quality percentage-closer soft shadows */}
        <SoftShadows size={28} samples={16} focus={0.8} />

        <Suspense fallback={null}>
          {/* Sky/ground bounce */}
          <hemisphereLight args={['#FCEFD2', '#7CA05A', 0.65]} />
          {/* Soft warm ambient fill */}
          <ambientLight intensity={0.35} color="#FFF3DD" />

          {/* Key light — warm afternoon sun, casting crisp-soft shadows */}
          <directionalLight
            castShadow
            position={[9, 13, 7]}
            intensity={3.0}
            color="#FFE6BE"
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-near={0.5}
            shadow-camera-far={45}
            shadow-camera-left={-14}
            shadow-camera-right={14}
            shadow-camera-top={14}
            shadow-camera-bottom={-14}
          />
          {/* Cool rim/fill from the opposite side to keep shadows from going muddy */}
          <directionalLight position={[-8, 6, -7]} intensity={0.55} color="#BCD6FF" />

          <Diorama />
          <Clouds />

          {/* Inline environment (no external files) — gives the water and toy
              surfaces believable reflections and a soft studio sheen. */}
          <Environment resolution={256} environmentIntensity={0.55}>
            <color attach="background" args={['#dff1f6']} />
            <Lightformer
              intensity={2.2}
              position={[0, 6, 0]}
              scale={[12, 12, 1]}
              color="#FFF1D8"
            />
            <Lightformer
              intensity={1.1}
              position={[6, 3, 6]}
              scale={[6, 6, 1]}
              color="#CFE6FF"
            />
            <Lightformer
              intensity={1.0}
              position={[-6, 2, -4]}
              scale={[6, 6, 1]}
              color="#FFE0C0"
            />
          </Environment>
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={7}
          maxDistance={28}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 2.15}
          autoRotate
          autoRotateSpeed={0.35}
          target={[0, 0.8, 0]}
        />
      </Canvas>

      {/* Cozy on-canvas label */}
      <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 text-center">
        <h1 className="text-2xl font-extrabold tracking-wide text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
          🍃 Cozy Cove
        </h1>
        <p className="mt-1 text-sm font-medium text-white/70 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
          drag to orbit · scroll to zoom
        </p>
      </div>
    </div>
  )
}
