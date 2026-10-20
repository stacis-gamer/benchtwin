import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export type Gesture = 'open' | 'fist' | 'none'
export type CamStatus = 'off' | 'loading' | 'on' | 'error'

interface Opts {
  onGesture: (g: Gesture) => void
  onKnob: (value0to1023: number) => void
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

function classify(lm: { x: number; y: number }[]): Gesture {
  const wrist = lm[0]
  const tips = [8, 12, 16, 20]
  const pips = [6, 10, 14, 18]
  const extended = tips.filter((t, i) => dist(lm[t], wrist) > dist(lm[pips[i]], wrist) * 1.1).length
  if (extended >= 4) return 'open'
  if (extended <= 1) return 'fist'
  return 'none'
}

export function useGesture({ onGesture, onKnob }: Opts) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<CamStatus>('off')
  const [error, setError] = useState('')

  const cb = useRef({ onGesture, onKnob })
  cb.current = { onGesture, onKnob }

  const landmarker = useRef<HandLandmarker | null>(null)
  const raf = useRef(0)
  const stream = useRef<MediaStream | null>(null)
  const lastTime = useRef(-1)
  const pending = useRef<Gesture>('none')
  const streak = useRef(0)
  const stable = useRef<Gesture>('none')
  const lastKnob = useRef(-100)

  const loop = useCallback(() => {
    const video = videoRef.current
    const lm = landmarker.current
    if (video && lm && video.readyState >= 2 && video.currentTime !== lastTime.current) {
      lastTime.current = video.currentTime
      const res = lm.detectForVideo(video, performance.now())
      const hand = res.landmarks[0]
      if (hand) {
        // Debounce: need 4 identical frames before switching mode
        const g = classify(hand)
        if (g !== 'none') {
          if (g === pending.current) streak.current++
          else { pending.current = g; streak.current = 1 }
          if (streak.current >= 4 && g !== stable.current) {
            stable.current = g
            cb.current.onGesture(g)
          }
        }
        // Hand X -> knob. Video is mirrored, so flip. Crop 15%..85% to full range.
        const x = 1 - hand[9].x
        const k = Math.round(Math.min(1, Math.max(0, (x - 0.15) / 0.7)) * 1023)
        if (Math.abs(k - lastKnob.current) > 4) {
          lastKnob.current = k
          cb.current.onKnob(k)
        }
      } else if (stable.current !== 'none') {
        stable.current = 'none'
        streak.current = 0
        cb.current.onGesture('none')
      }
    }
    raf.current = requestAnimationFrame(loop)
  }, [])

  const start = useCallback(async () => {
    try {
      setStatus('loading'); setError('')
      if (!landmarker.current) {
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        )
        landmarker.current = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        })
      }
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      })
      const video = videoRef.current!
      video.srcObject = stream.current
      await video.play()
      setStatus('on')
      raf.current = requestAnimationFrame(loop)
    } catch (e) {
      setStatus('error'); setError(e instanceof Error ? e.message : String(e))
    }
  }, [loop])

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    stable.current = 'none'
    cb.current.onGesture('none')
    setStatus('off')
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(raf.current)
    stream.current?.getTracks().forEach((t) => t.stop())
  }, [])

  return { videoRef, status, error, start, stop }
}