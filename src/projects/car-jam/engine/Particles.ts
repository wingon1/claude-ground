/* ===========================================================================
 * Particles.ts — a tiny pooled puff system for exhaust + clear bursts.
 * No textures: each particle is a low-poly sphere that rises, expands and
 * fades, then returns to the pool.
 * ========================================================================= */

import * as THREE from 'three'

type Puff = {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  life: number
  ttl: number
  baseScale: number
  active: boolean
}

const geo = new THREE.SphereGeometry(0.12, 8, 6)

export class Particles {
  private pool: Puff[] = []
  private group = new THREE.Group()

  constructor(scene: THREE.Scene) {
    scene.add(this.group)
  }

  private obtain(): Puff {
    let p = this.pool.find((q) => !q.active)
    if (!p) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xcfd3d8,
        transparent: true,
        opacity: 0.8,
        roughness: 1,
        metalness: 0,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      this.group.add(mesh)
      p = { mesh, vel: new THREE.Vector3(), life: 0, ttl: 1, baseScale: 1, active: false }
      this.pool.push(p)
    }
    return p
  }

  /** A small grey exhaust puff at a world position. */
  exhaust(pos: THREE.Vector3) {
    const p = this.obtain()
    p.mesh.position.copy(pos)
    p.vel.set((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4)
    p.life = 0
    p.ttl = 0.6 + Math.random() * 0.3
    p.baseScale = 0.5 + Math.random() * 0.5
    ;(p.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xc8ccd2)
    p.mesh.visible = true
    p.active = true
  }

  /** A colourful celebratory pop at a world position. */
  burst(pos: THREE.Vector3, color: number) {
    for (let i = 0; i < 5; i++) {
      const p = this.obtain()
      p.mesh.position.copy(pos)
      const ang = Math.random() * Math.PI * 2
      const sp = 1.5 + Math.random() * 2
      p.vel.set(Math.cos(ang) * sp, 1 + Math.random() * 2.5, Math.sin(ang) * sp)
      p.life = 0
      p.ttl = 0.7 + Math.random() * 0.4
      p.baseScale = 0.6 + Math.random() * 0.6
      ;(p.mesh.material as THREE.MeshStandardMaterial).color.setHex(color)
      p.mesh.visible = true
      p.active = true
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue
      p.life += dt
      const t = p.life / p.ttl
      if (t >= 1) {
        p.active = false
        p.mesh.visible = false
        continue
      }
      p.vel.y -= 1.5 * dt // mild gravity for bursts; puffs drift up
      p.mesh.position.addScaledVector(p.vel, dt)
      const s = p.baseScale * (0.4 + t * 1.3)
      p.mesh.scale.setScalar(s)
      ;(p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.8 * (1 - t)
    }
  }
}
