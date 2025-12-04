const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres',
  connectionTimeoutMillis: 30000
});

async function verify() {
  await client.connect();
  
  const result = await client.query(`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE indexname LIKE 'idx_%' 
    AND tablename IN ('stories', 'notifications', 'message_reactions', 'posts', 'reels', 'post_views')
    ORDER BY tablename, indexname
  `);
  
  console.log('📊 Performance indexes deployed:\n');
  result.rows.forEach(r => {
    console.log(`  ✅ ${r.tablename}: ${r.indexname}`);
  });
  
  // Check RPC function
  const rpcCheck = await client.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_name = 'get_posts_feed_optimized'
  `);
  
  console.log('\n📊 RPC Functions:\n');
  if (rpcCheck.rows.length > 0) {
    console.log('  ✅ get_posts_feed_optimized deployed');
  } else {
    console.log('  ⚠️  get_posts_feed_optimized NOT found');
  }
  
  await client.end();
  console.log('\n✅ Verification complete!');
}

verify().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
