'use client'

import { Paperclip } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { FileUploadZone } from './file-upload-zone'
import { FileCard } from './file-card'
import { uploadTicketFile, deleteTicketFile } from '@/app/actions/files'
import type { UserRole } from '@/types'

interface FileWithSignedUrl {
  id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  uploader_name: string | null
  created_at: string
  signed_url: string | null
}

interface TicketAttachmentsProps {
  ticketId: string
  customerId: string
  files: FileWithSignedUrl[]
  userRole: UserRole
}

export function TicketAttachments({ ticketId, customerId, files, userRole }: TicketAttachmentsProps) {
  function handleUpload(formData: FormData) {
    return uploadTicketFile(ticketId, customerId, formData)
  }

  function handleDelete(fileId: string, storagePath: string) {
    return deleteTicketFile(fileId, storagePath, ticketId)
  }

  return (
    <div className="space-y-4">
      {/* Compact upload */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{files.length} קבצים מצורפים</p>
        <FileUploadZone onUpload={handleUpload} compact />
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="אין קבצים מצורפים"
          description="לחץ 'העלה קובץ' כדי לצרף תמונה, PDF או מסמך"
        />
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <FileCard
              key={file.id}
              id={file.id}
              fileName={file.file_name}
              storagePath={file.file_url}
              fileType={file.file_type}
              fileSize={file.file_size}
              uploaderName={file.uploader_name}
              createdAt={file.created_at}
              bucket="ticket-files"
              userRole={userRole}
              signedUrl={file.signed_url}
              onDelete={() => handleDelete(file.id, file.file_url)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
