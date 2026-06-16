import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface TreeProps {
  position: [number, number, number]
  scale?: number
  variant?: 'oak' | 'pine' | 'round'
  windOffset?: number
}

type Puff = { p: [number, number, number]; r: number; c: string }

const PALETTE = {
  oak: { main: '#6FBF5B', light: '#92DA7C', mid: '#5CAD49', dark: '#4C9540', blossom: '#FFB7C5' },
  round: { main: '#74C667', light: '#9ADE89', mid: '#64B657', dark: '#54A249', blossom: '#FFE08A' },
  pine: { main: '#4F9E72', light: '#6BBA8D', mid: '#418A61', dark: '#356F4F', blossom: '#FFFFFF' },
}

export function Tree({ position, scale = 1, variant = 'oak', windOffset = 0 }: TreeProps) {
  const foliageRef = useRef<THREE.Group>(null)
  const pal = PALETTE[variant]

  useFrame(({ clock }) => {
    if (!foliageRef.current) return
    const t = clock.getElapsedTime()
    foliageRef.current.rotation.z = Math.sin(t * 0.8 + windOffset) * 0.02
    foliageRef.current.rotation.x = Math.sin(t * 0.6 + windOffset * 1.3) * 0.01
  })

  // Layered foliage puffs per variant
  const puffs = useMemo<Puff[]>(() => {
    if (variant === 'oak') {
      return [
        { p: [0, 0.5, 0], r: 0.72, c: pal.main },
        { p: [-0.45, 0.28, 0.12], r: 0.5, c: pal.mid },
        { p: [0.46, 0.24, -0.06], r: 0.48, c: pal.dark },
        { p: [0.12, 0.26, -0.44], r: 0.46, c: pal.mid },
        { p: [-0.1, 0.3, 0.44], r: 0.44, c: pal.main },
        { p: [0, 0.95, 0], r: 0.45, c: pal.light },
        { p: [0.22, 0.8, 0.22], r: 0.26, c: pal.light },
        { p: [-0.24, 0.72, 0.18], r: 0.2, c: pal.light },
      ]
    }
    if (variant === 'round') {
      return [
        { p: [0, 0.45, 0], r: 0.78, c: pal.main },
        { p: [0.34, 0.85, 0.2], r: 0.4, c: pal.light },
        { p: [-0.36, 0.78, -0.14], r: 0.36, c: pal.mid },
        { p: [0.1, 1.05, -0.05], r: 0.3, c: pal.light },
      ]
    }
    return [] // pine handled separately with cones
  }, [variant, pal])

  // Small blossoms / fruit decorating broadleaf canopies
  const blossoms = useMemo<[number, number, number][]>(() => {
    if (variant === 'pine') return []
    return [
      [0.45, 0.7, 0.35],
      [-0.4, 0.55, 0.4],
      [0.3, 1.1, -0.2],
      [-0.25, 0.95, 0.3],
      [0.55, 0.35, -0.2],
      [-0.1, 0.4, -0.5],
    ]
  }, [variant])

  return (
    <group position={position} scale={scale}>
      {/* ---- Trunk (tapered, with root flares) ---- */}
      <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.12, 0.17, 1.1, 24, 1]} />
        <meshStandardMaterial color="#8B6347" roughness={0.92} metalness={0} />
      </mesh>
      {/* Root flares */}
      {([0, 1, 2, 3] as const).map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.4
        return (
          <mesh
            key={i}
            castShadow
            position={[Math.cos(a) * 0.14, 0.07, Math.sin(a) * 0.14]}
            rotation={[0, -a, 0.5]}
            scale={[0.12, 0.18, 0.1]}
          >
            <sphereGeometry args={[1, 14, 14]} />
            <meshStandardMaterial color="#7A5639" roughness={0.93} metalness={0} />
          </mesh>
        )
      })}
      {/* Bark knot */}
      <mesh castShadow position={[0.13, 0.42, 0.08]} scale={[0.08, 0.1, 0.06]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#6B4C34" roughness={0.95} metalness={0} />
      </mesh>

      {/* ---- Foliage ---- */}
      <group ref={foliageRef} position={[0, 1.1, 0]}>
        {variant === 'pine' ? (
          <>
            {([
              { y: 0.05, r: 0.72, h: 1.0, c: pal.main },
              { y: 0.62, r: 0.56, h: 0.9, c: pal.mid },
              { y: 1.12, r: 0.4, h: 0.78, c: pal.light },
              { y: 1.54, r: 0.24, h: 0.58, c: pal.light },
            ] as const).map((layer, i) => (
              <mesh key={i} castShadow receiveShadow position={[0, layer.y, 0]}>
                <coneGeometry args={[layer.r, layer.h, 28, 1]} />
                <meshStandardMaterial color={layer.c} roughness={0.86} metalness={0} />
              </mesh>
            ))}
            {/* Rounded tip */}
            <mesh castShadow position={[0, 1.92, 0]}>
              <sphereGeometry args={[0.09, 16, 16]} />
              <meshStandardMaterial color={pal.light} roughness={0.86} metalness={0} />
            </mesh>
          </>
        ) : (
          puffs.map((puff, i) => (
            <mesh key={i} castShadow receiveShadow position={puff.p}>
              <sphereGeometry args={[puff.r, 32, 32]} />
              <meshStandardMaterial color={puff.c} roughness={0.85} metalness={0} />
            </mesh>
          ))
        )}

        {/* Blossoms / fruit */}
        {blossoms.map((p, i) => (
          <mesh key={i} castShadow position={p}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial
              color={pal.blossom}
              roughness={0.7}
              metalness={0}
              emissive={pal.blossom}
              emissiveIntensity={0.08}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}
