const { Client } = require('pg');

// Test the exact URL from our MCP configuration
const databaseUrl = 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres';

console.log('Testing database connection with URL from MCP config...');
console.log('URL:', databaseUrl);

const client = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 30000, // 30 seconds
  query_timeout: 30000, // 30 seconds
});

async function testConnection() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Successfully connected to the database!');
    
    // Run a simple query to verify
    const result = await client.query('SELECT version();');
    console.log('Database version:', result.rows[0].version);
    
    await client.end();
    console.log('✅ Connection test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    
    // Specific error handling
    if (error.code === 'ECONNREFUSED') {
      console.error('🔧 Connection refused. Check if the database is running and accessible.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('🔧 Host not found. Check your database URL.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('🔧 Connection timed out. Check your network/firewall settings.');
    } else if (error.code === '08006') {
      console.error('🔧 Database connection failed. Check credentials and database status.');
    }
    
    return false;
  }
}

// Run the test
testConnection().then(success => {
  if (success) {
    console.log('\n🎉 Database connection test PASSED');
  } else {
    console.log('\n💥 Database connection test FAILED');
    process.exit(1);
  }
});