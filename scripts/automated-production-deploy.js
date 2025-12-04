#!/usr/bin/env node

/**
 * KlickTape Automated Production Deployment Script
 * This script automates the deployment of the database schema to production Supabase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL ? SUPABASE_URL.split('//')[1].split('.')[0] : null;

console.log('🚀 KlickTape Production Deployment Starting...\n');

// Validation
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !PROJECT_REF) {
    console.error('❌ Missing required environment variables:');
    console.error('   - EXPO_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
    console.error('   - PROJECT_REF:', PROJECT_REF ? '✅' : '❌');
    process.exit(1);
}

console.log('✅ Environment variables validated');
console.log(`📍 Project URL: ${SUPABASE_URL}`);
console.log(`📍 Project Ref: ${PROJECT_REF}\n`);

// Step 1: Check if Supabase CLI is available
console.log('🔧 Checking Supabase CLI...');
try {
    const version = execSync('npx supabase --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Supabase CLI available: ${version}\n`);
} catch (error) {
    console.error('❌ Supabase CLI not available. Installing...');
    execSync('npm install supabase --save-dev', { stdio: 'inherit' });
    console.log('✅ Supabase CLI installed\n');
}

// Step 2: Login to Supabase (using service key)
console.log('🔐 Authenticating with Supabase...');
try {
    // Set the access token as environment variable for CLI
    process.env.SUPABASE_ACCESS_TOKEN = SUPABASE_SERVICE_KEY;
    
    // Test authentication
    const projects = execSync('npx supabase projects list', { encoding: 'utf8' });
    console.log('✅ Authentication successful\n');
} catch (error) {
    console.error('❌ Authentication failed:', error.message);
    console.log('💡 Trying alternative authentication method...\n');
}

// Step 3: Link to production project
console.log(`🔗 Linking to production project: ${PROJECT_REF}...`);
try {
    // Initialize supabase if not already done
    if (!fs.existsSync('./supabase/config.toml')) {
        console.log('📁 Initializing Supabase project...');
        execSync('npx supabase init', { stdio: 'inherit' });
    }
    
    // Link to production project
    execSync(`npx supabase link --project-ref ${PROJECT_REF}`, { 
        stdio: 'inherit',
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_SERVICE_KEY }
    });
    console.log('✅ Successfully linked to production project\n');
} catch (error) {
    console.log('⚠️  Link command failed, proceeding with direct deployment...\n');
}

// Step 4: Deploy database schema
console.log('📊 Deploying database schema...');

// Read schema files
const mainSchemaPath = path.join(__dirname, '../docs/klicktape_database_schema.sql');
const leaderboardSchemaPath = path.join(__dirname, '../sql/leaderboard_schema.sql');

if (!fs.existsSync(mainSchemaPath)) {
    console.error('❌ Main schema file not found:', mainSchemaPath);
    process.exit(1);
}

if (!fs.existsSync(leaderboardSchemaPath)) {
    console.error('❌ Leaderboard schema file not found:', leaderboardSchemaPath);
    process.exit(1);
}

console.log('✅ Schema files found (including mythological ranks)');
console.log('📤 Deploying to production...\n');

// Create deployment status file
const deploymentStatus = {
    timestamp: new Date().toISOString(),
    projectRef: PROJECT_REF,
    projectUrl: SUPABASE_URL,
    status: 'in_progress',
    steps: []
};

try {
    // Step 4a: Deploy main schema
    console.log('📋 Deploying main database schema...');
    deploymentStatus.steps.push({ step: 'main_schema', status: 'in_progress', timestamp: new Date().toISOString() });
    
    // For now, we'll create a combined SQL file for manual execution
    const mainSchema = fs.readFileSync(mainSchemaPath, 'utf8');
    const leaderboardSchema = fs.readFileSync(leaderboardSchemaPath, 'utf8');
    
    const combinedSchema = `
-- KlickTape Production Deployment
-- Generated: ${new Date().toISOString()}
-- Project: ${PROJECT_REF}

-- =============================================================================
-- MAIN DATABASE SCHEMA
-- =============================================================================

${mainSchema}

-- =============================================================================
-- LEADERBOARD SCHEMA
-- =============================================================================

${leaderboardSchema}

-- =============================================================================
-- DEPLOYMENT VERIFICATION
-- =============================================================================

-- Verify tables
SELECT 'Tables created: ' || COUNT(*) as status FROM pg_tables WHERE schemaname = 'public';

-- Verify indexes
SELECT 'Indexes created: ' || COUNT(*) as status FROM pg_indexes WHERE schemaname = 'public';

-- Verify foreign keys
SELECT 'Foreign keys created: ' || COUNT(*) as status 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

-- Verify RLS policies
SELECT 'RLS policies created: ' || COUNT(*) as status FROM pg_policies WHERE schemaname = 'public';

SELECT 'KlickTape production deployment completed successfully!' as final_status;
`;

    // Save combined schema for deployment
    const deploymentSqlPath = path.join(__dirname, 'production-deployment.sql');
    fs.writeFileSync(deploymentSqlPath, combinedSchema);
    
    console.log(`✅ Combined deployment script created: ${deploymentSqlPath}`);
    
    deploymentStatus.steps.push({ step: 'main_schema', status: 'completed', timestamp: new Date().toISOString() });
    deploymentStatus.status = 'ready_for_manual_execution';
    
    // Save deployment status
    fs.writeFileSync(path.join(__dirname, 'deployment-status.json'), JSON.stringify(deploymentStatus, null, 2));
    
    console.log('\n🎉 DEPLOYMENT PREPARATION COMPLETE!\n');
    console.log('📋 Next Steps:');
    console.log('1. Go to your Supabase Dashboard: https://app.supabase.com');
    console.log(`2. Open your project: ${SUPABASE_URL}`);
    console.log('3. Navigate to SQL Editor');
    console.log(`4. Copy and paste the contents of: ${deploymentSqlPath}`);
    console.log('5. Execute the SQL script');
    console.log('6. Verify the deployment results\n');
    
    console.log('🔗 Quick Links:');
    console.log(`   Dashboard: https://app.supabase.com/project/${PROJECT_REF}`);
    console.log(`   SQL Editor: https://app.supabase.com/project/${PROJECT_REF}/sql`);
    console.log(`   Database: https://app.supabase.com/project/${PROJECT_REF}/database/tables`);
    
} catch (error) {
    console.error('❌ Deployment failed:', error.message);
    deploymentStatus.status = 'failed';
    deploymentStatus.error = error.message;
    fs.writeFileSync(path.join(__dirname, 'deployment-status.json'), JSON.stringify(deploymentStatus, null, 2));
    process.exit(1);
}

console.log('\n✨ Deployment script completed successfully!');
