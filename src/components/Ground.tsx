import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * A chubby, rounded "floating island" diorama base — the iconic Animal Crossing
 * silhouette. A high-segment circular grass cap sits on a tapered dirt body so the
 * whole map reads like a cozy little clay world you could pick up.
 */
export function Ground() {
  const R = 7

  // Gently undulating grass cap. Bumps fade out toward the rim so the edge stays
  // clean where it meets the dirt cliff below.
  const grassGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(R, 144)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const r = Math.sqrt(x * x + y * y)
      // 1 in the interior, easing to 0 over the last ~1.4 units before the rim
      const fade = 1 - THREE.MathUtils.smoothstep(r, R - 1.4, R)
      const bump =
        (Math.sin(x * 0.6) * 0.11 +
          Math.sin(y * 0.5) * 0.09 +
          Math.sin(x * 1.3 + y * 0.9) * 0.05) *
        fade
      pos.setZ(i, bump)
    }
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group>
      {/* Grass cap */}
      <mesh receiveShadow geometry={grassGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#88C95A" roughness={1} metalness={0} />
      </mesh>

      {/* Grass rim overhang — a soft lip hanging over the dirt */}
      <mesh receiveShadow position={[0, -0.14, 0]}>
        <cylinderGeometry args={[7.08, 6.95, 0.3, 144, 1, true]} />
        <meshStandardMaterial
          color="#76B84E"
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Dirt body */}
      <mesh castShadow receiveShadow position={[0, -1.05, 0]}>
        <cylinderGeometry args={[6.95, 5.6, 1.9, 144, 1]} />
        <meshStandardMaterial color="#A06E44" roughness={1} metalness={0} />
      </mesh>

      {/* Darker tapering underbelly so the island feels like it floats */}
      <mesh castShadow position={[0, -2.35, 0]}>
        <cylinderGeometry args={[5.6, 3.6, 1.7, 120, 1]} />
        <meshStandardMaterial color="#7C5333" roughness={1} metalness={0} />
      </mesh>
      <mesh castShadow position={[0, -3.45, 0]}>
        <coneGeometry args={[3.6, 1.6, 96, 1]} />
        <meshStandardMaterial color="#664326" roughness={1} metalness={0} />
      </mesh>

      {/* Worn dirt paths winding through the grass */}
      <DirtPath position={[-0.6, 0.04, 1.0]} radii={[0.6, 1.45]} rotation={-0.3} />
      <DirtPath position={[0.5, 0.04, -0.7]} radii={[0.52, 1.15]} rotation={0.4} />
      <DirtPath position={[-1.8, 0.04, -1.9]} radii={[0.55, 0.9]} rotation={0.1} />

      {/* Flower patches sprinkled across the map */}
      {(
        [
          [-3.2, 0.02, -2.0, '#FFD1DC'],
          [-4.0, 0.02, 1.5, '#FFF0A0'],
          [3.8, 0.02, -3.2, '#D4ACFF'],
          [2.5, 0.02, 2.8, '#FFB3C6'],
          [-1.5, 0.02, 3.6, '#C8F5B0'],
          [4.3, 0.02, 0.5, '#FFE4B5'],
          [-4.4, 0.02, -1.0, '#B5D8FF'],
        ] as const
      ).map(([x, y, z, color], i) => (
        <FlowerPatch key={i} position={[x, y, z]} color={color} />
      ))}
    </group>
  )
}

/** A soft elliptical dirt trail (a circle squashed via scale — no EllipseGeometry needed). */
function DirtPath({
  position,
  radii,
  rotation = 0,
}: {
  position: [number, number, number]
  radii: [number, number]
  rotation?: number
}) {
  return (
    <mesh
      receiveShadow
      position={position}
      rotation={[-Math.PI / 2, 0, rotation]}
      scale={[radii[0], radii[1], 1]}
    >
      <circleGeometry args={[1, 48]} />
      <meshStandardMaterial color="#C8AE82" roughness={1} metalness={0} />
    </mesh>
  )
}

function FlowerPatch({
  position,
  color,
}: {
  position: [number, number, number]
  color: string
}) {
  const offsets: [number, number][] = [
    [0, 0],
    [0.22, 0.18],
    [-0.2, 0.12],
    [0.1, -0.22],
    [-0.15, -0.18],
    [0.28, -0.08],
  ]
  return (
    <group position={position}>
      {offsets.map(([dx, dz], i) => (
        <group key={i} position={[dx, 0, dz]}>
          {/* Stem */}
          <mesh castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
            <meshStandardMaterial color="#5DA832" roughness={0.9} metalness={0} />
          </mesh>
          {/* Petals */}
          <mesh castShadow position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.065, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.8} metalness={0} />
          </mesh>
          {/* Center */}
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshStandardMaterial color="#FFE44A" roughness={0.75} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
