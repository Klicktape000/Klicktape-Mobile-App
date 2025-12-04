const { Client } = require('pg');

// Database connection URL from MCP config
const databaseUrl = 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres';

console.log('🧪 Testing get_user_bookmarks_optimized function...\n');

const client = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
});

async function testBookmarksFunction() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');
    
    // First, let's check if there are any bookmarks in the database
    console.log('📊 Checking bookmarks table...');
    const countResult = await client.query(`
      SELECT 
        user_id,
        COUNT(*) as bookmark_count
      FROM bookmarks
      GROUP BY user_id
      ORDER BY COUNT(*) DESC
      LIMIT 5;
    `);
    
    if (countResult.rows.length === 0) {
      console.log('⚠️  No bookmarks found in database');
      console.log('   This might be why bookmarks aren\'t showing');
    } else {
      console.log('✅ Found bookmarks for', countResult.rows.length, 'users:');
      countResult.rows.forEach(row => {
        console.log(`   User ${row.user_id}: ${row.bookmark_count} bookmarks`);
      });
      
      // Test the function with the first user
      const testUserId = countResult.rows[0].user_id;
      console.log(`\n🧪 Testing function with user: ${testUserId}`);
      
      const functionResult = await client.query(`
        SELECT * FROM get_user_bookmarks_optimized($1::uuid, 10, 0);
      `, [testUserId]);
      
      console.log(`✅ Function returned ${functionResult.rows.length} bookmarks`);
      
      if (functionResult.rows.length > 0) {
        console.log('\n📋 Sample bookmark data:');
        const sample = functionResult.rows[0];
        console.log('   Post ID:', sample.post_id);
        console.log('   Caption:', sample.post_caption?.substring(0, 50) + '...');
        console.log('   Username:', sample.post_username);
        console.log('   Images:', sample.post_image_urls?.length || 0);
      }
    }
    
    await client.end();
    console.log('\n✅ Test completed!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    
    try {
      await client.end();
    } catch (e) {}
    
    return false;
  }
}

testBookmarksFunction().then(success => {
  process.exit(success ? 0 : 1);
});
