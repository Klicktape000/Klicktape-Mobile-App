// MCP Server Configuration
// This file sets up the proper environment for the MCP Postgres server

const { spawn } = require('child_process');

// Properly formatted connection URL with encoded credentials
const DATABASE_URL = 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres';

// Spawn the MCP server with proper environment variables
const mcpProcess = spawn('npx', [
  '@modelcontextprotocol/server-postgres',
  DATABASE_URL  // Pass the URL as a command line argument
], {
  env: {
    ...process.env,
    // Increase timeout values
    MCP_TIMEOUT: '30000', // 30 seconds
    DATABASE_TIMEOUT: '30000'
  },
  stdio: 'inherit'
});

mcpProcess.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
});

mcpProcess.on('close', (code) => {
  console.log(`MCP server process exited with code ${code}`);
});

console.log('Starting MCP Postgres server with URL:', DATABASE_URL);