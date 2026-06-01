'use client'

import { useState, useRef, useTransition } from 'react'
import { Upload, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FileUploadZoneProps {
  onUpload: (formData: FormData) => Promise<{ error?: string; fileId?: string }>
  accept?: string
  disabled?: boolean
  compact?: boolean
}

const DEFAULT_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.doc,.xls'
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-excel']

export function FileUploadZone({
  onUpload,
  accept = DEFAULT_ACCEPT,
  disabled = false,
  compact = false,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    // Client-side validation before sending
    if (!ACCEPTED_TYPES.some(t => t === file.type || file.name.toLowerCase().endsWith(t.split('/')[1]))) {
      toast.error(`סוג קובץ לא נתמך: ${file.name}`)
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(`הקובץ ${file.name} גדול מ-20MB`)
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    startTransition(async () => {
      const result = await onUpload(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`${file.name} הועלה בהצלחה`)
      }
    })
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    Array.from(files).forEach(processFile)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!disabled && !isPending) setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled || isPending) return
    handleFiles(e.dataTransfer.files)
  }

  if (compact) {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || isPending}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isPending}
          className={cn(
            'flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50',
            (disabled || isPending) && 'cursor-not-allowed'
          )}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {isPending ? 'מעלה...' : 'העלה קובץ'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || isPending}
      />
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isPending && inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
          isDragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
          (disabled || isPending) && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
      >
        {isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">מעלה...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
              isDragOver ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Upload className={cn('h-5 w-5', isDragOver ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className="text-sm font-medium">
                {isDragOver ? 'שחרר להעלאה' : 'גרור קבצים לכאן'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                או <span className="text-primary">לחץ לבחירה</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WEBP, PDF, DOCX, XLSX · עד 20MB
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
