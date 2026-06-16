import * as THREE from 'three'

interface MushroomProps {
  position: [number, number, number]
  scale?: number
  capColor?: string
}

export function Mushroom({ position, scale = 1, capColor = '#E8433A' }: MushroomProps) {
  return (
    <group position={position} scale={scale}>
      {/* Stem */}
      <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.36, 14, 1]} />
        <meshStandardMaterial color="#F5EDD6" roughness={0.9} metalness={0} />
      </mesh>
      {/* Cap */}
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.28, 28, 28, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color={capColor} roughness={0.8} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Cap underside rim */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.27, 0.22, 0.06, 20, 1, true]} />
        <meshStandardMaterial color="#F5C9C5" roughness={0.9} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* White spots */}
      {[
        [0, 0.68, 0.21],
        [-0.16, 0.6, 0.16],
        [0.15, 0.58, -0.18],
        [-0.1, 0.7, -0.12],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} castShadow>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#FEFEFE" roughness={0.85} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
