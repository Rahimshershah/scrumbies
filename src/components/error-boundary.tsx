'use client'

import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: string
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log detailed error info to console
    console.error('=== ERROR BOUNDARY CAUGHT ERROR ===')
    console.error('Error:', error.message)
    console.error('Error name:', error.name)
    console.error('Stack:', error.stack)
    console.error('Component Stack:', errorInfo.componentStack)

    // Check if it's a chunk loading error
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      console.error('=== CHUNK LOAD ERROR DETECTED ===')
      console.error('This is likely a caching issue.')
      console.error('The HTML references JavaScript files that cannot be loaded.')
      console.error('Possible causes:')
      console.error('1. Cloudflare is caching old HTML')
      console.error('2. Browser cache has stale content')
      console.error('3. CDN/proxy is serving mismatched files')
    }

    this.setState({
      errorInfo: `${error.name}: ${error.message}\n\nStack: ${error.stack}\n\nComponent: ${errorInfo.componentStack}`
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              An error occurred while loading the application.
            </p>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="font-mono text-sm text-red-800 dark:text-red-300">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
            </div>

            {this.state.error?.name === 'ChunkLoadError' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <p className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                  Possible Causes:
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                  <li>Cloudflare or CDN serving cached/stale files</li>
                  <li>Browser cache needs to be cleared</li>
                  <li>Network issue loading JavaScript files</li>
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Clear caches and reload
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      names.forEach(name => caches.delete(name))
                    })
                  }
                  window.location.reload()
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Clear Cache & Reload
              </button>
              <button
                onClick={() => window.location.href = '/login'}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Go to Login
              </button>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Technical Details (for debugging)
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-64">
                {this.state.errorInfo}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
