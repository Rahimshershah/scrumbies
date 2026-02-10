'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FolderCard } from './folder-card'
import { DocumentCard } from './document-card'
import { ExplorerBreadcrumb } from './explorer-breadcrumb'
import type { Folder, Document } from './spaces-view'

interface ExplorerViewProps {
  folders: Folder[]
  currentFolderId: string | null
  currentUser: {
    id: string
    name: string
    role?: string
  }
  onNavigateToFolder: (folderId: string | null) => void
  onSelectDocument: (documentId: string) => void
  onCreateFolder: (name: string) => void
  onCreateDocument: (folderId: string) => void
  onUploadDocument: (folderId: string, file: File) => void
  onRenameFolder: (folderId: string, newName: string) => void
  onDeleteFolder: (folderId: string) => void
  onDeleteDocument: (documentId: string, folderId: string) => void
}

export function ExplorerView({
  folders,
  currentFolderId,
  currentUser,
  onNavigateToFolder,
  onSelectDocument,
  onCreateFolder,
  onCreateDocument,
  onUploadDocument,
  onRenameFolder,
  onDeleteFolder,
  onDeleteDocument,
}: ExplorerViewProps) {
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && currentFolder) {
      onUploadDocument(currentFolder.id, file)
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const currentFolder = currentFolderId
    ? folders.find(f => f.id === currentFolderId) || null
    : null

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim())
      setNewFolderName('')
      setShowCreateFolder(false)
    }
  }

  const handleStartRename = (folder: Folder) => {
    setRenamingFolder(folder)
    setRenameValue(folder.name)
  }

  const handleConfirmRename = () => {
    if (renamingFolder && renameValue.trim()) {
      onRenameFolder(renamingFolder.id, renameValue.trim())
      setRenamingFolder(null)
      setRenameValue('')
    }
  }

  const handleDeleteFolder = (folderId: string) => {
    if (confirm('Are you sure you want to delete this folder and all its documents?')) {
      onDeleteFolder(folderId)
    }
  }

  const handleDeleteDocument = (doc: Document) => {
    if (confirm('Are you sure you want to delete this document?')) {
      onDeleteDocument(doc.id, doc.folderId)
    }
  }

  const canDeleteDocument = (doc: Document) => {
    return doc.createdById === currentUser.id || currentUser.role === 'ADMIN'
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentFolder && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onNavigateToFolder(null)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
            )}
            <ExplorerBreadcrumb
              currentFolder={currentFolder}
              onNavigateToRoot={() => onNavigateToFolder(null)}
            />
          </div>
          {currentFolder ? (
            <>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onCreateDocument(currentFolder.id)}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    New Document
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowCreateFolder(true)}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Folder
            </Button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-auto p-4">
        {currentFolder ? (
          // Inside a folder - show documents
          currentFolder.documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">No documents yet</p>
              <p className="text-sm mt-1">Create your first document in this folder</p>
              <Button
                className="mt-4"
                onClick={() => onCreateDocument(currentFolder.id)}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Document
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {currentFolder.documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onClick={() => onSelectDocument(doc.id)}
                  onDelete={() => handleDeleteDocument(doc)}
                  canDelete={canDeleteDocument(doc)}
                />
              ))}
            </div>
          )
        ) : (
          // Root level - show folders
          folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-lg font-medium">No folders yet</p>
              <p className="text-sm mt-1">Create your first folder to get started</p>
              <Button
                className="mt-4"
                onClick={() => setShowCreateFolder(true)}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Folder
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onClick={() => onNavigateToFolder(folder.id)}
                  onRename={() => handleStartRename(folder)}
                  onDelete={() => handleDeleteFolder(folder.id)}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateFolder(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={!!renamingFolder} onOpenChange={(open) => !open && setRenamingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingFolder(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRename} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
