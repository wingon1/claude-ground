import * as THREE from 'three'

export function Cottage({ position = [0, 0, 0] as [number, number, number] }) {
  const wallColor = '#F5E6C8'
  const roofColor = '#C1513A'
  const roofDark = '#A8432E'
  const trimColor = '#8B6347'
  const windowColor = '#A8D4F0'
  const doorColor = '#8B5A2B'
  const chimneyColor = '#B8A090'

  return (
    <group position={position}>
      {/* Foundation / base */}
      <mesh receiveShadow position={[0, 0.06, 0]}>
        <boxGeometry args={[2.6, 0.12, 2.2]} />
        <meshStandardMaterial color="#D4C5A9" roughness={0.95} metalness={0} />
      </mesh>

      {/* Main walls */}
      <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[2.4, 1.38, 2.0]} />
        <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
      </mesh>

      {/* Gable / triangular top front */}
      <mesh castShadow position={[0, 1.62, 0.78]}>
        <cylinderGeometry args={[0, 0.72, 0.72, 3, 1]} />
        <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
      </mesh>
      <mesh castShadow position={[0, 1.62, -0.78]}>
        <cylinderGeometry args={[0, 0.72, 0.72, 3, 1]} />
        <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
      </mesh>

      {/* Roof main body */}
      <mesh castShadow receiveShadow position={[0, 1.78, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.08, 1.52, 2.35, 4, 1]} />
        <meshStandardMaterial color={roofColor} roughness={0.82} metalness={0} />
      </mesh>

      {/* Roof ridge cap */}
      <mesh castShadow position={[0, 2.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 2.1, 12, 1]} />
        <meshStandardMaterial color={roofDark} roughness={0.85} metalness={0} />
      </mesh>

      {/* Roof eaves overhang */}
      <mesh castShadow position={[0, 1.48, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.14, 1.66, 0.1, 4, 1]} />
        <meshStandardMaterial color={roofDark} roughness={0.8} metalness={0} />
      </mesh>

      {/* Chimney */}
      <mesh castShadow receiveShadow position={[0.55, 2.05, -0.3]}>
        <boxGeometry args={[0.28, 0.72, 0.28]} />
        <meshStandardMaterial color={chimneyColor} roughness={0.92} metalness={0} />
      </mesh>
      <mesh castShadow position={[0.55, 2.44, -0.3]}>
        <boxGeometry args={[0.34, 0.1, 0.34]} />
        <meshStandardMaterial color="#9A8070" roughness={0.9} metalness={0} />
      </mesh>

      {/* Front door */}
      <mesh castShadow receiveShadow position={[0, 0.56, 1.01]}>
        <boxGeometry args={[0.42, 0.82, 0.06]} />
        <meshStandardMaterial color={doorColor} roughness={0.85} metalness={0} />
      </mesh>
      {/* Door arch top */}
      <mesh position={[0, 0.98, 1.01]}>
        <cylinderGeometry args={[0.21, 0.21, 0.06, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={doorColor} roughness={0.85} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Door knob */}
      <mesh position={[0.14, 0.58, 1.04]}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <meshStandardMaterial color="#D4A500" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Windows front */}
      {[-0.75, 0.75].map((x, i) => (
        <group key={i} position={[x, 0.82, 1.01]}>
          {/* Window frame */}
          <mesh castShadow>
            <boxGeometry args={[0.38, 0.38, 0.05]} />
            <meshStandardMaterial color={trimColor} roughness={0.88} metalness={0} />
          </mesh>
          {/* Glass */}
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[0.3, 0.3, 0.02]} />
            <meshStandardMaterial color={windowColor} roughness={0.1} metalness={0.1} transparent opacity={0.75} />
          </mesh>
          {/* Cross panes */}
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.32, 0.025, 0.02]} />
            <meshStandardMaterial color={trimColor} roughness={0.88} metalness={0} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.025, 0.32, 0.02]} />
            <meshStandardMaterial color={trimColor} roughness={0.88} metalness={0} />
          </mesh>
          {/* Window flower box */}
          <mesh position={[0, -0.22, 0.04]}>
            <boxGeometry args={[0.42, 0.1, 0.12]} />
            <meshStandardMaterial color="#C8A87A" roughness={0.9} metalness={0} />
          </mesh>
          {/* Flowers */}
          {[-0.12, 0, 0.12].map((fx, fi) => (
            <mesh key={fi} position={[fx, -0.12, 0.06]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial color={['#FF9EAF', '#FFD966', '#FF8FA3'][fi]} roughness={0.8} metalness={0} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Side windows */}
      {([-1.0, 1.0] as number[]).map((z, i) => (
        <group key={i} position={[1.21, 0.82, z * 0.4]}>
          <mesh castShadow>
            <boxGeometry args={[0.05, 0.35, 0.35]} />
            <meshStandardMaterial color={trimColor} roughness={0.88} metalness={0} />
          </mesh>
          <mesh position={[-0.025, 0, 0]}>
            <boxGeometry args={[0.02, 0.27, 0.27]} />
            <meshStandardMaterial color={windowColor} roughness={0.1} metalness={0.1} transparent opacity={0.75} />
          </mesh>
        </group>
      ))}

      {/* Step */}
      <mesh receiveShadow position={[0, 0.06, 1.18]}>
        <boxGeometry args={[0.58, 0.1, 0.22]} />
        <meshStandardMaterial color="#C8B89A" roughness={0.9} metalness={0} />
      </mesh>

      {/* Wood trim beams decorative */}
      {[-0.72, 0.72].map((x, i) => (
        <mesh key={i} castShadow position={[x, 0.75, 1.01]}>
          <boxGeometry args={[0.07, 1.38, 0.04]} />
          <meshStandardMaterial color={trimColor} roughness={0.88} metalness={0} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.44, 1.01]}>
        <boxGeometry args={[1.5, 0.07, 0.04]} />
        <meshStandardMaterial color={trimColor} roughness={0.88} metalness={0} />
      </mesh>
    </group>
  )
}
