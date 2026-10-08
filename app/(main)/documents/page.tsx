'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  FileIcon as LucideFileIcon,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  Download,
  Eye,
  Info,
  ArrowUpDown,
  Upload,
  Loader2,
  HardDrive,
  Clock,
  CheckCircle,
  AlertCircle,
  Globe2
} from 'lucide-react'
import { FileIcon, iconBg, formatBytes, formatDate } from '@/components/main-screen/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

type Document = {
  id: string
  name: string
  mimeType: string
  s3Url: string
  cloudinaryUrl?: string | null
  websiteUrl?: string | null
  sourceType?: 'FILE' | 'WEBSITE'
  size: number
  status: string
  createdAt: string
  updatedAt: string
}

function AssetPreview({ doc, large = false }: { doc: Document; large?: boolean }) {
  const previewUrl = doc.websiteUrl || doc.s3Url || doc.cloudinaryUrl || ''
  const previewClass = large ? 'h-[420px] w-full' : 'w-full h-full'

  if (doc.sourceType === 'WEBSITE' || doc.websiteUrl) {
    return (
      <div className={`${previewClass} flex flex-col items-center justify-center gap-3 bg-zinc-50 px-6 text-center`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
          <Globe2 className="h-7 w-7 text-zinc-700" />
        </div>
        {large ? (
          <div className="max-w-lg">
            <p className="text-sm font-bold text-zinc-900">{doc.name}</p>
            <p className="mt-1 break-all text-xs text-zinc-500">{previewUrl}</p>
          </div>
        ) : null}
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div className={`${previewClass} flex items-center justify-center bg-zinc-50 text-zinc-400`}>
        <FileIcon mimeType={doc.mimeType} className={large ? 'h-12 w-12' : 'h-5 w-5'} />
      </div>
    )
  }

  if (doc.mimeType.startsWith('image/')) {
    return <img src={previewUrl} alt={doc.name} className={`${previewClass} object-contain bg-zinc-50`} />
  }

  if (doc.mimeType.startsWith('video/')) {
    return <video src={previewUrl} className={`${previewClass} bg-black object-contain`} controls={large} preload="metadata" muted={!large} />
  }

  if (doc.mimeType.startsWith('audio/')) {
    return (
      <div className={`${previewClass} flex flex-col items-center justify-center gap-4 bg-zinc-50 px-6`}>
        <FileIcon mimeType={doc.mimeType} className="h-12 w-12" />
        <audio src={previewUrl} controls className="w-full max-w-md" />
      </div>
    )
  }

  if (doc.mimeType === 'application/pdf') {
    return (
      <iframe
        src={previewUrl}
        title={doc.name}
        className={`${previewClass} border-0 bg-zinc-50`}
      />
    )
  }

  return (
    <div className={`${previewClass} flex flex-col items-center justify-center gap-3 bg-zinc-50 text-center`}>
      <FileIcon mimeType={doc.mimeType} className="h-12 w-12" />
      <p className="max-w-xs text-xs font-medium text-zinc-500">
        Preview is not available for this file type.
      </p>
    </div>
  )
}

export default function DocumentsDashboard() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'NAME' | 'SIZE'>('NEWEST')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Row Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modal & Sheet state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedDetailDoc, setSelectedDetailDoc] = useState<Document | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<{ id: string; file: File }[]>([])
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [websiteName, setWebsiteName] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Load documents
  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents')
      if (res.ok) {
        const data: Document[] = await res.json()
        const normalized = Array.isArray(data)
          ? data.map((doc) => ({
              ...doc,
              s3Url: doc.s3Url || doc.cloudinaryUrl || doc.websiteUrl || '',
            }))
          : []
        setDocuments(normalized)
      }
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  // Statistics Calculation
  const totalDocs = documents.length
  const totalSize = documents.reduce((acc, doc) => acc + doc.size, 0)
  const websiteCount = documents.filter((d) => d.sourceType === 'WEBSITE' || d.websiteUrl).length
  const pendingCount = documents.filter((d) => d.status === 'PENDING').length
  const uploadingCount = documents.filter((d) => d.status === 'UPLOADING' || d.status === 'PROCESSING').length
  const completedCount = documents.filter((d) => d.status === 'UPLOADED' || d.status === 'COMPLETED').length

  const recentCount = documents.filter((d) => {
    const hours = (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60)
    return hours <= 24
  }).length

  // Filter & Search & Sort logic
  const filteredDocs = documents
    .filter((doc) => {
      // 1. Search filter
      const matchesSearch =
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.mimeType.toLowerCase().includes(searchTerm.toLowerCase())
      
      // 2. Status filter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETED' && (doc.status === 'UPLOADED' || doc.status === 'COMPLETED')) ||
        (statusFilter === 'PENDING' && doc.status === 'PENDING') ||
        (statusFilter === 'FAILED' && doc.status === 'FAILED') ||
        (statusFilter === 'PROCESSING' && (doc.status === 'UPLOADING' || doc.status === 'PROCESSING'))

      // 3. Type filter
      let matchesType = true
      if (typeFilter !== 'ALL') {
        const mime = doc.mimeType.toLowerCase()
        if (typeFilter === 'PDF') matchesType = mime === 'application/pdf'
        else if (typeFilter === 'IMAGE') matchesType = mime.startsWith('image/')
        else if (typeFilter === 'VIDEO') matchesType = mime.startsWith('video/')
        else if (typeFilter === 'AUDIO') matchesType = mime.startsWith('audio/')
        else if (typeFilter === 'WEBSITE') matchesType = doc.sourceType === 'WEBSITE' || Boolean(doc.websiteUrl)
        else if (typeFilter === 'DOCUMENTS') matchesType = mime.startsWith('text/') || mime.includes('word') || mime.includes('spreadsheet') || mime.includes('presentation')
      }

      return matchesSearch && matchesStatus && matchesType
    })
    .sort((a, b) => {
      if (sortBy === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'OLDEST') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sortBy === 'NAME') return a.name.localeCompare(b.name)
      if (sortBy === 'SIZE') return b.size - a.size
      return 0
    })

  // Pagination logic
  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage)
  const paginatedDocs = filteredDocs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Multi-file drag/drop selection handlers
  const handleAddFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const next = Array.from(incoming).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
    }))
    setUploadFiles((prev) => [...prev, ...next])
  }

  const handleUploadSubmit = async () => {
    const trimmedUrl = websiteUrl.trim()
    if ((uploadFiles.length === 0 && !trimmedUrl) || isUploading) return
    setIsUploading(true)
    setUploadProgress(0)

    try {
      if (uploadFiles.length > 0) {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = "rubenius/documents";
        const signRes = await fetch("/api/cloudinary/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params: { timestamp, folder } })
        });
        
        if (!signRes.ok) throw new Error("Failed to get upload signature");
        const { signature, apiKey, cloudName } = await signRes.json();

        const uploadedFilesArr: Array<{ name: string; size: number; mimeType: string; url: string; publicId: string }> = [];
        let totalLoaded = 0;
        const totalSize = uploadFiles.reduce((acc, f) => acc + f.file.size, 0);

        for (let i = 0; i < uploadFiles.length; i++) {
          const { file } = uploadFiles[i];
          const formData = new FormData();
          formData.append("file", file);
          formData.append("api_key", apiKey);
          formData.append("timestamp", timestamp.toString());
          formData.append("signature", signature);
          formData.append("folder", folder);

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const currentProgress = Math.round(((totalLoaded + e.loaded) / totalSize) * 100);
                setUploadProgress(currentProgress);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                totalLoaded += file.size;
                const res = JSON.parse(xhr.responseText);
                uploadedFilesArr.push({
                  name: file.name,
                  size: file.size,
                  mimeType: file.type || "application/octet-stream",
                  url: res.secure_url,
                  publicId: res.public_id,
                });
                resolve();
              } else {
                reject(new Error("Cloudinary upload failed"));
              }
            };

            xhr.onerror = () => reject(new Error("Network error"));
            xhr.onabort = () => reject(new Error("Upload cancelled"));

            xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
            xhr.send(formData);
          });
        }

        const saveRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: uploadedFilesArr }),
        });

        if (!saveRes.ok) throw new Error("Failed to save documents to database");
      }

      if (trimmedUrl) {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: trimmedUrl,
            name: websiteName.trim() || undefined,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'Failed to save website URL')
        }
      }

      toast.success(trimmedUrl && uploadFiles.length === 0 ? 'Website URL saved successfully' : 'Assets saved successfully')
      setIsUploadOpen(false)
      setUploadFiles([])
      setWebsiteUrl('')
      setWebsiteName('')
      loadDocs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  // Row operations
  const handleDeleteDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Document deleted successfully')
        setDocuments((prev) => prev.filter((d) => d.id !== id))
        setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id))
      } else {
        toast.error('Failed to delete document')
      }
    } catch {
      toast.error('Failed to delete document')
    } finally {
      setDeleteConfirmId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      if (res.ok) {
        toast.success('Selected documents deleted successfully')
        setDocuments((prev) => prev.filter((d) => !selectedIds.includes(d.id)))
        setSelectedIds([])
      } else {
        toast.error('Bulk deletion failed')
      }
    } catch {
      toast.error('Bulk deletion failed')
    } finally {
      setIsBulkDeleteOpen(false)
    }
  }

  const handleBulkDownload = () => {
    if (selectedIds.length === 0) return
    selectedIds.forEach((id) => {
      const doc = documents.find((d) => d.id === id)
      if (doc) {
        window.open(doc.websiteUrl || doc.s3Url, '_blank')
      }
    })
    toast.success(`Triggered download for ${selectedIds.length} files`)
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedDocs.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(paginatedDocs.map((doc) => doc.id))
    }
  }

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id))
    } else {
      setSelectedIds((prev) => [...prev, id])
    }
  }

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase()
    if (s === 'COMPLETED' || s === 'UPLOADED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircle className="w-3 h-3" /> Completed
        </span>
      )
    }
    if (s === 'PROCESSING' || s === 'UPLOADING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" /> Processing
        </span>
      )
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
          <Clock className="w-3 h-3" /> Pending
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
        <AlertCircle className="w-3 h-3" /> Failed
      </span>
    )
  }

  // Background: white at the top, light sea blue in the middle, dark blue at the bottom.
  return (
    <div className="bg-[linear-gradient(to_top,#0a1f5c_0%,#1d4ed8_22%,#5cc8e0_52%,#d6f4fa_78%,#ffffff_100%)] dark:bg-[linear-gradient(to_top,#020617_0%,#0f172a_50%,#1e293b_100%)] min-h-dvh px-3 py-5 sm:px-5 sm:py-8 lg:px-8 lg:py-10 3xl:px-12 flex flex-col gap-5 sm:gap-8 antialiased">
      {/* 1. Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sky-100 dark:border-zinc-800 pb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Documents</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Manage and review stored files and website assets securely.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-3.5 sm:top-2.5" />
            <input
              type="text"
              placeholder="Search filename, tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 sm:py-2 text-base sm:text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white w-full sm:w-60 transition-all shadow-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none rounded-xl px-3 py-2.5 sm:py-2 text-sm sm:text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none rounded-xl px-3 py-2.5 sm:py-2 text-sm sm:text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer shadow-sm"
          >
            <option value="ALL">All Formats</option>
            <option value="PDF">PDF</option>
            <option value="IMAGE">Images</option>
            <option value="VIDEO">Videos</option>
            <option value="AUDIO">Audio</option>
            <option value="WEBSITE">Websites</option>
            <option value="DOCUMENTS">Documents</option>
          </select>

          {/* Sort selection */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none rounded-xl px-3 py-2.5 sm:py-2 text-sm sm:text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer shadow-sm"
          >
            <option value="NEWEST">Newest Uploaded</option>
            <option value="OLDEST">Oldest Uploaded</option>
            <option value="NAME">Alphabetical (A-Z)</option>
            <option value="SIZE">Largest Size</option>
          </select>

          {/* Upload trigger button using Dialog */}
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black hover:bg-zinc-900 text-white font-semibold text-xs h-10 sm:h-auto py-2 px-4 rounded-xl shadow-md cursor-pointer flex w-full sm:w-auto items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Add to Storage
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-4xl rounded-2xl bg-white p-0 overflow-y-auto shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-12">
                {/* Left panel: Specifications and Instructions (Col Span 5) */}
                <div className="md:col-span-5 bg-zinc-50 p-4 sm:p-6 border-r border-zinc-100 flex flex-col justify-between">
                  <div className="space-y-5">
                    <div>
                      <DialogTitle className="text-lg font-bold text-zinc-900">Storage</DialogTitle>
                      <DialogDescription className="text-xs text-zinc-500 mt-1">
                        Select files or save a website link into your workspace catalog.
                      </DialogDescription>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3 bg-white rounded-xl border border-zinc-150 shadow-sm space-y-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">
                          Feature Highlight
                        </span>
                        <p className="text-[11px] font-medium text-zinc-700 leading-normal">
                          You can drag &amp; drop files or save a website link as a storage asset.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                          Supported Formats
                        </span>

                        <div className="space-y-2 text-[11px]">
                          <div className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold shrink-0">•</span>
                            <p className="text-zinc-650 leading-relaxed">
                              <strong className="text-zinc-900">Images:</strong> PNG, JPG, JPEG, SVG, WebP, GIF, HEIC
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-500 font-bold shrink-0">•</span>
                            <p className="text-zinc-650 leading-relaxed">
                              <strong className="text-zinc-900">Videos:</strong> MP4, MOV, AVI, MKV, WebM
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-red-500 font-bold shrink-0">•</span>
                            <p className="text-zinc-650 leading-relaxed">
                              <strong className="text-zinc-900">Documents:</strong> PDF, DOCX, PPTX, XLSX, TXT, CSV
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-500 font-bold shrink-0">•</span>
                            <p className="text-zinc-650 leading-relaxed">
                              <strong className="text-zinc-900">Audio:</strong> MP3, WAV, AAC, M4A, OGG
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-zinc-500 font-bold shrink-0">•</span>
                            <p className="text-zinc-650 leading-relaxed">
                              <strong className="text-zinc-900">Websites:</strong> HTTP and HTTPS links
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-zinc-400 border-t border-zinc-200/60 pt-4 mt-6">
                    Stored files and website links will be cataloged instantly.
                  </div>
                </div>

                {/* Right panel: Storage workspace (Col Span 7) */}
                <div className="md:col-span-7 p-4 sm:p-6 flex flex-col justify-between gap-6 md:min-h-[400px]">
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">
                      Dropzone Workspace
                    </span>

                    <div className="space-y-2 rounded-xl border border-zinc-150 bg-zinc-50/50 p-3">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Website URL
                      </label>
                      <input
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="h-11 sm:h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base sm:text-xs text-zinc-800 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-black"
                      />
                      <input
                        value={websiteName}
                        onChange={(e) => setWebsiteName(e.target.value)}
                        placeholder="Optional display name"
                        className="h-11 sm:h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base sm:text-xs text-zinc-800 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-black"
                      />
                    </div>

                    {/* Storage Drop Zone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOver(false)
                        handleAddFiles(e.dataTransfer.files)
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl py-8 sm:py-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                        dragOver
                          ? 'border-black bg-zinc-50/50 scale-[0.99] shadow-inner'
                          : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/20'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleAddFiles(e.target.files)}
                      />
                      <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center shadow-sm">
                        <Upload className="w-5 h-5 text-zinc-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-700">
                          Drag &amp; drop files or <span className="underline text-black">browse</span>
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1">Multi-selection is fully active</p>
                      </div>
                    </div>

                    {/* File List */}
                    {uploadFiles.length > 0 && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          Queue ({uploadFiles.length})
                        </span>
                        {uploadFiles.map((fileObj) => (
                          <div
                            key={fileObj.id}
                            className="flex items-center justify-between p-2.5 border border-zinc-150 rounded-xl bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <LucideFileIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="text-xs font-semibold text-zinc-700 truncate">{fileObj.file.name}</span>
                              <span className="text-[9px] text-zinc-400 shrink-0 font-mono">({formatBytes(fileObj.file.size)})</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setUploadFiles((prev) => prev.filter((f) => f.id !== fileObj.id))
                              }}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline px-2 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Progress Bar */}
                    {isUploading && (
                      <div className="flex flex-col gap-1.5 p-3 bg-zinc-50 rounded-xl border border-zinc-150">
                        <div className="flex justify-between text-[10px] text-zinc-500 font-semibold leading-none">
                          <span>Saving assets to storage...</span>
                          <span className="font-mono">{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black transition-all duration-200 rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="mt-6 border-t border-zinc-100 pt-4 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsUploadOpen(false)
                        setUploadFiles([])
                        setWebsiteUrl('')
                        setWebsiteName('')
                      }}
                      className="cursor-pointer text-xs"
                      disabled={isUploading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUploadSubmit}
                      className="bg-black hover:bg-zinc-900 text-white font-semibold text-xs px-5 py-2 rounded-xl cursor-pointer disabled:opacity-40"
                      disabled={(uploadFiles.length === 0 && websiteUrl.trim().length === 0) || isUploading}
                    >
                      {isUploading ? 'Processing...' : `Save ${uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}`}
                    </Button>
                  </DialogFooter>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* 2. Top Statistics Section */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5 shrink-0 max-md:[&>*:last-child]:col-span-2 md:max-lg:[&>*:last-child]:col-span-1">
        {/* Total Documents */}
        <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 p-4 rounded-2xl flex flex-col gap-2.5 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Documents</span>
            <LucideFileIcon className="w-4 h-4 text-zinc-500 group-hover:scale-110 transition-transform" />
          </div>
          <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none">{totalDocs}</h3>
          <p className="text-[10px] text-zinc-400">Total uploaded files cataloged</p>
        </div>

        {/* Storage Used */}
        <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 p-4 rounded-2xl flex flex-col gap-2.5 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Storage Used</span>
            <HardDrive className="w-4 h-4 text-zinc-500 group-hover:scale-110 transition-transform" />
          </div>
          <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none">{formatBytes(totalSize)}</h3>
          <div className="flex flex-col gap-1 w-full mt-0.5">
            <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-black dark:bg-white rounded-full" style={{ width: `${Math.min(100, (totalSize / (1024 * 1024 * 100)) * 100)}%` }} />
            </div>
            <span className="text-[9px] text-zinc-400 text-right">Limit: 100 MB</span>
          </div>
        </div>

        {/* Processing Status */}
        <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 p-4 rounded-2xl flex flex-col gap-2.5 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Process Status</span>
            <CheckCircle className="w-4 h-4 text-zinc-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none">{completedCount}</h3>
            <div className="flex flex-col text-right text-[9px] text-zinc-400 leading-tight">
              <span>{pendingCount} Pending</span>
              <span>{uploadingCount} Proc</span>
            </div>
          </div>
          <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            • {completedCount} files finalized
          </p>
        </div>

        {/* File Formats */}
        <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 p-4 rounded-2xl flex flex-col gap-2 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Formats Split</span>
            <SlidersHorizontal className="w-4 h-4 text-zinc-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-[9px] font-bold text-zinc-650 dark:text-zinc-400 mt-1">
            <span className="bg-zinc-50 dark:bg-zinc-900 p-1 rounded text-center">PDF: {documents.filter(d => d.name.toLowerCase().endsWith('.pdf')).length}</span>
            <span className="bg-zinc-50 dark:bg-zinc-900 p-1 rounded text-center">IMG: {documents.filter(d => d.mimeType.startsWith('image/')).length}</span>
            <span className="bg-zinc-50 dark:bg-zinc-900 p-1 rounded text-center">VID: {documents.filter(d => d.mimeType.startsWith('video/')).length}</span>
            <span className="bg-zinc-50 dark:bg-zinc-900 p-1 rounded text-center">WEB: {websiteCount}</span>
          </div>
        </div>

        {/* Recent Uploads */}
        <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 p-4 rounded-2xl flex flex-col gap-2.5 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Recent (24h)</span>
            <Clock className="w-4 h-4 text-zinc-500 group-hover:scale-110 transition-transform" />
          </div>
          <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none">{recentCount}</h3>
          <p className="text-[10px] text-zinc-400">Assets added in the last 24 hours</p>
        </div>
      </section>

      {/* 3. Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-black text-white px-6 py-3.5 rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 shrink-0">
          <span className="text-xs font-semibold">
            {selectedIds.length} document{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download Selected
            </button>
            <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-xs font-semibold rounded-xl transition-all cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                </button>
              </DialogTrigger>
              <DialogContent className="bg-white rounded-2xl p-6">
                <DialogHeader>
                  <DialogTitle>Confirm Bulk Deletion</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete these {selectedIds.length} selected documents? This action is permanent and cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)} className="text-xs">Cancel</Button>
                  <Button onClick={handleBulkDelete} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2">Delete permanently</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* 4. Table / Main List Workspace */}
      <section className="flex-1 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 rounded-2xl shadow-lg overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-12 rounded-lg" />
                <Skeleton className="h-6 flex-1 rounded-lg" />
                <Skeleton className="h-6 w-24 rounded-lg" />
                <Skeleton className="h-6 w-24 rounded-lg" />
              </div>
              <div className="border-t border-zinc-100 pt-4 space-y-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-4 py-2 border-b border-zinc-50 last:border-0">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-10 w-10 rounded-lg animate-pulse" />
                    <Skeleton className="h-4 w-40 rounded" />
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-6 w-24 rounded-md" />
                    <Skeleton className="h-4 w-28 rounded" />
                    <div className="flex-1 flex justify-end gap-1.5">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : filteredDocs.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center mb-4">
              <LucideFileIcon className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">No documents found</h3>
            <p className="text-xs text-zinc-400 max-w-xs mt-1 leading-relaxed">
              No assets matched your filters or search. Try adding files or website links.
            </p>
            <Button
              onClick={() => setIsUploadOpen(true)}
              className="mt-6 bg-black dark:bg-white hover:bg-zinc-900 dark:hover:bg-zinc-200 text-white dark:text-black font-semibold text-xs py-2 px-5 rounded-xl cursor-pointer"
            >
              Add First Asset
            </Button>
          </div>
        ) : (
          /* Table View */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="hidden md:block">
              <Table className="relative">
                <TableHeader className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === paginatedDocs.length && paginatedDocs.length > 0}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 accent-black rounded cursor-pointer mt-1"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4">File Name</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4 hidden lg:table-cell">Type</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4">Size</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4">Status</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4 hidden lg:table-cell">Created Date</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4 hidden xl:table-cell">Tags</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDocs.map((doc) => {
                    const isSelected = selectedIds.includes(doc.id)
                    return (
                      <TableRow
                        key={doc.id}
                        className={`border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors ${
                          isSelected ? 'bg-zinc-50/80 dark:bg-zinc-800/50' : ''
                        }`}
                      >
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(doc.id)}
                            className="w-3.5 h-3.5 accent-black rounded cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="p-4 font-semibold text-zinc-800 dark:text-zinc-100 text-xs">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg(doc.mimeType)} shrink-0 shadow-sm overflow-hidden`}>
                              <AssetPreview doc={doc} />
                            </div>
                            <span className="truncate max-w-[140px] lg:max-w-[200px] xl:max-w-xs 3xl:max-w-md" title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-4 hidden lg:table-cell text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase">
                          {doc.sourceType === 'WEBSITE' || doc.websiteUrl ? 'website' : doc.mimeType.split('/')[1] || doc.mimeType}
                        </TableCell>
                        <TableCell className="p-4 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {doc.sourceType === 'WEBSITE' || doc.websiteUrl ? 'External' : formatBytes(doc.size)}
                        </TableCell>
                        <TableCell className="p-4">{getStatusBadge(doc.status)}</TableCell>
                        <TableCell className="p-4 hidden lg:table-cell text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDate(doc.createdAt)}
                        </TableCell>
                        <TableCell className="p-4 hidden xl:table-cell">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 text-[10px] font-semibold">
                            media
                          </span>
                        </TableCell>
                        <TableCell className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedDetailDoc(doc)}
                              className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                              title="Preview and details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setSelectedDetailDoc(doc)}
                              className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                              title="Details"
                            >
                              <Info className="w-4 h-4" />
                            </button>

                            {/* Delete dialog trigger */}
                            <button
                              onClick={() => setDeleteConfirmId(doc.id)}
                              className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-all cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>

              {/* Phone layout: one card per document instead of a wide table. */}
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60 md:hidden">
                {paginatedDocs.map((doc) => {
                  const isSelected = selectedIds.includes(doc.id)
                  const isWebsite = doc.sourceType === 'WEBSITE' || Boolean(doc.websiteUrl)
                  return (
                    <li key={doc.id} className={`flex items-start gap-3 p-3 ${isSelected ? 'bg-zinc-50/80 dark:bg-zinc-800/50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(doc.id)}
                        aria-label={`Select ${doc.name}`}
                        className="mt-3 size-4 shrink-0 accent-black cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedDetailDoc(doc)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <div className={`size-11 shrink-0 overflow-hidden rounded-lg flex items-center justify-center shadow-sm ${iconBg(doc.mimeType)}`}>
                          <AssetPreview doc={doc} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-zinc-800 dark:text-zinc-100">{doc.name}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {getStatusBadge(doc.status)}
                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                              {isWebsite ? 'Website' : formatBytes(doc.size)}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(doc.createdAt)}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(doc.id)}
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                        aria-label={`Delete ${doc.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-zinc-50/50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 sm:flex-row items-center justify-between shrink-0">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Showing {Math.min(filteredDocs.length, (currentPage - 1) * itemsPerPage + 1)}–
                  {Math.min(filteredDocs.length, currentPage * itemsPerPage)} of {filteredDocs.length} files
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="text-xs cursor-pointer"
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-medium text-zinc-500 sm:hidden">{currentPage} / {totalPages}</span>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const p = idx + 1
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`hidden sm:block w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          currentPage === p
                            ? 'bg-black dark:bg-white text-white dark:text-black'
                            : 'hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="text-xs cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5. Row Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action is permanent and all stored assets in S3 will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="text-xs">Cancel</Button>
            <Button
              onClick={() => deleteConfirmId && handleDeleteDoc(deleteConfirmId)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Document Preview and Details Modal */}
      <Dialog open={selectedDetailDoc !== null} onOpenChange={(open) => !open && setSelectedDetailDoc(null)}>
        <DialogContent className="max-w-[calc(100%-1rem)] overflow-y-auto md:overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 p-0 shadow-2xl sm:max-w-5xl">
          {selectedDetailDoc && (
            <div className="grid grid-cols-1 md:max-h-[90vh] md:overflow-hidden md:grid-cols-[1fr_360px]">
              <div className="min-h-[240px] sm:min-h-[360px] bg-zinc-950 dark:bg-black">
                <AssetPreview doc={selectedDetailDoc} large />
              </div>

              <div className="flex flex-col p-4 sm:p-6 md:max-h-[90vh] md:overflow-y-auto">
                <DialogHeader className="pr-8">
                  <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-xl ${iconBg(selectedDetailDoc.mimeType)} shadow-sm`}>
                    <FileIcon mimeType={selectedDetailDoc.mimeType} className="h-6 w-6" />
                  </div>
                  <DialogTitle className="truncate text-lg font-bold leading-tight text-zinc-900 dark:text-zinc-100" title={selectedDetailDoc.name}>
                    {selectedDetailDoc.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-400 dark:text-zinc-500">
                    Document ID: {selectedDetailDoc.id}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-6 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-6 text-xs">
                  <div className="grid grid-cols-3 gap-3">
                    <span className="font-medium text-zinc-400 dark:text-zinc-500">File Type</span>
                    <span className="col-span-2 break-all font-mono font-semibold uppercase text-zinc-800 dark:text-zinc-200">
                      {selectedDetailDoc.sourceType === 'WEBSITE' || selectedDetailDoc.websiteUrl ? 'Website URL' : selectedDetailDoc.mimeType}
                    </span>
                  </div>
                  {(selectedDetailDoc.sourceType === 'WEBSITE' || selectedDetailDoc.websiteUrl) ? (
                    <div className="grid grid-cols-3 gap-3">
                      <span className="font-medium text-zinc-400 dark:text-zinc-500">Website URL</span>
                      <a
                        href={selectedDetailDoc.websiteUrl || selectedDetailDoc.s3Url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="col-span-2 break-all font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-4"
                      >
                        {selectedDetailDoc.websiteUrl || selectedDetailDoc.s3Url}
                      </a>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-3 gap-3">
                    <span className="font-medium text-zinc-400 dark:text-zinc-500">Source</span>
                    <span className="col-span-2 font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedDetailDoc.sourceType === 'WEBSITE' || selectedDetailDoc.websiteUrl ? 'Website Link' : 'Uploaded File'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <span className="font-medium text-zinc-400 dark:text-zinc-500">File Size</span>
                    <span className="col-span-2 font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedDetailDoc.sourceType === 'WEBSITE' || selectedDetailDoc.websiteUrl ? 'External' : formatBytes(selectedDetailDoc.size)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <span className="font-medium text-zinc-400 dark:text-zinc-500">Status</span>
                    <span className="col-span-2">{getStatusBadge(selectedDetailDoc.status)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <span className="font-medium text-zinc-400 dark:text-zinc-500">Created Date</span>
                    <span className="col-span-2 font-semibold text-zinc-800 dark:text-zinc-200">{formatDate(selectedDetailDoc.createdAt)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <span className="font-medium text-zinc-400 dark:text-zinc-500">Last Modified</span>
                    <span className="col-span-2 font-semibold text-zinc-800 dark:text-zinc-200">{formatDate(selectedDetailDoc.updatedAt)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <span className="font-medium text-zinc-400 dark:text-zinc-500">Tags</span>
                    <div className="col-span-2 flex flex-wrap gap-1">
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">media</span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">uploaded</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Asset Info</h4>
                  <div className="space-y-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    <p>Category: Media Asset</p>
                    <p>Asset URL: {selectedDetailDoc.websiteUrl || selectedDetailDoc.s3Url ? 'Available' : 'Unavailable'}</p>
                    <p>Content status: {selectedDetailDoc.status}</p>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-2.5 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                  <a
                    href={selectedDetailDoc.websiteUrl || selectedDetailDoc.s3Url || '#'}
                    download={selectedDetailDoc.websiteUrl ? undefined : selectedDetailDoc.name}
                    onClick={(event) => {
                      if (!selectedDetailDoc.websiteUrl && !selectedDetailDoc.s3Url) event.preventDefault()
                    }}
                    target={selectedDetailDoc.websiteUrl ? '_blank' : undefined}
                    rel={selectedDetailDoc.websiteUrl ? 'noopener noreferrer' : undefined}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-black dark:bg-white py-2.5 text-xs font-semibold text-white dark:text-black shadow-md transition-all hover:bg-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {selectedDetailDoc.websiteUrl ? <Globe2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {selectedDetailDoc.websiteUrl ? 'Open Website' : 'Download Original File'}
                  </a>
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedDetailDoc.websiteUrl || `/view/${selectedDetailDoc.id}`, '_blank')}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs"
                  >
                    <Eye className="h-4 w-4" /> {selectedDetailDoc.websiteUrl ? 'Open Website Tab' : 'Open Full Screen'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
