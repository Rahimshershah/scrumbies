// PM2 process definition for Scrumbies.
//
// IMPORTANT: this runs the real Node server (server.js) DIRECTLY, instead of the
// old `pm2 start npm -- start`. Previously PM2 monitored the `npm` wrapper process
// and never saw the actual Next.js server (its grandchild) crash — so crashes left
// nothing listening on :3000 and nginx returned 502s. Running server.js directly
// means PM2 monitors the real server, restarts it on crash, and enforces the
// memory ceiling below. server.js also hosts the Socket.IO real-time layer.
module.exports = {
  apps: [
    {
      name: 'scrumbies',
      script: 'server.js',
      cwd: '/var/www/scrumbies',
      instances: 1, // single instance keeps the in-process Socket.IO rooms valid
      exec_mode: 'fork',
      max_memory_restart: '600M', // now applies to the REAL server process
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Pin the uploads dir. Without this, getUploadsDir() in src/lib/utils.ts
        // sees this custom server.js and misfires into "standalone mode" → writes
        // to /var/www/uploads (root-owned, unwritable) and every upload 500s.
        // Point it at the existing writable public/uploads where files already live.
        UPLOADS_DIR: '/var/www/scrumbies/public/uploads',
      },
    },
  ],
}
