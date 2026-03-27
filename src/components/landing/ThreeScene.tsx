import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function ThreeScene() {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x04060f, 10, 65)

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 0, 15)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const root = new THREE.Group()
    scene.add(root)

    const pointsMaterial = new THREE.PointsMaterial({ color: 0x53a7ff, size: 0.045 })
    const pointGeometry = new THREE.BufferGeometry()

    const nodes: number[] = []
    for (let i = 0; i < 380; i += 1) {
      nodes.push((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10)
    }

    pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodes, 3))
    const cloud = new THREE.Points(pointGeometry, pointsMaterial)
    root.add(cloud)

    const edges: number[] = []
    for (let i = 0; i < 120; i += 1) {
      const a = i * 3
      const b = (i * 9) % (nodes.length - 3)
      edges.push(nodes[a], nodes[a + 1], nodes[a + 2], nodes[b], nodes[b + 1], nodes[b + 2])
    }

    const edgeGeometry = new THREE.BufferGeometry()
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3))
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x6a4fff, transparent: true, opacity: 0.35 })
    const edgeMesh = new THREE.LineSegments(edgeGeometry, edgeMaterial)
    root.add(edgeMesh)

    const blocks = new THREE.Group()
    const blockGeo = new THREE.BoxGeometry(0.45, 0.2, 0.2)
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x2b5cff, emissive: 0x112244, roughness: 0.2 })
    for (let i = 0; i < 35; i += 1) {
      const mesh = new THREE.Mesh(blockGeo, blockMat)
      mesh.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8)
      mesh.rotation.set(Math.random(), Math.random(), Math.random())
      blocks.add(mesh)
    }
    root.add(blocks)

    const keyLight = new THREE.PointLight(0x66bbff, 2.5, 45)
    keyLight.position.set(4, 6, 7)
    scene.add(keyLight)

    const rimLight = new THREE.PointLight(0x8f5dff, 1.7, 40)
    rimLight.position.set(-7, -4, 5)
    scene.add(rimLight)

    let frame = 0
    const tick = () => {
      frame += 0.004
      cloud.rotation.y += 0.0015
      edgeMesh.rotation.y += 0.0011
      blocks.children.forEach((child, index) => {
        child.position.y += Math.sin(frame + index * 0.35) * 0.002
        child.rotation.z += 0.002
      })

      renderer.render(scene, camera)
      raf = window.requestAnimationFrame(tick)
    }

    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }

    let raf = window.requestAnimationFrame(tick)
    window.addEventListener('resize', onResize)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      mount.removeChild(renderer.domElement)
      pointGeometry.dispose()
      pointsMaterial.dispose()
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      blockGeo.dispose()
      blockMat.dispose()
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />
}
