const { Client } = require('pg');

// Your database connection URL
// Note: We need to properly encode special characters in the password
const databaseUrl = 'postgresql://postgres:joyin@2000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres';

// Properly encode the URL
const encodedUrl = databaseUrl.replace(
  'joyin@2000JOYIN', 
  encodeURIComponent('joyin@2000JOYIN')
);

console.log('Testing database connection...');
console.log('Encoded URL:', encodedUrl);

const client = new Client({
  connectionString: encodedUrl,
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
    }
  }
}

testConnection();