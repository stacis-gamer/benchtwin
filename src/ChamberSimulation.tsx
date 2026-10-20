/// <reference types="@react-three/fiber" />
import { useGesture, type Gesture } from './useGesture'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Edges } from '@react-three/drei'
import * as THREE from 'three'

export type Mode = 'transporting' | 'soldering'

// ---------- Scene constants ----------
const L1 = 2.2
const L2 = 2.2
const TOOL = 0.5 // wrist -> tool tip distance
const BASE = new THREE.Vector3(0, 0, -2.6)
const SHOULDER_Y = 0.7
const PICK = new THREE.Vector3(-2.3, 0.22, 0.6)
const PLACE = new THREE.Vector3(-0.5, 0.2, -0.2)
const SOLDER = new THREE.Vector3(0.9, 0.22, 0.2)

// ---------- Motherboard ----------
function Chip({
  position, size = [0.6, 0.6], pins = 6,
}: { position: [number, number, number]; size?: [number, number]; pins?: number }) {
  const [w, d] = size
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[w, 0.08, d]} />
        <meshStandardMaterial color="#111318" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-w / 2 + 0.08, 0.085, -d / 2 + 0.08]}>
        <cylinderGeometry args={[0.025, 0.025, 0.01, 12]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {Array.from({ length: pins }).flatMap((_, i) =>
        [-1, 1].map((side) => (
          <mesh key={`${i}-${side}`} position={[side * (w / 2 + 0.04), 0.02, -d / 2 + (d * (i + 0.5)) / pins]}>
            <boxGeometry args={[0.08, 0.03, 0.04]} />
            <meshStandardMaterial color="#c0c4cc" metalness={1} roughness={0.3} />
          </mesh>
        )),
      )}
    </group>
  )
}

function Pad({ position, glow }: { position: [number, number, number]; glow: boolean }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.045, 0.045, 0.02, 16]} />
      <meshStandardMaterial
        color="#d4af37" metalness={1} roughness={0.25}
        emissive={glow ? '#ff5a00' : '#000000'} emissiveIntensity={glow ? 1.6 : 0}
      />
    </mesh>
  )
}

function Motherboard({ heating }: { heating: boolean }) {
  return (
    <group>
      {/* PCB */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.2, 0.1, 2.4]} />
        <meshStandardMaterial color="#0b6b3a" roughness={0.55} metalness={0.1} />
      </mesh>
      {/* Traces */}
      {[-0.9, -0.3, 0.5, 1.1].map((z, i) => (
        <mesh key={i} position={[0, 0.101, z]}>
          <boxGeometry args={[3.0, 0.002, 0.015]} />
          <meshStandardMaterial color="#1fa35c" roughness={0.4} />
        </mesh>
      ))}
      {/* Chips */}
      <Chip position={[-0.9, 0.1, 0.8]} size={[0.7, 0.7]} pins={8} />
      <Chip position={[0.5, 0.1, -0.8]} size={[0.9, 0.5]} pins={7} />
      <Chip position={[1.2, 0.1, 0.85]} size={[0.35, 0.35]} pins={3} />
      {/* Solder target pads (glow while reflowing) */}
      {Array.from({ length: 8 }).flatMap((_, i) =>
        [-0.1, 0.1].map((dz) => (
          <Pad key={`s${i}${dz}`} glow={heating}
            position={[SOLDER.x + (i - 3.5) * 0.12, 0.11, SOLDER.z + dz]} />
        )),
      )}
      {/* Placement footprint */}
      {[-1, 1].flatMap((side) =>
        [0, 1, 2].map((i) => (
          <Pad key={`p${side}${i}`} glow={heating}
            position={[PLACE.x + side * 0.19, 0.11, PLACE.z + (i - 1) * 0.1]} />
        )),
      )}
      {/* Chip placed on footprint once soldering */}
      {heating && <Chip position={[PLACE.x, 0.1, PLACE.z]} size={[0.3, 0.3]} pins={3} />}
      {/* Feed tray */}
      <mesh position={[PICK.x, 0.03, PICK.z]} receiveShadow>
        <boxGeometry args={[0.9, 0.06, 0.9]} />
        <meshStandardMaterial color="#2a2f3a" metalness={0.6} roughness={0.4} />
      </mesh>
      <Chip position={[PICK.x - 0.2, 0.06, PICK.z + 0.25]} size={[0.25, 0.25]} pins={3} />
      <Chip position={[PICK.x + 0.25, 0.06, PICK.z - 0.2]} size={[0.25, 0.25]} pins={3} />
    </group>
  )
}

// ---------- Bionic Arm (2-link IK, tool always points down) ----------
function BionicArm({ mode, knobRef }: { mode: Mode; knobRef: MutableRefObject<number> }) {
  const yaw = useRef<THREE.Group>(null)
  const shoulder = useRef<THREE.Group>(null)
  const elbow = useRef<THREE.Group>(null)
  const wrist = useRef<THREE.Group>(null)
  const toolMat = useRef<THREE.MeshStandardMaterial>(null)
  const glow = useRef<THREE.PointLight>(null)
  const carried = useRef<THREE.Mesh>(null)

  const target = useRef(PICK.clone())
  const heat = useRef(0)
  const vib = useRef(0)
  const desired = useMemo(() => new THREE.Vector3(), [])
  const aim = useMemo(() => new THREE.Vector3(), [])
  const cold = useMemo(() => new THREE.Color('#9aa4b2'), [])
  const hot = useMemo(() => new THREE.Color('#ff2200'), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const soldering = mode === 'soldering'

    // 1) Desired tip position per mode
    if (soldering) {
      desired.copy(SOLDER)
      desired.x += ((knobRef.current - 512) / 512) * 0.35 // knob = micro-precision slide along pad row
    } else {
      const cyc = (t * 0.3) % 1
      const tri = cyc < 0.5 ? cyc * 2 : 1 - (cyc - 0.5) * 2
      const s = tri * tri * (3 - 2 * tri) // smoothstep pick -> place -> pick
      desired.lerpVectors(PICK, PLACE, s)
      desired.y += Math.sin(s * Math.PI) * 1.3 // broad sweeping arc
      desired.z += Math.sin(s * Math.PI) * 0.5
    }

    // 2) Smooth toward desired
    target.current.lerp(desired, 1 - Math.exp(-dt * (soldering ? 3 : 7)))

    // 3) Micro-vibrations only in soldering
    vib.current += ((soldering ? 1 : 0) - vib.current) * (1 - Math.exp(-dt * 3))
    const v = vib.current
    aim.copy(target.current)
    aim.x += (Math.sin(t * 83) * 0.004 + Math.sin(t * 131 + 1) * 0.003 + Math.sin(t * 1.3) * 0.01) * v
    aim.y += Math.sin(t * 97 + 2) * 0.003 * v
    aim.z += Math.sin(t * 71 + 4) * 0.004 * v

    // 4) Inverse kinematics (wrist target = tip + TOOL above)
    const dx = aim.x - BASE.x
    const dz = aim.z - BASE.z
    const r = Math.hypot(dx, dz)
    const h = aim.y + TOOL - SHOULDER_Y
    const d = THREE.MathUtils.clamp(Math.hypot(r, h), 0.5, L1 + L2 - 0.01)
    const A = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1))
    const E = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1))
    const a1 = Math.atan2(h, r) + A
    const a2 = a1 - (Math.PI - E)

    if (yaw.current) yaw.current.rotation.y = Math.atan2(dx, dz)
    if (shoulder.current) shoulder.current.rotation.x = -a1
    if (elbow.current) elbow.current.rotation.x = Math.PI - E
    if (wrist.current) wrist.current.rotation.x = Math.PI / 2 + a2

    // 5) Tool head heat glow
    heat.current += ((soldering ? 1 : 0) - heat.current) * (1 - Math.exp(-dt * 2.5))
    if (toolMat.current) {
      toolMat.current.color.copy(cold).lerp(hot, heat.current)
      toolMat.current.emissive.set('#ff1500')
      toolMat.current.emissiveIntensity = heat.current * (1.6 + 0.6 * Math.sin(t * 18))
    }
    if (glow.current) glow.current.intensity = heat.current * 2.5
    if (carried.current) carried.current.visible = !soldering
  })

  const metal = <meshStandardMaterial color="#c9ced6" metalness={0.9} roughness={0.25} />
  const dark = <meshStandardMaterial color="#1c212b" metalness={0.8} roughness={0.35} />

  return (
    <group position={[BASE.x, BASE.y, BASE.z]}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.7, 0.3, 32]} />
        {dark}
      </mesh>
      <group ref={yaw} position={[0, SHOULDER_Y, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.4, 0.6, 24]} />
          {metal}
        </mesh>
        <mesh><sphereGeometry args={[0.24, 24, 24]} />{dark}</mesh>
        <group ref={shoulder}>
          <mesh position={[0, 0, L1 / 2]} castShadow>
            <boxGeometry args={[0.28, 0.28, L1]} />
            {metal}
          </mesh>
          <group ref={elbow} position={[0, 0, L1]}>
            <mesh><sphereGeometry args={[0.2, 24, 24]} />{dark}</mesh>
            <mesh position={[0, 0, L2 / 2]} castShadow>
              <boxGeometry args={[0.2, 0.2, L2]} />
              {metal}
            </mesh>
            <group ref={wrist} position={[0, 0, L2]}>
              <mesh><sphereGeometry args={[0.15, 20, 20]} />{dark}</mesh>
              {/* holder */}
              <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.24, 16]} />
                {dark}
              </mesh>
              {/* tool head (cone, tip toward +z = down) */}
              <mesh position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.07, 0.3, 24]} />
                <meshStandardMaterial ref={toolMat} color="#9aa4b2" metalness={0.8} roughness={0.3} />
              </mesh>
              <pointLight ref={glow} position={[0, 0, 0.55]} color="#ff3300" intensity={0} distance={2} />
              {/* carried chip */}
              <mesh ref={carried} position={[0, 0, 0.56]} castShadow>
                <boxGeometry args={[0.3, 0.3, 0.08]} />
                <meshStandardMaterial color="#111318" metalness={0.3} roughness={0.4} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// ---------- Chamber ----------
function Chamber() {
  return (
    <group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[7.4, 0.2, 6.4]} />
        <meshStandardMaterial color="#12161f" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.6, -0.1]}>
        <boxGeometry args={[7, 3.2, 6]} />
        <meshPhysicalMaterial
          color="#7fe9ff" transparent opacity={0.06} roughness={0}
          side={THREE.DoubleSide} depthWrite={false}
        />
        <Edges color="#5eead4" />
      </mesh>
    </group>
  )
}

function Scene({ mode, knobRef }: { mode: Mode; knobRef: MutableRefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 7, 3]} intensity={1.1} castShadow />
      <Environment preset="city" />
      <Chamber />
      <Motherboard heating={mode === 'soldering'} />
      <BionicArm mode={mode} knobRef={knobRef} />
      <ContactShadows position={[0, 0.005, 0]} opacity={0.6} scale={12} blur={2.4} far={3} />
      <OrbitControls makeDefault target={[0, 0.8, -0.3]} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}

// ---------- HUD ----------
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 18,
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  color: '#e8f1ff',
  padding: 18,
  pointerEvents: 'auto',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

const btn = (active: boolean, accent: string): React.CSSProperties => ({
  display: 'block', width: '100%', marginTop: 8, padding: '10px 14px',
  borderRadius: 12, cursor: 'pointer', fontSize: 13, letterSpacing: 1,
  color: '#fff', textAlign: 'left',
  background: active ? accent : 'rgba(255,255,255,0.06)',
  border: `1px solid ${active ? accent : 'rgba(255,255,255,0.2)'}`,
  boxShadow: active ? `0 0 18px ${accent}` : 'none',
})

export default function ChamberSimulation() {
  const [mode, setMode] = useState<Mode>('transporting')
  const [temp, setTemp] = useState(32)
  const [knob, setKnob] = useState(512)
  const knobRef = useRef(knob)
  knobRef.current = knob
    const [gesture, setGesture] = useState<Gesture>('none')
  const { videoRef, status, error, start, stop } = useGesture({
    onGesture: (g) => {
      setGesture(g)
      if (g === 'fist') setMode('soldering')
      if (g === 'open') setMode('transporting')
    },
    onKnob: (v) => setKnob(v),
  })
  const camOn = status === 'on'

  // Simulated pyrometer (replace with serial data later)
  useEffect(() => {
    const id = setInterval(() => {
      setTemp((p) => p + ((mode === 'soldering' ? 245 : 32) - p) * 0.04 + (Math.random() - 0.5) * 0.6)
    }, 100)
    return () => clearInterval(id)
  }, [mode])

  const hotColor = temp > 180 ? '#ff4d3a' : temp > 80 ? '#ffb020' : '#5eead4'

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh',
      background: 'radial-gradient(circle at 50% 30%, #121a2b, #05070d)' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [6, 4.5, 7], fov: 40 }}>
        <Scene mode={mode} knobRef={knobRef} />
      </Canvas>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Mode panel */}
        <div style={{ ...glass, position: 'absolute', top: 20, left: 20, width: 250 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>AEROREFLOW</div>
          <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 10 }}>HERMETIC μ-SOLDERING CHAMBER</div>
          <button style={btn(mode === 'transporting', '#2f7bff')} onClick={() => setMode('transporting')}>
            ▶ TRANSPORTING · PICK &amp; PLACE
          </button>
          <button style={btn(mode === 'soldering', '#ff3b2f')} onClick={() => setMode('soldering')}>
            ▶ SOLDERING · REFLOW
          </button>
        </div>
                {/* Gesture camera */}
        <div style={{ ...glass, position: 'absolute', bottom: 20, left: 20, width: 250 }}>
          <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 8 }}>TOUCHLESS GESTURE CONTROL</div>
          <div style={{
            position: 'relative', borderRadius: 12, overflow: 'hidden',
            background: '#000', height: camOn ? 160 : 0, transition: 'height .3s',
          }}>
            <video ref={videoRef} playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            <div style={{
              position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 8, fontSize: 11,
              background: 'rgba(0,0,0,.55)', color: gesture === 'fist' ? '#ff6b5e' : gesture === 'open' ? '#6cb2ff' : '#aaa',
            }}>
              {gesture === 'fist' ? '✊ FIST → SOLDER' : gesture === 'open' ? '🖐 PALM → TRANSPORT' : 'NO HAND'}
            </div>
          </div>
          <button
            style={btn(camOn, '#22c55e')}
            onClick={camOn ? stop : start}
          >
            {status === 'loading' ? '… LOADING MODEL' : camOn ? '■ DISABLE CAMERA' : '● ENABLE CAMERA'}
          </button>
          {status === 'error' && <div style={{ color: '#ff6b5e', fontSize: 11, marginTop: 6 }}>{error}</div>}
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 8, lineHeight: 1.5 }}>
            🖐 open palm = transport<br />✊ fist = solder<br />↔ move hand = micro-dial
          </div>
        </div>

        {/* Telemetry */}
        <div style={{ ...glass, position: 'absolute', top: 20, right: 20, width: 240 }}>
          <div style={{ fontSize: 10, opacity: 0.6 }}>CHAMBER PYROMETER</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: hotColor, textShadow: `0 0 16px ${hotColor}` }}>
            {temp.toFixed(1)}<span style={{ fontSize: 18 }}> °C</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', marginTop: 6 }}>
            <div style={{
              height: '100%', borderRadius: 3, background: hotColor,
              width: `${Math.min(100, (temp / 260) * 100)}%`, transition: 'width 0.1s',
            }} />
          </div>
          <div style={{ fontSize: 11, marginTop: 10, opacity: 0.8 }}>
            STATE: {mode === 'soldering' ? 'REFLOW ACTIVE' : 'COOL / TRANSIT'}
          </div>
        </div>

        {/* Micro-dial (simulated potentiometer) */}
        <div style={{ ...glass, position: 'absolute', bottom: 20, left: '50%',
          transform: 'translateX(-50%)', width: 340 }}>
          <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 6 }}>
            MICRO-DIAL {camOn ? '(HAND TRACKING)' : '(MANUAL)'} · {knob} / 1023
          </div>
          <input type="range" min={0} max={1023} value={knob}
            onChange={(e) => setKnob(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  )
}