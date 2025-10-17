#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting production servers...');

// Start Hono server
const serverPath = path.join(__dirname, 'packages', 'server', 'dist', 'index.js');
console.log('Starting Hono server from:', serverPath);

const server = spawn('node', [serverPath], {
  cwd: path.join(__dirname, 'packages', 'server'),
  stdio: 'inherit',
  env: { ...process.env }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Wait 3 seconds for server to start
setTimeout(() => {
  console.log('Starting Next.js client...');

  // Start Next.js client
  const client = spawn('npm', ['run', 'start'], {
    cwd: path.join(__dirname, 'packages', 'client'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });

  client.on('error', (err) => {
    console.error('Failed to start client:', err);
    server.kill();
    process.exit(1);
  });

  client.on('exit', (code) => {
    console.log('Client exited with code:', code);
    server.kill();
    process.exit(code);
  });
}, 3000);

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.kill();
  process.exit(0);
});
