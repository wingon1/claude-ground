import { useMemo } from 'react'
import * as THREE from 'three'

interface MushroomProps {
  position: [number, number, number]
  scale?: number
  capColor?: string
}

const CAP_R = 0.3

export function Mushroom({ position, scale = 1, capColor = '#E8433A' }: MushroomProps) {
  // White speckles sitting flush on the curved cap surface.
  const spots = useMemo(() => {
    const list: { p: [number, number, number]; r: number }[] = []
    const defs: [number, number, number][] = [
      // [polar from top, azimuth, radius]
      [0.15, 0.0, 0.06],
      [0.55, 1.1, 0.05],
      [0.6, 2.7, 0.045],
      [0.5, 4.2, 0.05],
      [0.85, 5.4, 0.04],
      [0.4, 3.6, 0.035],
    ]
    for (const [theta, phi, r] of defs) {
      const x = Math.sin(theta) * Math.cos(phi) * CAP_R
      const y = Math.cos(theta) * CAP_R
      const z = Math.sin(theta) * Math.sin(phi) * CAP_R
      list.push({ p: [x, y, z], r })
    }
    return list
  }, [])

  return (
    <group position={position} scale={scale}>
      {/* ---- Bulbous base ---- */}
      <mesh castShadow receiveShadow position={[0, 0.07, 0]} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial color="#EDE3C8" roughness={0.9} metalness={0} />
      </mesh>

      {/* ---- Stem (tapers upward) ---- */}
      <mesh castShadow receiveShadow position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 0.34, 20, 1]} />
        <meshStandardMaterial color="#F5EDD6" roughness={0.88} metalness={0} />
      </mesh>

      {/* ---- Skirt / ring around the stem ---- */}
      <mesh castShadow position={[0, 0.36, 0]}>
        <coneGeometry args={[0.14, 0.06, 20, 1, true]} />
        <meshStandardMaterial color="#EFE6CC" roughness={0.9} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      <group position={[0, 0.42, 0]}>
        {/* ---- Cap dome ---- */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[CAP_R, 36, 28, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
          <meshStandardMaterial color={capColor} roughness={0.6} metalness={0} side={THREE.DoubleSide} />
        </mesh>

        {/* ---- Rounded rim (thickened edge of the cap) ---- */}
        <mesh castShadow position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[CAP_R * 0.92, 0.045, 16, 36]} />
          <meshStandardMaterial color={capColor} roughness={0.6} metalness={0} />
        </mesh>

        {/* ---- Gills underside ---- */}
        <mesh position={[0, -0.01, 0]}>
          <coneGeometry args={[CAP_R * 0.9, 0.12, 32, 1, true]} />
          <meshStandardMaterial color="#F1C9C3" roughness={0.9} metalness={0} side={THREE.DoubleSide} />
        </mesh>

        {/* ---- White speckles ---- */}
        {spots.map((s, i) => (
          <mesh key={i} position={s.p} scale={[1, 0.5, 1]} castShadow>
            <sphereGeometry args={[s.r, 14, 14]} />
            <meshStandardMaterial color="#FCFAF3" roughness={0.8} metalness={0} />
          </mesh>
        ))}
      </group>

      {/* ---- Little grass tuft at the base ---- */}
      {([0.4, 2.0, 3.7, 5.2] as const).map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 0.13, 0.08, Math.sin(a) * 0.13]}
          rotation={[0, -a, Math.cos(a) * 0.25]}
          castShadow
        >
          <coneGeometry args={[0.015, 0.16, 6]} />
          <meshStandardMaterial color="#6BB84E" roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
