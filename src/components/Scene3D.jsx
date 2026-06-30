import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function FloatingParticles({ count = 200 }) {
  const mesh = useRef()
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    return pos
  }, [count])

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = state.clock.elapsedTime * 0.02
      mesh.current.rotation.x = state.clock.elapsedTime * 0.01
    }
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#00ff88" transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

function GlowingSphere() {
  const mesh = useRef()

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * 0.1
      mesh.current.rotation.y = state.clock.elapsedTime * 0.15
    }
  })

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={mesh} scale={2.2}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={0.15}
          roughness={0.4}
          metalness={0.8}
          wireframe
          distort={0.25}
          speed={2}
        />
      </mesh>
    </Float>
  )
}

function GlowRing() {
  const mesh = useRef()

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.z = state.clock.elapsedTime * 0.2
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.3
    }
  })

  return (
    <mesh ref={mesh} scale={3.5}>
      <torusGeometry args={[1, 0.01, 16, 100]} />
      <meshBasicMaterial color="#00ff88" transparent opacity={0.3} />
    </mesh>
  )
}

export default function Scene3D() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} color="#00ff88" />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#00cc6a" />
        <GlowingSphere />
        <GlowRing />
        <FloatingParticles />
      </Canvas>
    </div>
  )
}
