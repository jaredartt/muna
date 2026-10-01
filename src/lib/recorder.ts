// Records the microphone and returns a small 16 kHz mono WAV (what Muna's Gemini brain can listen to).
// Works the same on iPhone Safari and desktop browsers. The recording stays in memory and is never stored.

type AC = typeof AudioContext

export class WavRecorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private chunks: Float32Array[] = []
  private startedAt = 0

  /** Must be called directly from a tap (iOS only unlocks audio inside a user gesture). */
  async start() {
    const Ctor: AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: AC }).webkitAudioContext
    this.ctx = new Ctor()
    void this.ctx.resume()
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.node = this.ctx.createScriptProcessor(4096, 1, 1)
    this.chunks = []
    this.node.onaudioprocess = (e) => {
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    }
    this.source.connect(this.node)
    this.node.connect(this.ctx.destination)
    this.startedAt = Date.now()
  }

  get seconds() {
    return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0
  }

  private cleanup() {
    this.node?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.node = null
    this.source = null
    this.stream = null
    this.ctx = null
  }

  cancel() {
    this.cleanup()
    this.chunks = []
  }

  /** Stop and return the recording as base64 WAV. */
  async stop(): Promise<{ base64: string; mime: 'audio/wav'; seconds: number }> {
    const rate = this.ctx?.sampleRate ?? 44100
    const seconds = this.seconds
    this.cleanup()
    let total = 0
    for (const c of this.chunks) total += c.length
    const all = new Float32Array(total)
    let off = 0
    for (const c of this.chunks) {
      all.set(c, off)
      off += c.length
    }
    this.chunks = []
    const pcm = downsample(all, rate, 16000)
    const wav = encodeWav(pcm, 16000)
    return { base64: await blobToBase64(wav), mime: 'audio/wav', seconds }
  }
}

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return input
  const ratio = from / to
  const len = Math.floor(input.length / ratio)
  const out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = sum / Math.max(1, end - start)
  }
  return out
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buffer)
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  write(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  write(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
