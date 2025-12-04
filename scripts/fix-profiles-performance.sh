#!/bin/bash

# ============================================================================
# QUICK FIX: Apply Profiles Indexes to Supabase
# ============================================================================
# This script applies critical database indexes to fix profile query timeouts
# ============================================================================

echo "🚀 Applying profiles indexes migration..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if required environment variables are set
if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing required environment variables!"
    echo ""
    echo "Please set the following in your .env file:"
    echo "  EXPO_PUBLIC_SUPABASE_URL=your_supabase_url"
    echo "  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
    echo ""
    exit 1
fi

# Run the migration script
echo "📊 Applying database indexes..."
node scripts/apply-profiles-indexes.js

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Profiles table is now optimized."
    echo "💡 Profile queries should be 100-1000x faster now!"
    echo ""
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    echo ""
    exit 1
fi
