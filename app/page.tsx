'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createZipBlob } from '@/lib/zip'

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

export default function ImageKitPage() {
  const [items, setItems] = useState<ImageItem[]>([])
  const [format, setFormat] = useState<'original' | 'image/webp' | 'image/jpeg' | 'image/png'>('image/webp')
  const [quality, setQuality] = useState<number>(80)
  const [resizeMode, setResizeMode] = useState<'none' | 'percent' | 'maxFit'>('none')
  const [scalePercent, setScalePercent] = useState<number>(50)
  const [maxWidth, setMaxWidth] = useState<number>(1920)
  const [maxHeight, setMaxHeight] = useState<number>(1080)
  const [prefix, setPrefix] = useState<string>('opt_')
  const [suffix, setSuffix] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Format file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  // Add files to queue
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

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        addFiles(e.clipboardData.files)
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addFiles])

  // Sample images generator
  const loadSampleImages = () => {
    const samples = [
      { name: 'sunset-landscape.jpg', color1: '#f97316', color2: '#9333ea', w: 1920, h: 1080 },
      { name: 'tech-dashboard-mockup.png', color1: '#2563eb', color2: '#06b6d4', w: 1600, h: 900 },
      { name: 'minimal-portrait.png', color1: '#10b981', color2: '#14b8a6', w: 1200, h: 1200 },
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

      // Add decorative geometric shapes
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

  // Calculate target dimensions
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
      const scale = Math.min(scaleW, scaleH, 1) // don't upscale
      return {
        width: Math.max(1, Math.round(origW * scale)),
        height: Math.max(1, Math.round(origH * scale)),
      }
    }
    return { width: origW, height: origH }
  }

  // Process single item
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

        // High quality rendering
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

  // Process all items
  const processAll = async () => {
    if (items.length === 0 || isProcessing) return
    setIsProcessing(true)
    setProgress(0)

    const updated = [...items]
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'processing' }
      setItems([...updated])

      const res = await processImage(updated[i])
      updated[i] = res
      setItems([...updated])
      setProgress(Math.round(((i + 1) / updated.length) * 100))
    }

    setIsProcessing(false)
  }

  // Download single item
  const downloadItem = (item: ImageItem) => {
    if (!item.outputUrl || !item.outputName) return
    const a = document.createElement('a')
    a.href = item.outputUrl
    a.download = item.outputName
    a.click()
  }

  // Download all as ZIP
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

  // Remove single item
  const removeItem = (id: string) => {
    setItems((prev) => {
      const filtered = prev.filter((it) => it.id !== id)
      return filtered
    })
  }

  // Clear all
  const clearQueue = () => {
    items.forEach((it) => {
      URL.revokeObjectURL(it.previewUrl)
      if (it.outputUrl) URL.revokeObjectURL(it.outputUrl)
    })
    setItems([])
    setProgress(0)
  }

  // Stats calculation
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
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            IK
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none flex items-center gap-2">
              ImageKit
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                100% Client-Side
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">Privacy-First Batch Image Processor</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <button
              onClick={clearQueue}
              className="text-xs text-neutral-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-red-900/50"
            >
              Clear Queue
            </button>
          )}
          <button
            onClick={loadSampleImages}
            className="text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3.5 py-1.5 rounded-lg transition-all border border-neutral-700/60 shadow-sm"
          >
            Load Samples
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dropzone & Queue (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-800 hover:border-indigo-500/60 bg-neutral-900/30 hover:bg-neutral-900/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && addFiles(e.target.files)}
              multiple
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-medium text-sm text-neutral-200 mb-1">
              Drag & drop images here, or <span className="text-indigo-400 underline decoration-indigo-500/40">browse files</span>
            </p>
            <p className="text-xs text-neutral-500">Supports PNG, JPEG, WebP. Multiple files & clipboard paste supported.</p>
          </div>

          {/* Queue Section */}
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-neutral-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-200">Processing Queue</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                  {items.length} {items.length === 1 ? 'file' : 'files'}
                </span>
              </div>
              {processedItems.length > 0 && (
                <span className="text-xs text-emerald-400 font-medium">
                  {processedItems.length} of {items.length} processed
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-neutral-500 text-sm">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Queue is empty. Add images above or click &quot;Load Samples&quot;.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/60 overflow-y-auto max-h-[520px]">
                {items.map((item) => {
                  const hasSavings = item.outputSize && item.outputSize < item.originalSize
                  const savings = item.outputSize
                    ? Math.round(((item.originalSize - item.outputSize) / item.originalSize) * 100)
                    : 0

                  return (
                    <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-neutral-800/20 transition-colors">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.outputUrl || item.previewUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* File Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-neutral-200 truncate" title={item.name}>
                            {item.name}
                          </p>
                          {item.status === 'done' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              READY
                            </span>
                          )}
                          {item.status === 'processing' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 animate-pulse border border-indigo-500/20">
                              OPTIMIZING
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                              ERROR
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-neutral-400 mt-1 flex flex-wrap items-center gap-2">
                          <span>
                            {item.originalWidth} × {item.originalHeight} ({formatBytes(item.originalSize)})
                          </span>
                          {item.status === 'done' && item.outputWidth && item.outputSize && (
                            <>
                              <span className="text-neutral-600">→</span>
                              <span className="text-neutral-200 font-medium">
                                {item.outputWidth} × {item.outputHeight} ({formatBytes(item.outputSize)})
                              </span>
                              {hasSavings ? (
                                <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded text-[11px]">
                                  -{savings}%
                                </span>
                              ) : (
                                <span className="text-amber-400 font-medium text-[11px]">
                                  +{Math.abs(savings)}%
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-2">
                        {item.status === 'done' && (
                          <button
                            onClick={() => downloadItem(item)}
                            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-colors"
                            title="Download processed image"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800/60 transition-colors"
                          title="Remove from queue"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Settings Panel (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-5">
            <h2 className="text-sm font-semibold text-neutral-200 border-b border-neutral-800/80 pb-3">
              Optimization Settings
            </h2>

            {/* Output Format */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-400 block">Convert Format</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'image/webp', label: 'WebP (Best)' },
                  { id: 'image/jpeg', label: 'JPEG' },
                  { id: 'image/png', label: 'PNG' },
                  { id: 'original', label: 'Keep Original' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setFormat(fmt.id as typeof format)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-center ${
                      format === fmt.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/10'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compression Quality */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-neutral-400">Quality / Compression</span>
                <span className="text-indigo-400 font-mono">{quality}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>Smaller size</span>
                <span>Balanced (80%)</span>
                <span>Max fidelity</span>
              </div>
            </div>

            {/* Resize Mode */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-400 block">Dimensions</label>
              <div className="grid grid-cols-3 gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                {[
                  { id: 'none', label: 'Original' },
                  { id: 'percent', label: 'Scale %' },
                  { id: 'maxFit', label: 'Max Fit' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setResizeMode(mode.id as typeof resizeMode)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                      resizeMode === mode.id
                        ? 'bg-neutral-800 text-white shadow'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {resizeMode === 'percent' && (
                <div className="pt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Scale factor</span>
                    <span className="text-indigo-400 font-mono">{scalePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={scalePercent}
                    onChange={(e) => setScalePercent(Number(e.target.value))}
                    className="w-full accent-indigo-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {resizeMode === 'maxFit' && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <span className="text-[11px] text-neutral-500 block mb-1">Max Width (px)</span>
                    <input
                      type="number"
                      value={maxWidth}
                      onChange={(e) => setMaxWidth(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-500 block mb-1">Max Height (px)</span>
                    <input
                      type="number"
                      value={maxHeight}
                      onChange={(e) => setMaxHeight(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Renaming Pattern */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-400 block">Renaming Pattern</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-neutral-500 block mb-1">Prefix</span>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="opt_"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500 block mb-1">Suffix</span>
                  <input
                    type="text"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="_min"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Aggregate Stats Card */}
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Batch Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-900/80 p-3 rounded-xl border border-neutral-800/80">
                <span className="text-[11px] text-neutral-500 block">Original Total</span>
                <span className="text-base font-semibold font-mono text-neutral-200">
                  {formatBytes(totalOriginalSize)}
                </span>
              </div>
              <div className="bg-neutral-900/80 p-3 rounded-xl border border-neutral-800/80">
                <span className="text-[11px] text-neutral-500 block">Optimized Total</span>
                <span className="text-base font-semibold font-mono text-neutral-200">
                  {formatBytes(totalOutputSize)}
                </span>
              </div>
            </div>
            {processedItems.length > 0 && totalSavings > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-400">Total Saved</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {formatBytes(totalSavings)} (-{savingsPercent}%)
                </span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Sticky Action Bar */}
      <footer className="border-t border-neutral-800 bg-neutral-900/80 backdrop-blur sticky bottom-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isProcessing && (
              <div className="flex items-center gap-3 w-full sm:w-64">
                <div className="flex-1 bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-200 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-400 font-mono">{progress}%</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={processAll}
              disabled={items.length === 0 || isProcessing}
              className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md ${
                items.length === 0 || isProcessing
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-98'
              }`}
            >
              {isProcessing ? 'Processing Batch...' : `Process All (${items.length})`}
            </button>

            <button
              onClick={downloadZip}
              disabled={processedItems.length === 0}
              className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-medium text-sm transition-all border shadow-sm ${
                processedItems.length === 0
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-600 cursor-not-allowed'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-100 hover:text-white active:scale-98'
              }`}
            >
              Download All (ZIP)
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
