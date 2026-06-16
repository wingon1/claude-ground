import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

/**
 * A cozy, chubby Animal-Crossing-style cottage. Every primitive is a RoundedBox
 * so edges read as soft beveled clay rather than hard CAD boxes. Warm emissive
 * window glass makes it feel lived-in, and the pitched roof, shutters, flower
 * boxes, brick chimney and little awning add the storybook detail.
 */

// --- Geometry constants (cottage sits with its floor at y = 0) -------------
const BODY_W = 2.4 // along X
const BODY_D = 2.0 // along Z
const BODY_H = 1.5
const FLOOR_Y = 0.3 // top of the stone foundation
const BODY_CY = FLOOR_Y + BODY_H / 2 // 1.05
const BODY_TOP = FLOOR_Y + BODY_H // 1.8

const EAVE_X = BODY_W / 2 + 0.3 // roof overhang past the wall
const ROOF_RUN = EAVE_X // ridge(x=0) -> eave
const ROOF_PITCH = 0.59 // radians (~34°)
const RIDGE_RISE = ROOF_RUN * Math.tan(ROOF_PITCH)
const EAVE_Y = BODY_TOP - 0.02
const RIDGE_Y = EAVE_Y + RIDGE_RISE
const SLOPE_LEN = Math.hypot(ROOF_RUN, RIDGE_RISE) + 0.08
const ROOF_DEPTH = BODY_D + 0.6 // overhang front & back

// --- Palette (warm pastel, matte clay) -------------------------------------
const C = {
  stone: '#C9BBA0',
  wall: '#F2E3C2',
  wallShade: '#E7D3AC',
  timber: '#9A6B43',
  roof: '#CE7257',
  roofDark: '#A8543C',
  doorWood: '#A6714A',
  doorDark: '#7F5333',
  frame: '#FBF4E4',
  glass: '#BFE3F2',
  glassGlow: '#FFCE73',
  shutter: '#86A98C',
  brick: '#B26A55',
  brickDark: '#925445',
  brass: '#D9A93B',
}

export function Cottage({ position = [0, 0, 0] as [number, number, number] }) {
  // Triangular gable end that fills the wall under the pitched roof.
  const gableGeo = useMemo(() => {
    const hw = BODY_W / 2
    const rise = RIDGE_Y - BODY_TOP
    const s = new THREE.Shape()
    s.moveTo(-hw, 0)
    s.lineTo(hw, 0)
    s.lineTo(0, rise)
    s.closePath()
    const depth = 0.14
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    })
    geo.translate(0, 0, -depth / 2)
    return geo
  }, [])

  return (
    <group position={position}>
      {/* ---- Stone foundation ---- */}
      <RoundedBox
        args={[BODY_W + 0.28, FLOOR_Y + 0.04, BODY_D + 0.28]}
        radius={0.07}
        smoothness={5}
        position={[0, (FLOOR_Y + 0.04) / 2 - 0.04, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={C.stone} roughness={0.95} metalness={0} />
      </RoundedBox>

      {/* ---- Main wall body ---- */}
      <RoundedBox
        args={[BODY_W, BODY_H, BODY_D]}
        radius={0.14}
        smoothness={6}
        position={[0, BODY_CY, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={C.wall} roughness={0.9} metalness={0} />
      </RoundedBox>

      {/* ---- Timber corner posts ---- */}
      {(
        [
          [BODY_W / 2 - 0.04, BODY_D / 2 - 0.04],
          [-(BODY_W / 2 - 0.04), BODY_D / 2 - 0.04],
          [BODY_W / 2 - 0.04, -(BODY_D / 2 - 0.04)],
          [-(BODY_W / 2 - 0.04), -(BODY_D / 2 - 0.04)],
        ] as const
      ).map(([x, z], i) => (
        <RoundedBox
          key={i}
          args={[0.13, BODY_H + 0.02, 0.13]}
          radius={0.05}
          smoothness={4}
          position={[x, BODY_CY, z]}
          castShadow
        >
          <meshStandardMaterial color={C.timber} roughness={0.85} metalness={0} />
        </RoundedBox>
      ))}

      {/* ---- Timber sill beam under the eaves ---- */}
      <RoundedBox
        args={[BODY_W + 0.06, 0.12, BODY_D + 0.06]}
        radius={0.05}
        smoothness={4}
        position={[0, BODY_TOP - 0.04, 0]}
        castShadow
      >
        <meshStandardMaterial color={C.timber} roughness={0.85} metalness={0} />
      </RoundedBox>

      {/* ---- Gable ends (front & back), tucked under the roof ---- */}
      <mesh geometry={gableGeo} position={[0, BODY_TOP, BODY_D / 2]} castShadow receiveShadow>
        <meshStandardMaterial color={C.wallShade} roughness={0.9} metalness={0} />
      </mesh>
      <mesh geometry={gableGeo} position={[0, BODY_TOP, -BODY_D / 2]} castShadow receiveShadow>
        <meshStandardMaterial color={C.wallShade} roughness={0.9} metalness={0} />
      </mesh>

      {/* ---- Pitched roof: two beveled slabs ---- */}
      <RoundedBox
        args={[SLOPE_LEN, 0.16, ROOF_DEPTH]}
        radius={0.07}
        smoothness={5}
        position={[ROOF_RUN / 2, (EAVE_Y + RIDGE_Y) / 2, 0]}
        rotation={[0, 0, -ROOF_PITCH]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={C.roof} roughness={0.8} metalness={0} />
      </RoundedBox>
      <RoundedBox
        args={[SLOPE_LEN, 0.16, ROOF_DEPTH]}
        radius={0.07}
        smoothness={5}
        position={[-ROOF_RUN / 2, (EAVE_Y + RIDGE_Y) / 2, 0]}
        rotation={[0, 0, ROOF_PITCH]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={C.roof} roughness={0.8} metalness={0} />
      </RoundedBox>

      {/* ---- Ridge cap ---- */}
      <mesh position={[0, RIDGE_Y + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, ROOF_DEPTH + 0.02, 20]} />
        <meshStandardMaterial color={C.roofDark} roughness={0.82} metalness={0} />
      </mesh>

      {/* ---- Door ---- */}
      <Door />

      {/* ---- Front windows flanking the door ---- */}
      <Window position={[-0.82, 0.92, BODY_D / 2]} />
      <Window position={[0.82, 0.92, BODY_D / 2]} />

      {/* ---- Side windows ---- */}
      <Window position={[BODY_W / 2, 1.0, 0.45]} rotation={[0, Math.PI / 2, 0]} />
      <Window position={[BODY_W / 2, 1.0, -0.45]} rotation={[0, Math.PI / 2, 0]} />

      {/* ---- Brick chimney on the back-left roof slope ---- */}
      <Chimney />
    </group>
  )
}

// ---------------------------------------------------------------------------
function Door() {
  const z = BODY_D / 2
  return (
    <group position={[0, 0, z]}>
      {/* Recessed frame */}
      <RoundedBox args={[0.78, 1.22, 0.12]} radius={0.05} smoothness={5} position={[0, 0.92, -0.02]} castShadow>
        <meshStandardMaterial color={C.doorDark} roughness={0.85} metalness={0} />
      </RoundedBox>
      {/* Door slab */}
      <RoundedBox args={[0.6, 1.05, 0.12]} radius={0.05} smoothness={5} position={[0, 0.83, 0.04]} castShadow>
        <meshStandardMaterial color={C.doorWood} roughness={0.78} metalness={0} />
      </RoundedBox>
      {/* Panel insets */}
      {[1.05, 0.7].map((y, i) => (
        <RoundedBox key={i} args={[0.34, 0.26, 0.04]} radius={0.03} smoothness={4} position={[0, y, 0.11]}>
          <meshStandardMaterial color={C.doorDark} roughness={0.8} metalness={0} />
        </RoundedBox>
      ))}
      {/* Knob */}
      <mesh position={[0.2, 0.82, 0.13]} castShadow>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color={C.brass} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Threshold step */}
      <RoundedBox args={[0.84, 0.12, 0.4]} radius={0.05} smoothness={4} position={[0, 0.32, 0.18]} receiveShadow castShadow>
        <meshStandardMaterial color={C.stone} roughness={0.95} metalness={0} />
      </RoundedBox>
      {/* Little awning above the door */}
      <RoundedBox args={[0.92, 0.1, 0.34]} radius={0.05} smoothness={4} position={[0, 1.52, 0.12]} rotation={[0.35, 0, 0]} castShadow>
        <meshStandardMaterial color={C.roofDark} roughness={0.8} metalness={0} />
      </RoundedBox>
    </group>
  )
}

// ---------------------------------------------------------------------------
function Window({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Frame */}
      <RoundedBox args={[0.52, 0.52, 0.1]} radius={0.05} smoothness={5} castShadow>
        <meshStandardMaterial color={C.frame} roughness={0.85} metalness={0} />
      </RoundedBox>
      {/* Warm glowing glass */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.38, 0.38, 0.04]} />
        <meshStandardMaterial
          color={C.glass}
          emissive={C.glassGlow}
          emissiveIntensity={0.55}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
      {/* Cross mullions */}
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[0.42, 0.04, 0.03]} />
        <meshStandardMaterial color={C.frame} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[0.04, 0.42, 0.03]} />
        <meshStandardMaterial color={C.frame} roughness={0.85} metalness={0} />
      </mesh>
      {/* Shutters */}
      {[-0.33, 0.33].map((x, i) => (
        <RoundedBox key={i} args={[0.12, 0.5, 0.05]} radius={0.03} smoothness={4} position={[x, 0, 0.02]} castShadow>
          <meshStandardMaterial color={C.shutter} roughness={0.8} metalness={0} />
        </RoundedBox>
      ))}
      {/* Flower box */}
      <RoundedBox args={[0.5, 0.12, 0.14]} radius={0.04} smoothness={4} position={[0, -0.32, 0.1]} castShadow>
        <meshStandardMaterial color={C.timber} roughness={0.85} metalness={0} />
      </RoundedBox>
      {([['#FF9EAF', -0.15], ['#FFD966', 0], ['#FF8FA3', 0.15]] as const).map(([col, x], i) => (
        <group key={i} position={[x, -0.24, 0.12]}>
          <mesh castShadow>
            <sphereGeometry args={[0.055, 14, 14]} />
            <meshStandardMaterial color={col} roughness={0.8} metalness={0} />
          </mesh>
          <mesh position={[0, 0.01, 0.02]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshStandardMaterial color="#FFE44A" roughness={0.75} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
function Chimney() {
  const x = -0.7
  const z = -0.45
  const baseY = 2.1
  return (
    <group position={[x, 0, z]}>
      {/* Stack */}
      <RoundedBox args={[0.38, 1.0, 0.38]} radius={0.06} smoothness={5} position={[0, baseY, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.brick} roughness={0.92} metalness={0} />
      </RoundedBox>
      {/* Cap */}
      <RoundedBox args={[0.48, 0.14, 0.48]} radius={0.05} smoothness={4} position={[0, baseY + 0.55, 0]} castShadow>
        <meshStandardMaterial color={C.brickDark} roughness={0.9} metalness={0} />
      </RoundedBox>
      {/* Soft smoke puffs */}
      {([[0, 0.78, 0.16], [0.08, 0.98, 0.22], [-0.05, 1.2, 0.3]] as const).map(([dx, dy, s], i) => (
        <mesh key={i} position={[dx, baseY + dy, 0]}>
          <sphereGeometry args={[s, 16, 16]} />
          <meshStandardMaterial color="#EFEFEF" transparent opacity={0.5} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
