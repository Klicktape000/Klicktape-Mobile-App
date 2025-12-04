// MCP Server Test Script
const { spawn } = require('child_process');

// Set environment variables
process.env.POSTGRES_URL = 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres';
process.env.MCP_TIMEOUT = '30000';
process.env.DATABASE_TIMEOUT = '30000';

console.log('Starting MCP Postgres server with:');
console.log('- POSTGRES_URL:', process.env.POSTGRES_URL);
console.log('- MCP_TIMEOUT:', process.env.MCP_TIMEOUT);
console.log('- DATABASE_TIMEOUT:', process.env.DATABASE_TIMEOUT);

// Spawn the MCP server process
const mcpServer = spawn('npx', [
  '-y',
  '@modelcontextprotocol/server-postgres'
], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe']
});

console.log('\nSpawned MCP server process with PID:', mcpServer.pid);

// Handle stdout
mcpServer.stdout.on('data', (data) => {
  console.log('[MCP Server STDOUT]:', data.toString());
});

// Handle stderr
mcpServer.stderr.on('data', (data) => {
  console.log('[MCP Server STDERR]:', data.toString());
});

// Handle process exit
mcpServer.on('close', (code) => {
  console.log('[MCP Server] Process exited with code:', code);
});

// Handle process error
mcpServer.on('error', (error) => {
  console.error('[MCP Server] Failed to start process:', error.message);
});

// Set a timeout to kill the process if it takes too long
setTimeout(() => {
  console.log('[TEST] Timeout reached. Killing MCP server process...');
  mcpServer.kill('SIGTERM');
}, 45000); // 45 seconds timeout