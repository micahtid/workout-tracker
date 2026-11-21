/**
 * Rest-over chime. Generated as a tiny WAV at runtime (no asset to download)
 * and played through an <audio> element.
 *
 * Other apps' audio (Spotify, etc.): a web page can't pause or control other
 * apps. On iOS Safari 16.4+ we set the audio session to "transient", which
 * asks the system to *duck* (lower) other audio while the chime plays and
 * restore it afterwards. Elsewhere the chime mixes over your music.
 */

const RATE = 22050

function synthChime(): Blob {
  // Three soft rising "dings" — clear over music without being harsh.
  const notes = [
    { f: 880, at: 0 },
    { f: 1175, at: 0.18 },
    { f: 1568, at: 0.36 },
  ]
  const dur = 1.3
  const n = Math.floor(RATE * dur)
  const pcm = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    let v = 0
    for (const { f, at } of notes) {
      const dt = t - at
      if (dt < 0) continue
      const attack = Math.min(dt / 0.005, 1)
      const env = attack * Math.exp(-dt * 5)
      // Fundamental plus a quiet octave for a bell-like tone.
      v += env * (Math.sin(2 * Math.PI * f * dt) + 0.25 * Math.sin(4 * Math.PI * f * dt))
    }
    pcm[i] = Math.max(-1, Math.min(1, v * 0.35)) * 0x7fff
  }

  const buf = new ArrayBuffer(44 + pcm.byteLength)
  const dv = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); dv.setUint32(4, 36 + pcm.byteLength, true); str(8, 'WAVE')
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  str(36, 'data'); dv.setUint32(40, pcm.byteLength, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}

let audio: HTMLAudioElement | null = null
let unlocked = false

function setAudioSession() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'transient'
  } catch {}
}

/** Call from a tap (e.g. starting the timer) so mobile browsers allow playback later. */
export function primeChime() {
  if (!audio) {
    audio = new Audio(URL.createObjectURL(synthChime()))
    audio.preload = 'auto'
  }
  setAudioSession()
  if (unlocked) return
  audio.muted = true
  audio
    .play()
    .then(() => {
      audio!.pause()
      audio!.currentTime = 0
      audio!.muted = false
      unlocked = true
    })
    .catch(() => { if (audio) audio.muted = false })
}

export function playChime() {
  if (!audio) return
  setAudioSession()
  audio.muted = false
  audio.currentTime = 0
  audio.play().catch(() => {})
}
