// MCP Server Diagnostic Script
const { spawn } = require('child_process');

console.log('MCP Server Diagnostic');
console.log('====================');

// Set environment variables
const env = {
  ...process.env,
  POSTGRES_URL: 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres',
  MCP_TIMEOUT: '30000',
  DATABASE_TIMEOUT: '30000'
};

console.log('Environment variables:');
console.log('- POSTGRES_URL:', env.POSTGRES_URL);
console.log('- MCP_TIMEOUT:', env.MCP_TIMEOUT);
console.log('- DATABASE_TIMEOUT:', env.DATABASE_TIMEOUT);

console.log('\nStarting MCP server...');

// Spawn the MCP server process with detailed logging
const mcpServer = spawn('npm', [
  'exec',
  '@modelcontextprotocol/server-postgres',
  env.POSTGRES_URL
], {
  env: env,
  stdio: ['pipe', 'pipe', 'pipe']
});

console.log('Spawned process with PID:', mcpServer.pid);

let outputReceived = false;

// Handle stdout
mcpServer.stdout.on('data', (data) => {
  outputReceived = true;
  console.log('[STDOUT]:', data.toString());
});

// Handle stderr
mcpServer.stderr.on('data', (data) => {
  outputReceived = true;
  console.log('[STDERR]:', data.toString());
});

// Handle process exit
mcpServer.on('close', (code) => {
  console.log('[PROCESS CLOSED] Exit code:', code);
  if (!outputReceived) {
    console.log('No output received from the process. This might indicate:');
    console.log('1. The process failed to start');
    console.log('2. The process is waiting for something');
    console.log('3. There might be a permissions issue');
  }
});

// Handle process error
mcpServer.on('error', (error) => {
  console.error('[PROCESS ERROR]:', error.message);
  if (error.code === 'ENOENT') {
    console.error('The command was not found. Make sure npx/npm is in your PATH.');
  }
});

// Set a timeout to check if we're getting any output
setTimeout(() => {
  if (!outputReceived) {
    console.log('[TIMEOUT] No output received after 30 seconds.');
    console.log('Sending SIGTERM to process...');
    mcpServer.kill('SIGTERM');
  }
}, 30000);

console.log('Diagnostic script running... (timeout in 30 seconds)');