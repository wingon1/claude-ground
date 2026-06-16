interface BoulderProps {
  position: [number, number, number]
  scale?: number
  color?: string
}

export function Boulder({ position, scale = 1, color = '#B8B0A4' }: BoulderProps) {
  const dark = '#9A9490'
  const light = '#CEC8C2'

  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <sphereGeometry args={[0.52, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      <mesh castShadow position={[0.22, -0.1, 0.2]}>
        <sphereGeometry args={[0.36, 20, 20]} />
        <meshStandardMaterial color={dark} roughness={0.93} metalness={0} />
      </mesh>
      <mesh castShadow position={[-0.2, -0.08, -0.15]}>
        <sphereGeometry args={[0.3, 20, 20]} />
        <meshStandardMaterial color={light} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  )
}
