'use client'

import { useTransition } from 'react'
import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { FileUploadZone } from './file-upload-zone'
import { FileCard } from './file-card'
import { uploadCustomerFile, deleteCustomerFile } from '@/app/actions/files'
import type { UserRole } from '@/types'

interface FileWithSignedUrl {
  id: string
  file_name: string
  file_url: string   // storage path
  file_type: string | null
  file_size: number | null
  uploader_name: string | null
  created_at: string
  signed_url: string | null  // pre-fetched server-side
}

interface CustomerDocumentsProps {
  customerId: string
  files: FileWithSignedUrl[]
  userRole: UserRole
}

export function CustomerDocuments({ customerId, files, userRole }: CustomerDocumentsProps) {
  function handleUpload(formData: FormData) {
    return uploadCustomerFile(customerId, formData)
  }

  function handleDelete(fileId: string, storagePath: string) {
    return deleteCustomerFile(fileId, storagePath, customerId)
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <FileUploadZone onUpload={handleUpload} />

      {/* File list */}
      {files.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="אין מסמכים"
          description="גרור קבצים לאזור למעלה כדי להעלות"
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{files.length} קבצים</p>
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
              bucket="customer-files"
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
