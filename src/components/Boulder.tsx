import { useMemo } from 'react'
import * as THREE from 'three'

interface BoulderProps {
  position: [number, number, number]
  scale?: number
  color?: string
}

/** A smooth, clay-like boulder: a sphere gently displaced by layered noise so
 *  every one is a little different, topped with a moss cap and a few pebbles. */
export function Boulder({ position, scale = 1, color = '#B8B0A4' }: BoulderProps) {
  // Seed the noise from the position so neighbouring rocks don't look identical.
  const seed = useMemo(() => position[0] * 12.9 + position[2] * 78.2, [position])

  const rockGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.55, 48, 48)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    const n = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      n.copy(v).normalize()
      const noise =
        0.09 * Math.sin(n.x * 4.5 + seed) +
        0.07 * Math.sin(n.y * 6.0 + seed * 1.3) +
        0.05 * Math.cos(n.z * 5.0 + n.x * 2.0 + seed * 0.7)
      v.addScaledVector(n, noise)
      if (v.y < 0) v.y *= 0.78 // flatten where it meets the ground
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [seed])

  const mossGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.4, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.5)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      v.y += Math.sin(v.x * 8 + seed) * 0.02 + Math.cos(v.z * 7) * 0.02
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [seed])

  return (
    <group position={position} scale={scale}>
      {/* Main rock */}
      <mesh geometry={rockGeo} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>

      {/* Secondary lobe for a more organic silhouette */}
      <mesh geometry={rockGeo} castShadow receiveShadow position={[0.34, -0.16, 0.18]} scale={0.55} rotation={[0.4, 1.2, 0.2]}>
        <meshStandardMaterial color={color} roughness={0.93} metalness={0} />
      </mesh>

      {/* Moss cap */}
      <mesh geometry={mossGeo} castShadow position={[0.02, 0.22, -0.02]} scale={[1, 0.75, 1]}>
        <meshStandardMaterial color="#7FB85A" roughness={0.95} metalness={0} />
      </mesh>

      {/* Scattered pebbles at the base */}
      {([
        [0.42, -0.32, 0.3, 0.13],
        [-0.4, -0.34, 0.22, 0.1],
        [-0.18, -0.34, -0.42, 0.11],
      ] as const).map(([x, y, z, r], i) => (
        <mesh key={i} castShadow receiveShadow position={[x, y, z]} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[r, 18, 18]} />
          <meshStandardMaterial color={i % 2 ? '#9A9490' : '#CEC8C2'} roughness={0.92} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
