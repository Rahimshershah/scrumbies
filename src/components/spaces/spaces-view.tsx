'use client'

import { useState, useEffect, useCallback } from 'react'
import { FolderTree } from './folder-tree'
import { DocumentEditor } from './document-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export interface Folder {
  id: string
  name: string
  order: number
  projectId: string
  documents: Document[]
}

export interface Document {
  id: string
  title: string
  content: any
  order: number
  folderId: string
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    name: string
    avatarUrl?: string | null
  }
  folder?: {
    id: string
    name: string
    projectId: string
  }
  _count?: {
    versions: number
    comments: number
  }
}

interface SpacesViewProps {
  projectId: string
  currentUser: {
    id: string
    name: string
    role?: string
    avatarUrl?: string | null
  }
  initialDocumentId?: string | null
  onDocumentOpened?: () => void
}

export function SpacesView({ projectId, currentUser, initialDocumentId, onDocumentOpened }: SpacesViewProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch(`/api/folders?projectId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setFolders(data)
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  // Handle initial document ID from navigation
  useEffect(() => {
    if (initialDocumentId && !loading) {
      setSelectedDocumentId(initialDocumentId)
      onDocumentOpened?.()
    }
  }, [initialDocumentId, loading, onDocumentOpened])

  // Fetch selected document
  useEffect(() => {
    if (!selectedDocumentId) {
      setSelectedDocument(null)
      return
    }

    async function fetchDocument() {
      try {
        const res = await fetch(`/api/documents/${selectedDocumentId}`)
        if (res.ok) {
          const data = await res.json()
          setSelectedDocument(data)
        }
      } catch (error) {
        console.error('Failed to fetch document:', error)
      }
    }

    fetchDocument()
  }, [selectedDocumentId])

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          projectId,
        }),
      })

      if (res.ok) {
        const folder = await res.json()
        setFolders((prev) => [...prev, folder])
        setShowCreateFolder(false)
        setNewFolderName('')
      }
    } catch (error) {
      console.error('Failed to create folder:', error)
    } finally {
      setCreating(false)
    }
  }

  // Create document
  const handleCreateDocument = async (folderId: string) => {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Document',
          folderId,
        }),
      })

      if (res.ok) {
        const document = await res.json()
        setFolders((prev) =>
          prev.map((f) =>
            f.id === folderId
              ? { ...f, documents: [...f.documents, document] }
              : f
          )
        )
        setSelectedDocumentId(document.id)
      }
    } catch (error) {
      console.error('Failed to create document:', error)
    }
  }

  // Delete folder
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder and all its documents?')) return

    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== folderId))
        if (selectedDocument?.folderId === folderId) {
          setSelectedDocumentId(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete folder:', error)
    }
  }

  // Rename folder
  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })

      if (res.ok) {
        setFolders((prev) =>
          prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
        )
      }
    } catch (error) {
      console.error('Failed to rename folder:', error)
    }
  }

  // Delete document
  const handleDeleteDocument = async (documentId: string, folderId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setFolders((prev) =>
          prev.map((f) =>
            f.id === folderId
              ? { ...f, documents: f.documents.filter((d) => d.id !== documentId) }
              : f
          )
        )
        if (selectedDocumentId === documentId) {
          setSelectedDocumentId(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  // Update document
  const handleDocumentUpdate = (updatedDoc: Document) => {
    setSelectedDocument(updatedDoc)
    setFolders((prev) =>
      prev.map((f) =>
        f.id === updatedDoc.folderId
          ? {
              ...f,
              documents: f.documents.map((d) =>
                d.id === updatedDoc.id ? { ...d, title: updatedDoc.title } : d
              ),
            }
          : f
      )
    )
  }

  // Filter folders based on search
  const filteredFolders = folders.map((folder) => ({
    ...folder,
    documents: folder.documents.filter((doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((folder) =>
    searchQuery === '' || folder.documents.length > 0
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm text-muted-foreground">Loading spaces...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 border-r bg-muted/30 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Documents</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowCreateFolder(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Button>
          </div>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Folder Tree */}
        <div className="flex-1 overflow-auto p-2">
          {filteredFolders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-sm">No folders yet</p>
              <p className="text-xs mt-1">Create a folder to get started</p>
            </div>
          ) : (
            <FolderTree
              folders={filteredFolders}
              selectedDocumentId={selectedDocumentId}
              currentUser={currentUser}
              onSelectDocument={setSelectedDocumentId}
              onCreateDocument={handleCreateDocument}
              onDeleteFolder={handleDeleteFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteDocument={handleDeleteDocument}
            />
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedDocument ? (
          <DocumentEditor
            document={selectedDocument}
            currentUser={currentUser}
            onUpdate={handleDocumentUpdate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">No document selected</p>
              <p className="text-sm mt-1">Select a document from the sidebar or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
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
            <Button onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
