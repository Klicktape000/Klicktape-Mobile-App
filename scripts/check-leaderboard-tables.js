const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:joyin%402000JOYIN@db.wpxkjqfcoudcddluiiab.supabase.co:5432/postgres',
  connectionTimeoutMillis: 30000
});

async function checkTables() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check RPC functions
    const { rows: functions } = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name IN ('get_current_leaderboard', 'get_user_leaderboard_stats', 'get_current_leaderboard_period')
    `);
    console.log('📊 Leaderboard RPC Functions:', functions);

    // Check tables
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('leaderboard_rankings', 'leaderboard_periods', 'referrals', 'referral_codes', 'referral_dashboard')
    `);
    console.log('📋 Tables:', tables);

    // Check if referral_dashboard is a view
    const { rows: views } = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name = 'referral_dashboard'
    `);
    console.log('👁️ Views:', views);

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();
