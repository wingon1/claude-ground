import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface TreeProps {
  position: [number, number, number]
  scale?: number
  variant?: 'oak' | 'pine' | 'round'
  windOffset?: number
}

export function Tree({ position, scale = 1, variant = 'oak', windOffset = 0 }: TreeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const foliageRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!foliageRef.current) return
    const t = clock.getElapsedTime()
    const sway = Math.sin(t * 0.8 + windOffset) * 0.018
    foliageRef.current.rotation.z = sway
    foliageRef.current.rotation.x = Math.sin(t * 0.6 + windOffset * 1.3) * 0.008
  })

  const trunkColor = '#8B6347'
  const darkTrunk = '#6B4C34'

  const leafColors = {
    oak: ['#6BBF59', '#7DCF69', '#5AAD48', '#8DD578'],
    pine: ['#4A9B6F', '#5BB080', '#3D8A60', '#6DC490'],
    round: ['#7BC96F', '#8FD882', '#6AB85F', '#A0E891'],
  }

  const colors = leafColors[variant]

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Trunk */}
      <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.13, 0.18, 1.1, 16, 1]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} metalness={0} />
      </mesh>
      {/* Trunk bump */}
      <mesh castShadow position={[0.05, 0.3, 0.06]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={darkTrunk} roughness={0.95} metalness={0} />
      </mesh>

      <group ref={foliageRef} position={[0, 1.1, 0]}>
        {variant === 'oak' && (
          <>
            {/* Main canopy blob */}
            <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
              <sphereGeometry args={[0.72, 32, 32]} />
              <meshStandardMaterial color={colors[0]} roughness={0.85} metalness={0} />
            </mesh>
            {/* Side puffs */}
            <mesh castShadow position={[-0.45, 0.25, 0.1]}>
              <sphereGeometry args={[0.52, 28, 28]} />
              <meshStandardMaterial color={colors[1]} roughness={0.85} metalness={0} />
            </mesh>
            <mesh castShadow position={[0.45, 0.2, -0.05]}>
              <sphereGeometry args={[0.5, 28, 28]} />
              <meshStandardMaterial color={colors[2]} roughness={0.85} metalness={0} />
            </mesh>
            <mesh castShadow position={[0.1, 0.25, -0.42]}>
              <sphereGeometry args={[0.48, 28, 28]} />
              <meshStandardMaterial color={colors[3]} roughness={0.85} metalness={0} />
            </mesh>
            <mesh castShadow position={[-0.08, 0.25, 0.44]}>
              <sphereGeometry args={[0.46, 28, 28]} />
              <meshStandardMaterial color={colors[1]} roughness={0.85} metalness={0} />
            </mesh>
            {/* Top puff */}
            <mesh castShadow position={[0, 0.92, 0]}>
              <sphereGeometry args={[0.42, 28, 28]} />
              <meshStandardMaterial color={colors[3]} roughness={0.85} metalness={0} />
            </mesh>
          </>
        )}

        {variant === 'pine' && (
          <>
            <mesh castShadow receiveShadow position={[0, 0, 0]}>
              <coneGeometry args={[0.7, 1.0, 20, 1]} />
              <meshStandardMaterial color={colors[0]} roughness={0.88} metalness={0} />
            </mesh>
            <mesh castShadow position={[0, 0.6, 0]}>
              <coneGeometry args={[0.55, 0.9, 20, 1]} />
              <meshStandardMaterial color={colors[2]} roughness={0.88} metalness={0} />
            </mesh>
            <mesh castShadow position={[0, 1.1, 0]}>
              <coneGeometry args={[0.38, 0.75, 20, 1]} />
              <meshStandardMaterial color={colors[1]} roughness={0.88} metalness={0} />
            </mesh>
            <mesh castShadow position={[0, 1.52, 0]}>
              <coneGeometry args={[0.22, 0.55, 16, 1]} />
              <meshStandardMaterial color={colors[3]} roughness={0.88} metalness={0} />
            </mesh>
          </>
        )}

        {variant === 'round' && (
          <>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.78, 32, 32]} />
              <meshStandardMaterial color={colors[0]} roughness={0.82} metalness={0} />
            </mesh>
            <mesh castShadow position={[0.3, 0.55, 0.2]}>
              <sphereGeometry args={[0.44, 28, 28]} />
              <meshStandardMaterial color={colors[3]} roughness={0.82} metalness={0} />
            </mesh>
            <mesh castShadow position={[-0.32, 0.5, -0.15]}>
              <sphereGeometry args={[0.4, 28, 28]} />
              <meshStandardMaterial color={colors[1]} roughness={0.82} metalness={0} />
            </mesh>
          </>
        )}
      </group>
    </group>
  )
}
