#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting production servers...');
console.log('Render PORT:', process.env.PORT || 'not set');

// Store the original PORT for Next.js (Render's public port, usually 10000)
const publicPort = process.env.PORT || '3000';
const internalPort = '3001';

// Start Hono server
const serverPath = path.join(__dirname, 'packages', 'server', 'dist', 'node-server.js');
console.log(`Starting Hono server on internal port ${internalPort}...`);

// Run Hono server on internal port 3001
const serverEnv = { ...process.env, PORT: internalPort };
const server = spawn('node', [serverPath], {
  cwd: path.join(__dirname, 'packages', 'server'),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: serverEnv
});

server.stdout.on('data', (data) => {
  console.log(`[Hono] ${data.toString().trim()}`);
});

server.stderr.on('data', (data) => {
  console.error(`[Hono Error] ${data.toString().trim()}`);
});

server.on('error', (err) => {
  console.error('Failed to start Hono server:', err);
  process.exit(1);
});

// Wait 3 seconds for server to start
setTimeout(() => {
  console.log(`Starting Next.js client on public port ${publicPort}...`);

  // Start Next.js client with the original public PORT
  const clientEnv = { ...process.env, PORT: publicPort };
  const client = spawn('npm', ['run', 'start'], {
    cwd: path.join(__dirname, 'packages', 'client'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: clientEnv
  });

  client.stdout.on('data', (data) => {
    console.log(`[Next.js] ${data.toString().trim()}`);
  });

  client.stderr.on('data', (data) => {
    console.error(`[Next.js Error] ${data.toString().trim()}`);
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
