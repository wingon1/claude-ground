import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Stream() {
  const waterRef = useRef<THREE.Mesh>(null)
  const foamRef = useRef<THREE.Mesh>(null)

  const waterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#5BC8E8',
        roughness: 0.05,
        metalness: 0.15,
        transparent: true,
        opacity: 0.82,
        envMapIntensity: 1.2,
      }),
    []
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (waterRef.current) {
      // Undulate UV-ish via position shimmer
      waterRef.current.position.y = 0.01 + Math.sin(t * 1.4) * 0.005
      // Slight color pulse for shimmer
      const pulse = 0.5 + Math.sin(t * 2.2) * 0.05
      ;(waterRef.current.material as THREE.MeshStandardMaterial).envMapIntensity = pulse + 0.9
    }
    if (foamRef.current) {
      foamRef.current.position.y = 0.025 + Math.sin(t * 1.1 + 1.0) * 0.004
    }
  })

  // Build a winding stream shape using a custom path
  const streamShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.45, -3.5)
    shape.bezierCurveTo(-0.6, -2.5, 0.5, -1.8, 0.3, -0.8)
    shape.bezierCurveTo(0.1, 0.2, -0.5, 0.8, -0.2, 1.8)
    shape.bezierCurveTo(0.1, 2.8, 0.6, 3.2, 0.4, 3.8)
    shape.lineTo(0.9, 3.8)
    shape.bezierCurveTo(1.1, 3.2, 0.6, 2.7, 0.3, 1.8)
    shape.bezierCurveTo(0.0, 0.9, 0.6, 0.3, 0.8, -0.8)
    shape.bezierCurveTo(1.0, -1.8, -0.1, -2.5, 0.0, -3.5)
    shape.closePath()
    return shape
  }, [])

  const streamGeo = useMemo(
    () =>
      new THREE.ShapeGeometry(streamShape, 32),
    [streamShape]
  )

  // Bed / channel
  const bedShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.6, -3.6)
    s.bezierCurveTo(-0.75, -2.5, 0.65, -1.8, 0.45, -0.8)
    s.bezierCurveTo(0.2, 0.2, -0.7, 0.8, -0.4, 1.8)
    s.bezierCurveTo(-0.1, 2.8, 0.5, 3.2, 0.25, 3.9)
    s.lineTo(1.1, 3.9)
    s.bezierCurveTo(1.3, 3.2, 0.8, 2.7, 0.5, 1.8)
    s.bezierCurveTo(0.2, 0.9, 0.85, 0.3, 1.05, -0.8)
    s.bezierCurveTo(1.25, -1.8, 0.15, -2.5, 0.15, -3.6)
    s.closePath()
    return s
  }, [])

  const bedGeo = useMemo(() => new THREE.ShapeGeometry(bedShape, 32), [bedShape])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[1.8, 0.01, 0]}>
      {/* Sandy stream bed */}
      <mesh receiveShadow geometry={bedGeo} position={[0, 0, -0.015]}>
        <meshStandardMaterial color="#C8B88A" roughness={0.98} metalness={0} />
      </mesh>

      {/* Water surface */}
      <mesh ref={waterRef} geometry={streamGeo} receiveShadow material={waterMat} />

      {/* Foam / highlight strip */}
      <mesh ref={foamRef} receiveShadow position={[0.05, 0, 0.02]}>
        <ShapeGeometryFoam />
        <meshStandardMaterial color="#DEEEF5" roughness={0.1} metalness={0} transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

function ShapeGeometryFoam() {
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.18, -2.8)
    s.bezierCurveTo(-0.25, -1.8, 0.2, -1.2, 0.12, -0.4)
    s.bezierCurveTo(0.04, 0.4, -0.2, 0.9, -0.08, 1.6)
    s.lineTo(0.12, 1.6)
    s.bezierCurveTo(0.0, 0.9, 0.24, 0.4, 0.32, -0.4)
    s.bezierCurveTo(0.4, -1.2, -0.05, -1.8, 0.02, -2.8)
    s.closePath()
    return new THREE.ShapeGeometry(s, 24)
  }, [])
  return <primitive object={geo} />
}
