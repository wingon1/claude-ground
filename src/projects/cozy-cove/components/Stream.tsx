import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Heights of the stacked layers (water on top, sandy bed, dirt bank).
const WATER_Y = 0.15
const BED_Y = 0.11
const BANK_Y = 0.07
const N = 160

/** Build a flat ribbon (in the XZ plane) of given width following a center path. */
function buildRibbon(samples: THREE.Vector3[], width: number, y: number) {
  const verts: number[] = []
  const idx: number[] = []
  const nrm = new THREE.Vector3()
  const tan = new THREE.Vector3()
  const count = samples.length
  for (let i = 0; i < count; i++) {
    const cur = samples[i]
    const nxt = samples[Math.min(i + 1, count - 1)]
    const prv = samples[Math.max(i - 1, 0)]
    tan.subVectors(nxt, prv)
    nrm.set(tan.z, 0, -tan.x).normalize()
    verts.push(
      cur.x + nrm.x * (width / 2), y, cur.z + nrm.z * (width / 2),
      cur.x - nrm.x * (width / 2), y, cur.z - nrm.z * (width / 2),
    )
  }
  for (let i = 0; i < count - 1; i++) {
    const tl = 2 * i, tr = 2 * i + 1, nl = 2 * (i + 1), nr = 2 * (i + 1) + 1
    idx.push(tl, tr, nr, tl, nr, nl)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

export function Stream() {
  const waterRef = useRef<THREE.Mesh>(null)

  const { waterGeo, bedGeo, bankGeo, samples } = useMemo(() => {
    const ctrl: [number, number][] = [
      [-0.5, -3.8], [0.3, -2.6], [-0.4, -1.3], [0.4, 0.0],
      [-0.3, 1.4], [0.4, 2.7], [0.0, 3.8],
    ]
    const curve = new THREE.CatmullRomCurve3(
      ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'catmullrom',
      0.5,
    )
    const samples = curve.getPoints(N)
    return {
      samples,
      waterGeo: buildRibbon(samples, 0.95, WATER_Y),
      bedGeo: buildRibbon(samples, 1.25, BED_Y),
      bankGeo: buildRibbon(samples, 1.7, BANK_Y),
    }
  }, [])

  // Pebbles dotted along the banks.
  const pebbles = useMemo(() => {
    const list: { p: [number, number, number]; r: number; c: string }[] = []
    const nrm = new THREE.Vector3()
    const tan = new THREE.Vector3()
    for (let i = 6; i < samples.length - 6; i += 11) {
      const cur = samples[i]
      tan.subVectors(samples[i + 1], samples[i - 1])
      nrm.set(tan.z, 0, -tan.x).normalize()
      const side = i % 22 === 6 ? 1 : -1
      const off = 0.62 * side
      list.push({
        p: [cur.x + nrm.x * off, 0.11, cur.z + nrm.z * off],
        r: 0.08 + ((i * 7) % 5) * 0.012,
        c: i % 2 ? '#B7B0A6' : '#9C968E',
      })
    }
    return list
  }, [samples])

  // A couple of lily pads floating on the water.
  const pads = useMemo(() => {
    return [samples[Math.floor(N * 0.28)], samples[Math.floor(N * 0.66)]]
  }, [samples])

  // Gentle rippling: displace the water surface with travelling sine waves.
  useFrame(({ clock }) => {
    const mesh = waterRef.current
    if (!mesh) return
    const t = clock.getElapsedTime()
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, WATER_Y + Math.sin(z * 3.2 + t * 2.2) * 0.025 + Math.sin(x * 4 - t * 1.6) * 0.016)
    }
    pos.needsUpdate = true
    mesh.geometry.computeVertexNormals()
  })

  return (
    <group position={[1.6, 0, 0]}>
      {/* Dirt bank */}
      <mesh geometry={bankGeo} receiveShadow>
        <meshStandardMaterial color="#9C6B43" roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Sandy bed */}
      <mesh geometry={bedGeo} receiveShadow>
        <meshStandardMaterial color="#D8C79A" roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Water surface */}
      <mesh ref={waterRef} geometry={waterGeo} receiveShadow>
        <meshStandardMaterial
          color="#5FC6E8"
          roughness={0.08}
          metalness={0.15}
          transparent
          opacity={0.86}
          envMapIntensity={1.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Pebbles */}
      {pebbles.map((pb, i) => (
        <mesh key={i} position={pb.p} scale={[1, 0.7, 1]} castShadow receiveShadow>
          <sphereGeometry args={[pb.r, 16, 16]} />
          <meshStandardMaterial color={pb.c} roughness={0.92} metalness={0} />
        </mesh>
      ))}

      {/* Lily pads */}
      {pads.map((pad, i) => (
        <group key={i} position={[pad.x, WATER_Y + 0.02, pad.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <circleGeometry args={[0.17, 24, 0.4, Math.PI * 1.85]} />
            <meshStandardMaterial color="#5BA85A" roughness={0.7} metalness={0} side={THREE.DoubleSide} />
          </mesh>
          {i === 0 && (
            <group position={[0.04, 0.03, 0.02]}>
              {Array.from({ length: 6 }).map((_, j) => {
                const a = (j / 6) * Math.PI * 2
                return (
                  <mesh key={j} position={[Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05]} rotation={[0, -a, 0]} scale={[0.03, 0.025, 0.06]}>
                    <sphereGeometry args={[1, 12, 12]} />
                    <meshStandardMaterial color="#FF9EC2" roughness={0.8} metalness={0} />
                  </mesh>
                )
              })}
              <mesh position={[0, 0.02, 0]}>
                <sphereGeometry args={[0.03, 12, 12]} />
                <meshStandardMaterial color="#FFE44A" roughness={0.7} metalness={0} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  )
}
