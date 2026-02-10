'use client'

import { useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Folder, Document } from './spaces-view'

interface FolderTreeProps {
  folders: Folder[]
  selectedDocumentId: string | null
  initialDocumentId?: string | null
  currentUser: {
    id: string
    name: string
    role?: string
  }
  onSelectDocument: (documentId: string) => void
  onCreateDocument: (folderId: string) => void
  onDeleteFolder: (folderId: string) => void
  onRenameFolder: (folderId: string, newName: string) => void
  onDeleteDocument: (documentId: string, folderId: string) => void
}

export function FolderTree({
  folders,
  selectedDocumentId,
  initialDocumentId,
  currentUser,
  onSelectDocument,
  onCreateDocument,
  onDeleteFolder,
  onRenameFolder,
  onDeleteDocument,
}: FolderTreeProps) {
  // Start with all folders collapsed
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Auto-expand folder when a document is selected via initialDocumentId or direct navigation
  useEffect(() => {
    const docIdToExpand = initialDocumentId || selectedDocumentId
    if (docIdToExpand) {
      const folder = folders.find(f => f.documents.some(d => d.id === docIdToExpand))
      if (folder && !expandedFolders.has(folder.id)) {
        setExpandedFolders(prev => new Set([...prev, folder.id]))
      }
    }
  }, [initialDocumentId, selectedDocumentId, folders])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const startEditing = (folder: Folder) => {
    setEditingFolderId(folder.id)
    setEditingName(folder.name)
  }

  const saveEditing = () => {
    if (editingFolderId && editingName.trim()) {
      onRenameFolder(editingFolderId, editingName.trim())
    }
    setEditingFolderId(null)
    setEditingName('')
  }

  return (
    <div className="space-y-1">
      {folders.map((folder) => (
        <SortableFolderItem
          key={folder.id}
          folder={folder}
          isExpanded={expandedFolders.has(folder.id)}
          isEditing={editingFolderId === folder.id}
          editingName={editingName}
          selectedDocumentId={selectedDocumentId}
          currentUser={currentUser}
          onToggle={() => toggleFolder(folder.id)}
          onStartEditing={() => startEditing(folder)}
          onEditingNameChange={setEditingName}
          onSaveEditing={saveEditing}
          onCancelEditing={() => {
            setEditingFolderId(null)
            setEditingName('')
          }}
          onSelectDocument={onSelectDocument}
          onCreateDocument={() => onCreateDocument(folder.id)}
          onDeleteFolder={() => onDeleteFolder(folder.id)}
          onDeleteDocument={(docId) => onDeleteDocument(docId, folder.id)}
        />
      ))}
    </div>
  )
}

interface SortableFolderItemProps {
  folder: Folder
  isExpanded: boolean
  isEditing: boolean
  editingName: string
  selectedDocumentId: string | null
  currentUser: {
    id: string
    name: string
    role?: string
  }
  onToggle: () => void
  onStartEditing: () => void
  onEditingNameChange: (name: string) => void
  onSaveEditing: () => void
  onCancelEditing: () => void
  onSelectDocument: (documentId: string) => void
  onCreateDocument: () => void
  onDeleteFolder: () => void
  onDeleteDocument: (documentId: string) => void
}

function SortableFolderItem({
  folder,
  isExpanded,
  isEditing,
  editingName,
  selectedDocumentId,
  currentUser,
  onToggle,
  onStartEditing,
  onEditingNameChange,
  onSaveEditing,
  onCancelEditing,
  onSelectDocument,
  onCreateDocument,
  onDeleteFolder,
  onDeleteDocument,
}: SortableFolderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50')}
    >
      {/* Folder Header */}
      <div className="group flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-muted">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </div>

        <button
          onClick={onToggle}
          className="p-0.5 hover:bg-muted-foreground/10 rounded"
        >
          <svg
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>

        {isEditing ? (
          <Input
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onBlur={onSaveEditing}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEditing()
              if (e.key === 'Escape') onCancelEditing()
            }}
            className="h-6 py-0 px-1 text-sm flex-1"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 text-sm truncate cursor-pointer"
            onDoubleClick={onStartEditing}
          >
            {folder.name}
          </span>
        )}

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCreateDocument}
            title="Add document"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartEditing}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDeleteFolder}
                className="text-destructive"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Documents */}
      {isExpanded && (
        <div className="ml-5 border-l pl-2 space-y-0.5">
          {folder.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 px-2">No documents</p>
          ) : (
            folder.documents.map((doc) => (
              <DocumentItem
                key={doc.id}
                document={doc}
                isSelected={selectedDocumentId === doc.id}
                currentUser={currentUser}
                onSelect={() => onSelectDocument(doc.id)}
                onDelete={() => onDeleteDocument(doc.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface DocumentItemProps {
  document: Document
  isSelected: boolean
  currentUser: {
    id: string
    name: string
    role?: string
  }
  onSelect: () => void
  onDelete: () => void
}

function DocumentItem({ document, isSelected, currentUser, onSelect, onDelete }: DocumentItemProps) {
  // Only owner or admin can delete
  const isOwner = document.createdById === currentUser.id
  const isAdmin = currentUser.role === 'ADMIN'
  const canDelete = isOwner || isAdmin

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
      )}
      onClick={onSelect}
    >
      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="flex-1 text-sm truncate">{document.title}</span>

      {canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
