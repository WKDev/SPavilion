/**
 * S-Pavilion NestJS Backend Service
 *
 * This file is executed by the Windows Service.
 * It runs the NestJS production server.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(60));
console.log('S-Pavilion NestJS Backend Service');
console.log('='.repeat(60));
console.log('');
console.log('Starting NestJS production server...');
console.log(`Working directory: ${__dirname}`);
console.log(`Node version: ${process.version}`);
console.log('');

// Change to the nest directory
process.chdir(__dirname);

// Start NestJS production server
const child = spawn('npm', ['run', 'start:prod'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ENABLE_PROXY: 'true', // Enable proxy to Next.js server (port 3001)
  },
});

child.on('error', (error) => {
  console.error('Failed to start NestJS server:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`NestJS server exited with code ${code}`);
  }
  if (signal) {
    console.error(`NestJS server was killed with signal ${signal}`);
  }
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  child.kill('SIGINT');
});
