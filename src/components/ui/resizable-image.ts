import Image from '@tiptap/extension-image'

/**
 * Image extension with drag-to-resize.
 *
 * Adds a persisted `width` attribute (rendered as the <img width> attribute so it
 * survives save/reload and shows in the read-only renderer) and a NodeView that
 * draws a small handle at the bottom-right corner. Dragging the handle resizes the
 * image width; the handle is hidden when the editor is not editable.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('width'),
        renderHTML: (attributes: { width?: string | number | null }) => {
          if (!attributes.width) return {}
          return { width: attributes.width }
        },
      },
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }: any) => {
      const wrapper = document.createElement('div')
      wrapper.style.position = 'relative'
      wrapper.style.display = 'inline-block'
      wrapper.style.maxWidth = '100%'
      wrapper.style.lineHeight = '0'

      const img = document.createElement('img')
      img.src = node.attrs.src
      if (node.attrs.alt) img.alt = node.attrs.alt
      img.className = 'rounded-md border my-2'
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      img.style.display = 'block'
      const applyWidth = (w: any) => {
        if (w) img.style.width = typeof w === 'number' ? `${w}px` : String(w).endsWith('px') || String(w).endsWith('%') ? String(w) : `${w}px`
      }
      applyWidth(node.attrs.width)
      wrapper.appendChild(img)

      const handle = document.createElement('div')
      handle.style.position = 'absolute'
      handle.style.right = '4px'
      handle.style.bottom = '8px'
      handle.style.width = '12px'
      handle.style.height = '12px'
      handle.style.borderRadius = '3px'
      handle.style.background = 'rgba(0,0,0,0.55)'
      handle.style.border = '2px solid white'
      handle.style.cursor = 'nwse-resize'
      handle.style.boxSizing = 'border-box'
      handle.style.display = editor.isEditable ? 'block' : 'none'
      wrapper.appendChild(handle)

      let startX = 0
      let startW = 0

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX
        const newW = Math.max(40, Math.round(startW + dx))
        img.style.width = `${newW}px`
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        const finalW = img.offsetWidth
        if (typeof getPos === 'function') {
          editor
            .chain()
            .command(({ tr }: any) => {
              tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, width: finalW })
              return true
            })
            .run()
        }
      }

      handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        startX = e.clientX
        startW = img.offsetWidth
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      })

      return {
        dom: wrapper,
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== node.type.name) return false
          img.src = updatedNode.attrs.src
          if (updatedNode.attrs.alt) img.alt = updatedNode.attrs.alt
          applyWidth(updatedNode.attrs.width)
          handle.style.display = editor.isEditable ? 'block' : 'none'
          return true
        },
      }
    }
  },
})
