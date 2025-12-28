import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import { ErrorBoundary } from '@/components/error-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scrumbies - Sprint Backlog',
  description: 'Sprint backlog management tool for agile teams',
  applicationName: 'Scrumbies',
  keywords: ['scrum', 'agile', 'sprint', 'backlog', 'project management', 'kanban'],
}

// Debug script to log network errors
const debugScript = `
(function() {
  // Log all fetch errors
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args)
      .then(response => {
        if (!response.ok) {
          console.error('[FETCH ERROR]', args[0], 'Status:', response.status);
        }
        return response;
      })
      .catch(error => {
        console.error('[FETCH NETWORK ERROR]', args[0], error.message);
        console.error('This could indicate:');
        console.error('- Cloudflare blocking the request');
        console.error('- CORS issue');
        console.error('- Network connectivity problem');
        throw error;
      });
  };

  // Log script loading errors
  window.addEventListener('error', function(e) {
    if (e.target && e.target.tagName === 'SCRIPT') {
      console.error('[SCRIPT LOAD ERROR]', e.target.src);
      console.error('Failed to load JavaScript file. Possible causes:');
      console.error('- File does not exist (old cached HTML referencing new files)');
      console.error('- Cloudflare blocking the request');
      console.error('- Network issue');
    }
  }, true);

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    console.error('[UNHANDLED REJECTION]', e.reason);
  });

  console.log('[DEBUG] Network error logging enabled');
  console.log('[DEBUG] Build timestamp:', new Date().toISOString());
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: debugScript }} />
      </head>
      <body>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
