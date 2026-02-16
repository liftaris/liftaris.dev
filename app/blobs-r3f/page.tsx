'use client'

import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  type SimulationState,
  createSimulation,
  resetScene,
  updatePhysics,
  type BlobEntity,
} from '../../lib/blob-physics'

const BACKGROUND_COLOR = '#121317'

/**
 * Build a THREE.Shape from blob particles using the same
 * Catmull-Rom spline logic as the Canvas 2D version.
 *
 * The physics simulation uses screen coordinates (y-down), but Three.js
 * uses y-up. We flip y here by negating it, and the camera is set up with
 * top=0, bottom=-height so that screen-space (0,0) = top-left maps correctly.
 */
function buildBlobShape(blob: BlobEntity, viewportHeight: number): THREE.Shape {
  const points = blob.particles
  const n = points.length
  const shape = new THREE.Shape()

  // Flip y: screen y-down -> Three.js y-up
  shape.moveTo(points[0].x, viewportHeight - points[0].y)

  for (let i = 0; i < n; i++) {
    const p0 = points[(i + n - 1) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = viewportHeight - (p1.y + (p2.y - p0.y) / 6)
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = viewportHeight - (p2.y - (p3.y - p1.y) / 6)

    shape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, viewportHeight - p2.y)
  }

  shape.closePath()
  return shape
}

/**
 * Core scene component that manages the entire simulation imperatively.
 *
 * Instead of mapping sim.blobs to React elements (which would require
 * re-renders when the scene resets), we manage Three.js objects directly
 * via a group ref. This mirrors how the original Canvas 2D version works:
 * a single imperative loop that updates physics and draws every frame.
 */
function BlobSimulation({ sim }: { sim: SimulationState }) {
  const { camera, size, gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const meshesRef = useRef<THREE.Mesh[]>([])
  const geometriesRef = useRef<THREE.ShapeGeometry[]>([])
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([])
  const sizeRef = useRef({ width: 0, height: 0 })

  // Rebuild the scene (create/destroy meshes) when the viewport changes
  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    // Configure camera for pixel-space coordinates
    // left=0, right=width maps x to screen pixels
    // top=height, bottom=0: standard Three.js y-up orientation
    // The y-flip from screen coords is handled in buildBlobShape
    const cam = camera as THREE.OrthographicCamera
    cam.left = 0
    cam.right = size.width
    cam.top = size.height
    cam.bottom = 0
    cam.near = -10
    cam.far = 10
    cam.position.set(0, 0, 5)
    cam.updateProjectionMatrix()

    sizeRef.current = { width: size.width, height: size.height }

    // Guard against zero-size on initial mount before layout completes
    if (size.width === 0 || size.height === 0) return

    // Reset the physics simulation for the new viewport size
    resetScene(sim, size.width, size.height)

    // Clean up old meshes
    for (const mesh of meshesRef.current) {
      group.remove(mesh)
    }
    for (const geom of geometriesRef.current) {
      geom.dispose()
    }
    for (const mat of materialsRef.current) {
      mat.dispose()
    }

    // Create new meshes for each blob
    const newMeshes: THREE.Mesh[] = []
    const newGeometries: THREE.ShapeGeometry[] = []
    const newMaterials: THREE.MeshBasicMaterial[] = []

    for (let i = 0; i < sim.blobs.length; i++) {
      const blob = sim.blobs[i]
      const shape = buildBlobShape(blob, size.height)
      const geometry = new THREE.ShapeGeometry(shape, 4)
      const material = new THREE.MeshBasicMaterial({ color: blob.color })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.z = i * 0.001

      newMeshes.push(mesh)
      newGeometries.push(geometry)
      newMaterials.push(material)
      group.add(mesh)
    }

    meshesRef.current = newMeshes
    geometriesRef.current = newGeometries
    materialsRef.current = newMaterials

    return () => {
      for (const mesh of newMeshes) {
        group.remove(mesh)
      }
      for (const geom of newGeometries) {
        geom.dispose()
      }
      for (const mat of newMaterials) {
        mat.dispose()
      }
    }
  }, [camera, size, sim])

  // Physics + geometry update every frame
  useFrame(() => {
    if (sim.blobs.length === 0) return

    updatePhysics(sim)

    for (let i = 0; i < sim.blobs.length; i++) {
      const mesh = meshesRef.current[i]
      if (!mesh) continue

      const blob = sim.blobs[i]
      const shape = buildBlobShape(blob, sim.height)
      const newGeom = new THREE.ShapeGeometry(shape, 4)

      // Dispose old geometry and swap in new one
      if (geometriesRef.current[i]) {
        geometriesRef.current[i].dispose()
      }
      geometriesRef.current[i] = newGeom
      mesh.geometry = newGeom
    }
  })

  return <group ref={groupRef} />
}

/**
 * Handles pointer input by listening to DOM events on the canvas element.
 *
 * Using DOM events directly (rather than R3F's mesh pointer events) because:
 * 1. The original implementation uses DOM pointer events
 * 2. No need to raycast against an invisible plane
 * 3. Simpler handling of touch vs mouse pointer-up behavior
 * 4. More reliable edge cases (pointer leaving the window, etc.)
 */
function PointerHandler({ sim }: { sim: SimulationState }) {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      sim.pointer.x = e.clientX - rect.left
      sim.pointer.y = e.clientY - rect.top
      sim.pointer.active = true
    }

    const handlePointerLeave = () => {
      sim.pointer.active = false
    }

    const handlePointerUp = (e: PointerEvent) => {
      // Match original: touch releases deactivate pointer, mouse doesn't
      if (e.pointerType !== 'mouse') {
        handlePointerLeave()
      }
    }

    canvas.addEventListener('pointerdown', handlePointer)
    canvas.addEventListener('pointermove', handlePointer)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('pointercancel', handlePointerLeave)
    canvas.addEventListener('pointerup', handlePointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointer)
      canvas.removeEventListener('pointermove', handlePointer)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('pointercancel', handlePointerLeave)
      canvas.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl, sim])

  return null
}

function Scene({ sim }: { sim: SimulationState }) {
  return (
    <>
      <PointerHandler sim={sim} />
      <BlobSimulation sim={sim} />
    </>
  )
}

export default function BlobsR3FPage() {
  const sim = useRef(createSimulation()).current

  useEffect(() => {
    // Override body styles for fullscreen dark background
    const prev = {
      bodyPadding: document.body.style.padding,
      bodyMargin: document.body.style.margin,
      bodyHeight: document.body.style.height,
      bodyMinHeight: document.body.style.minHeight,
      bodyOverflow: document.body.style.overflow,
      bodyBackground: document.body.style.background,
      htmlMargin: document.documentElement.style.margin,
      htmlPadding: document.documentElement.style.padding,
      htmlHeight: document.documentElement.style.height,
      htmlMinHeight: document.documentElement.style.minHeight,
    }

    document.body.style.overflow = 'hidden'
    document.body.style.padding = '0'
    document.body.style.margin = '0'
    document.body.style.height = '100%'
    document.body.style.minHeight = '100%'
    document.body.style.background = BACKGROUND_COLOR
    document.documentElement.style.margin = '0'
    document.documentElement.style.padding = '0'
    document.documentElement.style.height = '100%'
    document.documentElement.style.minHeight = '100%'

    return () => {
      document.body.style.padding = prev.bodyPadding
      document.body.style.margin = prev.bodyMargin
      document.body.style.height = prev.bodyHeight
      document.body.style.minHeight = prev.bodyMinHeight
      document.body.style.overflow = prev.bodyOverflow
      document.body.style.background = prev.bodyBackground
      document.documentElement.style.margin = prev.htmlMargin
      document.documentElement.style.padding = prev.htmlPadding
      document.documentElement.style.height = prev.htmlHeight
      document.documentElement.style.minHeight = prev.htmlMinHeight
    }
  }, [])

  return (
    <Canvas
      orthographic
      camera={{
        position: [0, 0, 5],
        near: -10,
        far: 10,
        zoom: 1,
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      dpr={[1, 1]}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'block',
        touchAction: 'none',
        background: BACKGROUND_COLOR,
        zIndex: 9999,
      }}
      flat
    >
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <Scene sim={sim} />
    </Canvas>
  )
}
