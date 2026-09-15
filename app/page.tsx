'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ImagePlus,
  Download,
  X,
  Trash2,
  Sparkles,
  Loader2,
  CircleCheck,
  CircleAlert,
  ArrowRight,
  ScanLine,
} from 'lucide-react'
import { createZipBlob } from '@/lib/zip'
import { Logo } from '@/components/Logo'

interface ImageItem {
  id: string
  file: File
  name: string
  originalWidth: number
  originalHeight: number
  originalSize: number
  previewUrl: string
  status: 'idle' | 'processing' | 'done' | 'error'
  error?: string
  outputWidth?: number
  outputHeight?: number
  outputSize?: number
  outputBlob?: Blob
  outputUrl?: string
  outputName?: string
}

type OutputFormat = 'original' | 'image/webp' | 'image/jpeg' | 'image/png'
type ResizeMode = 'none' | 'percent' | 'maxFit'

const FORMAT_OPTIONS: { id: OutputFormat; label: string; hint: string }[] = [
  { id: 'image/webp', label: 'WebP', hint: 'Best' },
  { id: 'image/jpeg', label: 'JPEG', hint: 'Wide support' },
  { id: 'image/png', label: 'PNG', hint: 'Lossless' },
  { id: 'original', label: 'Keep', hint: 'Original type' },
]

const RESIZE_OPTIONS: { id: ResizeMode; label: string }[] = [
  { id: 'none', label: 'Original' },
  { id: 'percent', label: 'Scale %' },
  { id: 'maxFit', label: 'Max fit' },
]

export default function ImageKitPage() {
  const [items, setItems] = useState<ImageItem[]>([])
  const [format, setFormat] = useState<OutputFormat>('image/webp')
  const [quality, setQuality] = useState<number>(80)
  const [resizeMode, setResizeMode] = useState<ResizeMode>('none')
  const [scalePercent, setScalePercent] = useState<number>(50)
  const [maxWidth, setMaxWidth] = useState<number>(1920)
  const [maxHeight, setMaxHeight] = useState<number>(1080)
  const [prefix, setPrefix] = useState<string>('opt_')
  const [suffix, setSuffix] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const addFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(f.type)
    )
    if (validFiles.length === 0) return

    validFiles.forEach((file) => {
      const previewUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const newItem: ImageItem = {
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
          originalSize: file.size,
          previewUrl,
          status: 'idle',
        }
        setItems((prev) => [...prev, newItem])
      }
      img.src = previewUrl
    })
  }, [])

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        addFiles(e.clipboardData.files)
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addFiles])

  const loadSampleImages = () => {
    const samples = [
      { name: 'sunset-landscape.jpg', color1: '#ff5f4d', color2: '#7c5cff', w: 1920, h: 1080 },
      { name: 'tech-dashboard-mockup.png', color1: '#2a2630', color2: '#59526a', w: 1600, h: 900 },
      { name: 'minimal-portrait.png', color1: '#1f8a5f', color2: '#7c5cff', w: 1200, h: 1200 },
    ]

    samples.forEach((s) => {
      const canvas = document.createElement('canvas')
      canvas.width = s.w
      canvas.height = s.h
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const grad = ctx.createLinearGradient(0, 0, s.w, s.h)
      grad.addColorStop(0, s.color1)
      grad.addColorStop(1, s.color2)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, s.w, s.h)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.beginPath()
      ctx.arc(s.w * 0.3, s.h * 0.4, 200, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 50px sans-serif'
      ctx.fillText(s.name, 60, s.h - 80)

      canvas.toBlob((blob) => {
        if (!blob) return
        const file = new File([blob], s.name, { type: 'image/jpeg' })
        addFiles([file])
      }, 'image/jpeg', 0.95)
    })
  }

  const getTargetDimensions = (origW: number, origH: number) => {
    if (resizeMode === 'percent') {
      const ratio = scalePercent / 100
      return {
        width: Math.max(1, Math.round(origW * ratio)),
        height: Math.max(1, Math.round(origH * ratio)),
      }
    }
    if (resizeMode === 'maxFit') {
      const scaleW = maxWidth / origW
      const scaleH = maxHeight / origH
      const scale = Math.min(scaleW, scaleH, 1)
      return {
        width: Math.max(1, Math.round(origW * scale)),
        height: Math.max(1, Math.round(origH * scale)),
      }
    }
    return { width: origW, height: origH }
  }

  const processImage = async (item: ImageItem): Promise<ImageItem> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const { width: targetW, height: targetH } = getTargetDimensions(
          img.naturalWidth,
          img.naturalHeight
        )
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve({ ...item, status: 'error', error: 'Canvas error' })
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, targetW, targetH)

        const targetMime = format === 'original' ? item.file.type || 'image/jpeg' : format
        const targetExt =
          targetMime === 'image/webp'
            ? 'webp'
            : targetMime === 'image/jpeg'
            ? 'jpg'
            : targetMime === 'image/png'
            ? 'png'
            : 'jpg'

        const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name
        const outputName = `${prefix}${baseName}${suffix}.${targetExt}`

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({ ...item, status: 'error', error: 'Encoding failed' })
              return
            }
            const outputUrl = URL.createObjectURL(blob)
            resolve({
              ...item,
              status: 'done',
              outputWidth: targetW,
              outputHeight: targetH,
              outputSize: blob.size,
              outputBlob: blob,
              outputUrl,
              outputName,
            })
          },
          targetMime,
          quality / 100
        )
      }
      img.onerror = () => {
        resolve({ ...item, status: 'error', error: 'Failed to load' })
      }
      img.src = item.previewUrl
    })
  }

  const processAll = async () => {
    if (items.length === 0 || isProcessing) return
    setIsProcessing(true)
    setProgress(0)

    // Snapshot only which items to process; apply results back by id via functional
    // updates so files added/removed elsewhere in the queue during processing aren't
    // clobbered by a stale copy of the array (previously `setItems([...updated])`
    // overwrote the whole list every iteration, silently dropping anything added
    // mid-batch).
    const targets = items
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      setItems((prev) =>
        prev.map((it) => (it.id === target.id ? { ...it, status: 'processing' } : it))
      )

      const res = await processImage(target)
      setItems((prev) => prev.map((it) => (it.id === target.id ? res : it)))
      setProgress(Math.round(((i + 1) / targets.length) * 100))
    }

    setIsProcessing(false)
  }

  const downloadItem = (item: ImageItem) => {
    if (!item.outputUrl || !item.outputName) return
    const a = document.createElement('a')
    a.href = item.outputUrl
    a.download = item.outputName
    a.click()
  }

  const downloadZip = async () => {
    const readyItems = items.filter((i) => i.status === 'done' && i.outputBlob && i.outputName)
    if (readyItems.length === 0) return

    const filesToZip: { name: string; data: Uint8Array }[] = []
    for (const it of readyItems) {
      if (it.outputBlob && it.outputName) {
        const buffer = await it.outputBlob.arrayBuffer()
        filesToZip.push({
          name: it.outputName,
          data: new Uint8Array(buffer),
        })
      }
    }

    const zipBlob = createZipBlob(filesToZip)
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `imagekit-batch-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const clearQueue = () => {
    items.forEach((it) => {
      URL.revokeObjectURL(it.previewUrl)
      if (it.outputUrl) URL.revokeObjectURL(it.outputUrl)
    })
    setItems([])
    setProgress(0)
  }

  const totalOriginalSize = items.reduce((acc, it) => acc + it.originalSize, 0)
  const processedItems = items.filter((it) => it.status === 'done' && it.outputSize)
  const totalOutputSize = processedItems.reduce((acc, it) => acc + (it.outputSize || 0), 0)
  const totalSavings = totalOriginalSize > 0 && processedItems.length === items.length
    ? Math.max(0, totalOriginalSize - totalOutputSize)
    : 0
  const savingsPercent = totalOriginalSize > 0 && processedItems.length === items.length
    ? Math.round((totalSavings / totalOriginalSize) * 100)
    : 0

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/70 px-6 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <div>
            <h1 className="flex items-center gap-2 text-[15px] font-extrabold leading-none tracking-tight">
              ImageKit
            </h1>
            <p className="mt-1 text-xs font-medium text-ink-faint">
              Batch photo lab &middot; processed on your device only
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-positive/20 bg-positive-tint px-3 py-1.5 text-xs font-semibold text-positive sm:inline-flex">
            <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
            No uploads &mdash; runs locally
          </span>
          {items.length > 0 && (
            <button
              onClick={clearQueue}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-ink-faint transition-colors hover:bg-surface-sunken hover:text-negative"
            >
              Clear queue
            </button>
          )}
          <button
            onClick={loadSampleImages}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-soft transition-colors hover:bg-surface-sunken"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Load samples
          </button>
        </div>
      </header>

      {/* Body: contact sheet + tool rail */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Contact sheet / light table */}
        <section
          className="sheet-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto p-6"
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            multiple
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            aria-label="Choose image files to add to the queue"
          />

          {items.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-1 flex-col items-center justify-center gap-4 rounded-[var(--radius-sheet)] border-2 border-dashed p-10 text-center transition-colors ${
                isDragOver
                  ? 'border-accent bg-accent-tint/40'
                  : 'border-border-strong bg-surface/60 hover:border-accent/50 hover:bg-surface'
              }`}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border-strong bg-surface shadow-soft">
                <ImagePlus className="h-7 w-7 text-accent" aria-hidden="true" />
              </span>
              <span className="max-w-sm text-base font-bold text-ink">
                Drop images on the light table
              </span>
              <span className="max-w-sm text-sm text-ink-soft">
                or click to browse &middot; paste from clipboard also works. PNG, JPEG, WebP and SVG.
              </span>
            </button>
          ) : (
            <div className="flex flex-1 flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-ink">Contact sheet</h2>
                  <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-ink-soft">
                    {items.length} {items.length === 1 ? 'frame' : 'frames'}
                  </span>
                  {processedItems.length > 0 && (
                    <span className="text-xs font-semibold text-positive">
                      {processedItems.length} of {items.length} ready
                    </span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 text-xs font-semibold text-ink shadow-soft transition-colors hover:bg-surface-sunken"
                >
                  <ImagePlus className="h-4 w-4 text-accent" aria-hidden="true" />
                  Add more
                </button>
              </div>

              <div
                className={`grid flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 rounded-[var(--radius-sheet)] p-1 transition-colors ${
                  isDragOver ? 'bg-accent-tint/30 ring-2 ring-accent/40' : ''
                }`}
              >
                {items.map((item) => {
                  const hasSavings = item.outputSize && item.outputSize < item.originalSize
                  const savings = item.outputSize
                    ? Math.round(((item.originalSize - item.outputSize) / item.originalSize) * 100)
                    : 0

                  return (
                    <div
                      key={item.id}
                      className="group relative flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-soft"
                    >
                      {/* sprocket strip, contact-sheet motif */}
                      <div className="flex shrink-0 justify-between gap-0.5 bg-ink/90 px-1.5 py-1">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-[2px] bg-bg/80" />
                        ))}
                      </div>

                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-sunken">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.outputUrl || item.previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />

                        <div className="absolute left-2 top-2">
                          {item.status === 'done' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-positive-tint px-2 py-0.5 text-[10px] font-bold text-positive">
                              <CircleCheck className="h-3 w-3" aria-hidden="true" /> Ready
                            </span>
                          )}
                          {item.status === 'processing' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-bold text-accent-ink">
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Optimizing
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-negative-tint px-2 py-0.5 text-[10px] font-bold text-negative">
                              <CircleAlert className="h-3 w-3" aria-hidden="true" /> Error
                            </span>
                          )}
                        </div>

                        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          {item.status === 'done' && (
                            <button
                              onClick={() => downloadItem(item)}
                              aria-label={`Download ${item.outputName || item.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/95 text-ink shadow-soft transition-colors hover:bg-accent hover:text-white"
                            >
                              <Download className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.name} from queue`}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/95 text-ink-soft shadow-soft transition-colors hover:bg-negative hover:text-white"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 px-3 py-2.5">
                        <p className="truncate text-xs font-semibold text-ink" title={item.name}>
                          {item.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                          <span>
                            {item.originalWidth}&times;{item.originalHeight} &middot; {formatBytes(item.originalSize)}
                          </span>
                          {item.status === 'done' && item.outputWidth && item.outputSize && (
                            <>
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                              <span className="font-semibold text-ink-soft">
                                {formatBytes(item.outputSize)}
                              </span>
                              {hasSavings ? (
                                <span className="font-bold text-positive">-{savings}%</span>
                              ) : (
                                <span className="font-bold text-negative">+{Math.abs(savings)}%</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* Tool rail */}
        <aside className="sheet-scroll flex w-full shrink-0 flex-col overflow-y-auto border-t border-border bg-surface lg:h-full lg:w-[320px] lg:border-l lg:border-t-0">
          <div className="flex flex-1 flex-col px-5 py-5">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
              Develop settings
            </h2>

            {/* Format */}
            <div className="border-b border-border py-4">
              <span className="mb-2 block text-xs font-bold text-ink-soft">Convert to</span>
              <div className="grid grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setFormat(fmt.id)}
                    aria-pressed={format === fmt.id}
                    className={`flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left transition-colors ${
                      format === fmt.id
                        ? 'border-accent bg-accent-tint text-accent-ink'
                        : 'border-border bg-surface text-ink-soft hover:border-border-strong hover:bg-surface-sunken'
                    }`}
                  >
                    <span className="text-xs font-bold">{fmt.label}</span>
                    <span className="text-[10px] opacity-80">{fmt.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div className="border-b border-border py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-ink-soft">Quality</span>
                <span className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-semibold text-ink">
                  {quality}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                aria-label="Output quality percentage"
              />
              <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
                <span>Smaller</span>
                <span>Balanced</span>
                <span>Max fidelity</span>
              </div>
            </div>

            {/* Dimensions */}
            <div className="border-b border-border py-4">
              <span className="mb-2 block text-xs font-bold text-ink-soft">Dimensions</span>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-surface-sunken p-1">
                {RESIZE_OPTIONS.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setResizeMode(mode.id)}
                    aria-pressed={resizeMode === mode.id}
                    className={`min-h-9 rounded text-[11px] font-semibold transition-colors ${
                      resizeMode === mode.id
                        ? 'bg-ink text-white shadow-soft'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {resizeMode === 'percent' && (
                <div className="pt-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-soft">Scale factor</span>
                    <span className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-semibold text-ink">
                      {scalePercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={scalePercent}
                    onChange={(e) => setScalePercent(Number(e.target.value))}
                    aria-label="Scale factor percentage"
                  />
                </div>
              )}

              {resizeMode === 'maxFit' && (
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-ink-faint">Max width</span>
                    <input
                      type="number"
                      value={maxWidth}
                      onChange={(e) => setMaxWidth(Number(e.target.value))}
                      className="h-11 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-ink outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-ink-faint">Max height</span>
                    <input
                      type="number"
                      value={maxHeight}
                      onChange={(e) => setMaxHeight(Number(e.target.value))}
                      className="h-11 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-ink outline-none focus:border-accent"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Renaming */}
            <div className="border-b border-border py-4">
              <span className="mb-2 block text-xs font-bold text-ink-soft">Rename pattern</span>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-ink-faint">Prefix</span>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="opt_"
                    className="h-11 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-ink-faint">Suffix</span>
                  <input
                    type="text"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="_min"
                    className="h-11 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-ink outline-none focus:border-accent"
                  />
                </label>
              </div>
            </div>

            {/* Summary */}
            <div className="py-4">
              <span className="mb-2 block text-xs font-bold text-ink-soft">Batch summary</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border bg-surface-sunken p-2.5">
                  <span className="block text-[10px] font-medium text-ink-faint">Original</span>
                  <span className="font-mono text-sm font-bold text-ink">
                    {formatBytes(totalOriginalSize)}
                  </span>
                </div>
                <div className="rounded-md border border-border bg-surface-sunken p-2.5">
                  <span className="block text-[10px] font-medium text-ink-faint">Optimized</span>
                  <span className="font-mono text-sm font-bold text-ink">
                    {formatBytes(totalOutputSize)}
                  </span>
                </div>
              </div>
              {processedItems.length > 0 && totalSavings > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-md border border-positive/25 bg-positive-tint px-3 py-2">
                  <span className="text-xs font-semibold text-positive">Total saved</span>
                  <span className="font-mono text-xs font-bold text-positive">
                    {formatBytes(totalSavings)} (-{savingsPercent}%)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pinned actions */}
          <div className="mt-auto flex flex-col gap-3 border-t border-border bg-surface px-5 py-4">
            {isProcessing && (
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="font-mono text-xs font-semibold text-ink-soft">{progress}%</span>
              </div>
            )}
            <button
              onClick={processAll}
              disabled={items.length === 0 || isProcessing}
              className={`flex h-12 items-center justify-center gap-2 rounded-md text-sm font-bold transition-colors ${
                items.length === 0 || isProcessing
                  ? 'cursor-not-allowed bg-surface-sunken text-ink-faint'
                  : 'bg-accent text-white shadow-soft hover:bg-accent-hover'
              }`}
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isProcessing ? 'Processing batch…' : `Process all (${items.length})`}
            </button>
            <button
              onClick={downloadZip}
              disabled={processedItems.length === 0}
              className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors ${
                processedItems.length === 0
                  ? 'cursor-not-allowed border-border text-ink-faint'
                  : 'border-border-strong text-ink hover:bg-surface-sunken'
              }`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download all (ZIP)
            </button>
            {items.length > 0 && (
              <button
                onClick={clearQueue}
                className="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-ink-faint transition-colors hover:text-negative lg:hidden"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear queue
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
