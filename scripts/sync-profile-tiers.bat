@echo off
REM =====================================================
REM AUTOMATED PROFILE TIER SYNC TO PRODUCTION
REM Syncs profile tier changes from Docker to Supabase
REM =====================================================

echo 🚀 Starting Profile Tier Sync to Production...
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

REM Check if Supabase container is running
docker exec supabase_db_klicktape psql -U postgres -d postgres -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Supabase Docker container is not running.
    pause
    exit /b 1
)

echo ✅ Docker and Supabase container are running
echo.

REM Export profile tier migration from Docker
echo 📋 Exporting profile tier schema from Docker...
docker exec supabase_db_klicktape pg_dump -U postgres -d postgres --schema-only -t profiles > temp_profile_schema.sql 2>nul

REM Export profile tier functions
echo 📋 Exporting profile tier functions...
docker exec supabase_db_klicktape pg_dump -U postgres -d postgres --schema-only -f /tmp/functions.sql 2>nul
docker cp supabase_db_klicktape:/tmp/functions.sql temp_functions.sql 2>nul

REM Create combined migration script
echo 📋 Creating combined migration script...
echo -- ===================================================== > production_profile_tier_sync.sql
echo -- AUTOMATED PROFILE TIER SYNC TO PRODUCTION >> production_profile_tier_sync.sql
echo -- Generated: %date% %time% >> production_profile_tier_sync.sql
echo -- ===================================================== >> production_profile_tier_sync.sql
echo. >> production_profile_tier_sync.sql

REM Add the profile tier deployment script
type scripts\production-profile-tier-deployment.sql >> production_profile_tier_sync.sql 2>nul

echo ✅ Migration script created: production_profile_tier_sync.sql
echo.

REM Copy to clipboard
echo 📋 Copying migration script to clipboard...
type production_profile_tier_sync.sql | clip
echo ✅ Migration script copied to clipboard!
echo.

REM Open Supabase dashboard
echo 🌐 Opening Supabase SQL Editor...
start https://app.supabase.com/project/wpxkjqfcoudcddluiiab/sql
echo.

echo 🎯 NEXT STEPS:
echo 1. Supabase SQL Editor should now be open in your browser
echo 2. Paste the migration script (Ctrl+V) - it's in your clipboard
echo 3. Click "Run" to deploy profile tier enhancements
echo 4. Verify the deployment with the included verification queries
echo.

echo 🏆 Profile tier sync ready for deployment!
pause
