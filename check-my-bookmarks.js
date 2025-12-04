const { Client } = require('pg');

const databaseUrl = 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres';

console.log('🔍 Checking your bookmarks in database...\n');

const client = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
});

async function checkYourBookmarks() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Get all users with bookmarks
    console.log('📊 All users with bookmarks:');
    const allBookmarks = await client.query(`
      SELECT 
        b.user_id,
        p.username,
        COUNT(*) as bookmark_count
      FROM bookmarks b
      LEFT JOIN profiles p ON p.id = b.user_id
      GROUP BY b.user_id, p.username
      ORDER BY COUNT(*) DESC;
    `);
    
    allBookmarks.rows.forEach(row => {
      console.log(`  ${row.username || 'Unknown'} (${row.user_id}): ${row.bookmark_count} bookmarks`);
    });
    
    if (allBookmarks.rows.length === 0) {
      console.log('\n⚠️  NO BOOKMARKS FOUND IN DATABASE!');
      console.log('This is the problem - you need to bookmark some posts first.');
    } else {
      // Test the function with each user
      console.log('\n\n🧪 Testing get_user_bookmarks_optimized function:');
      for (const row of allBookmarks.rows) {
        console.log(`\n  Testing for ${row.username || 'Unknown'} (${row.user_id}):`);
        const result = await client.query(`
          SELECT * FROM get_user_bookmarks_optimized($1::uuid, 5, 0);
        `, [row.user_id]);
        
        console.log(`    ✅ Function returned ${result.rows.length} bookmarks`);
        if (result.rows.length > 0) {
          const sample = result.rows[0];
          console.log(`    Sample: "${sample.post_caption?.substring(0, 30)}..." by @${sample.post_username}`);
        }
      }
    }
    
    await client.end();
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    try { await client.end(); } catch (e) {}
  }
}

checkYourBookmarks();
