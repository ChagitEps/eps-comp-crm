'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  FileText, FileSpreadsheet, File, Download,
  Trash2, Loader2, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { getSignedUrl } from '@/app/actions/files'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

interface FileCardProps {
  id: string
  fileName: string
  storagePath: string
  fileType: string | null
  fileSize: number | null
  uploaderName: string | null
  createdAt: string
  bucket: 'customer-files' | 'ticket-files'
  userRole: UserRole
  onDelete: () => Promise<{ error?: string }>
  signedUrl?: string | null  // pre-fetched signed URL for images
}

function FileIcon({ type }: { type: string | null }) {
  if (!type) return <File className="h-8 w-8 text-muted-foreground" />
  if (type.startsWith('image/')) return <Eye className="h-8 w-8 text-blue-500" />
  if (type === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />
  if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-8 w-8 text-green-600" />
  if (type.includes('word') || type.includes('document')) return <FileText className="h-8 w-8 text-blue-600" />
  return <File className="h-8 w-8 text-muted-foreground" />
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const isImage = (type: string | null) => type?.startsWith('image/') ?? false

export function FileCard({
  id, fileName, storagePath, fileType, fileSize,
  uploaderName, createdAt, bucket, userRole, onDelete, signedUrl,
}: FileCardProps) {
  const [isPending, startTransition] = useTransition()
  const [downloadPending, startDownload] = useTransition()
  const [previewOpen, setPreviewOpen] = useState(false)
  const isAdmin = userRole === 'admin'
  const isImg = isImage(fileType)

  async function handleDownload() {
    startDownload(async () => {
      const result = await getSignedUrl(bucket, storagePath)
      if (result.error || !result.signedUrl) {
        toast.error(result.error ?? 'שגיאה בהורדה')
        return
      }
      const a = document.createElement('a')
      a.href = result.signedUrl
      a.download = fileName
      a.target = '_blank'
      a.click()
    })
  }

  async function handleDelete() {
    startTransition(async () => {
      const result = await onDelete()
      if (result?.error) toast.error(result.error)
      else toast.success('הקובץ נמחק')
    })
  }

  return (
    <>
      <div className={cn(
        'group flex gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/40 transition-colors',
        isPending && 'opacity-50'
      )}>
        {/* Preview / Icon */}
        <div className="shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {isImg && signedUrl ? (
            <button onClick={() => setPreviewOpen(true)} className="w-full h-full">
              <Image
                src={signedUrl}
                alt={fileName}
                width={48}
                height={48}
                className="object-cover w-full h-full rounded-lg"
                unoptimized
              />
            </button>
          ) : (
            <FileIcon type={fileType} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-medium truncate" title={fileName}>{fileName}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {fileSize && <span>{formatSize(fileSize)}</span>}
            <span>·</span>
            <span>{formatDate(createdAt)}</span>
            {uploaderName && (
              <>
                <span>·</span>
                <span>{uploaderName}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isImg && signedUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPreviewOpen(true)}
              className="text-muted-foreground hover:text-foreground"
              title="תצוגה מקדימה"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDownload}
            disabled={downloadPending}
            className="text-muted-foreground hover:text-foreground"
            title="הורד"
          >
            {downloadPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
          {isAdmin && (
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  title="מחק"
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              }
              title="מחיקת קובץ"
              description={`האם למחוק את "${fileName}"? פעולה זו אינה הפיכה.`}
              confirmLabel="מחק"
              onConfirm={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Image preview modal */}
      {isImg && signedUrl && previewOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative max-w-3xl max-h-[80vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute -top-10 left-0 text-white text-sm hover:underline"
            >
              סגור ×
            </button>
            <img
              src={signedUrl}
              alt={fileName}
              className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg shadow-2xl"
            />
            <p className="text-center text-white text-sm mt-3 opacity-80">{fileName}</p>
          </div>
        </div>
      )}
    </>
  )
}
