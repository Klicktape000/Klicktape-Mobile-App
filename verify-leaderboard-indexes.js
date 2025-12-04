const { Client } = require('pg');

const databaseUrl = 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres';

console.log('🔍 Checking leaderboard indexes...\n');

const client = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
});

async function verifyIndexes() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check for critical leaderboard indexes
    const indexQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('leaderboard_rankings', 'leaderboard_periods', 'leaderboard_rewards')
      ORDER BY tablename, indexname;
    `;
    
    const result = await client.query(indexQuery);
    
    console.log('📊 Leaderboard Indexes Found:', result.rows.length);
    console.log('\n');
    
    const requiredIndexes = [
      'idx_leaderboard_rankings_period_rank',
      'idx_leaderboard_rankings_user',
      'idx_leaderboard_periods_active'
    ];
    
    const foundIndexes = result.rows.map(row => row.indexname);
    
    requiredIndexes.forEach(indexName => {
      if (foundIndexes.includes(indexName)) {
        console.log(`✅ ${indexName}`);
      } else {
        console.log(`❌ MISSING: ${indexName}`);
      }
    });
    
    console.log('\n📋 All indexes:');
    result.rows.forEach(row => {
      console.log(`   ${row.tablename}.${row.indexname}`);
    });
    
    await client.end();
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

verifyIndexes();
