const { Client } = require('pg');

const databaseUrl = 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres';

console.log('🔍 Checking user ID for "joyin"...\n');

const client = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
});

async function checkJoyinUserId() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Get joyin's user details
    const userResult = await client.query(`
      SELECT id, username, email
      FROM profiles
      WHERE username = 'joyin';
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User "joyin" not found!');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('👤 User "joyin" details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    
    // Get bookmarks for this user
    const bookmarksResult = await client.query(`
      SELECT COUNT(*) as count
      FROM bookmarks
      WHERE user_id = $1;
    `, [user.id]);
    
    console.log(`\n📚 Bookmarks for joyin: ${bookmarksResult.rows[0].count}`);
    
    // Test the RPC function with this exact user ID
    console.log(`\n🧪 Testing RPC function with user ID: ${user.id}`);
    const rpcResult = await client.query(`
      SELECT * FROM get_user_bookmarks_optimized($1::uuid, 12, 0);
    `, [user.id]);
    
    console.log(`✅ RPC returned ${rpcResult.rows.length} bookmarks`);
    
    if (rpcResult.rows.length > 0) {
      console.log('\n📋 Sample bookmarks:');
      rpcResult.rows.slice(0, 3).forEach((b, i) => {
        console.log(`   ${i+1}. Post ID: ${b.post_id}`);
        console.log(`      Caption: ${b.post_caption?.substring(0, 30) || 'No caption'}...`);
        console.log(`      By: @${b.post_username}`);
        console.log(`      Images: ${b.post_image_urls?.length || 0}`);
      });
    }
    
    console.log('\n✅ For your React app, make sure you use this EXACT user ID:');
    console.log(`   ${user.id}`);
    
    await client.end();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    try { await client.end(); } catch (e) {}
  }
}

checkJoyinUserId();
