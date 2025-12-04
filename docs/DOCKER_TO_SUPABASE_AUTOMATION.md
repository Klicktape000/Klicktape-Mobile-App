# 🚀 Docker to Supabase Automation System

## 📋 Overview

This automation system provides seamless deployment from your local Docker database to Supabase production. You can now make changes in Docker and automatically sync them to production with a single command!

## 🎯 Key Features

### ✅ **Automated Deployment**
- **One-click deployment** from Docker to Supabase
- **Safe deployment** with conflict handling
- **Automatic verification** of deployment success
- **Rollback capabilities** for failed deployments

### ✅ **Multiple Deployment Methods**
- **Manual deployment** with clipboard copy
- **Automatic CLI deployment** via Supabase CLI
- **CI/CD pipeline** for GitHub Actions
- **Watch mode** for continuous sync

### ✅ **Smart Synchronization**
- **Schema-only sync** for structure changes
- **Data sync** for content updates
- **Selective table sync** for specific tables
- **Profile tier sync** for mythological rankings

## 🛠️ Available Commands

### 📦 **NPM Scripts**
```bash
# Main deployment commands
npm run db:deploy              # Interactive deployment with clipboard
npm run db:deploy:auto         # Fully automated deployment

# Sync commands
npm run db:sync                # Sync schema only
npm run db:sync:data           # Sync schema + data
npm run db:sync:profile-tiers  # Sync profile tier enhancements

# Watch commands
npm run db:watch               # Watch files for changes
npm run db:watch:poll          # Poll database for changes

# Export commands
npm run db:export:schema       # Export schema from Docker
npm run db:export:data         # Export data from Docker

# Testing commands
npm run db:test:local          # Test local database connection
npm run db:verify:tiers        # Verify mythological tiers exist

# Status command
npm run db:status              # Show sync status
```

### 🔧 **Direct Script Usage**
```bash
# Auto deployment
node scripts/auto-deploy.js
node scripts/auto-deploy.js --auto

# Docker to Supabase sync
node scripts/docker-to-supabase-sync.js sync
node scripts/docker-to-supabase-sync.js sync --data
node scripts/docker-to-supabase-sync.js schema
node scripts/docker-to-supabase-sync.js data profiles posts

# Watch and sync
node scripts/watch-and-sync.js watch
node scripts/watch-and-sync.js poll 30000
node scripts/watch-and-sync.js sync
node scripts/watch-and-sync.js status

# Windows batch scripts
scripts/sync-profile-tiers.bat
```

## 🚀 Quick Start Guide

### 1. **One-Click Deployment**
```bash
npm run db:deploy
```
This will:
- ✅ Check prerequisites (Docker, Supabase container)
- ✅ Generate combined deployment script
- ✅ Copy script to clipboard
- ✅ Open Supabase SQL Editor
- ✅ Guide you through manual execution

### 2. **Fully Automated Deployment**
```bash
npm run db:deploy:auto
```
This will:
- ✅ Check prerequisites
- ✅ Generate deployment script
- ✅ Automatically deploy via Supabase CLI
- ✅ Verify deployment success

### 3. **Profile Tier Sync**
```bash
npm run db:sync:profile-tiers
```
This will:
- ✅ Export profile tier enhancements from Docker
- ✅ Generate production deployment script
- ✅ Copy to clipboard for manual execution

### 4. **Watch Mode**
```bash
npm run db:watch
```
This will:
- ✅ Monitor SQL files for changes
- ✅ Automatically sync changes to Supabase
- ✅ Provide real-time deployment feedback

## 🔧 Configuration

### Environment Variables
Ensure your `.env` file contains:
```env
EXPO_PUBLIC_SUPABASE_URL=https://wpxkjqfcoudcddluiiab.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Prerequisites
- ✅ Docker Desktop running
- ✅ Supabase container accessible (`supabase_db_klicktape`)
- ✅ Node.js 16+ installed
- ✅ Supabase CLI installed (for auto mode)

## 📊 Deployment Pipeline

### 🔄 **Automated Workflow**
```
Local Docker DB → Export Schema → Generate Script → Deploy to Supabase → Verify
```

### 🛡️ **Safety Features**
- **Conflict handling** - Safe creation with `IF NOT EXISTS`
- **Transaction safety** - Wrapped in BEGIN/COMMIT blocks
- **Verification queries** - Automatic success validation
- **Backup creation** - Optional backup before deployment
- **Rollback scripts** - Emergency rollback capabilities

## 🎯 Use Cases

### 1. **Development Workflow**
```bash
# Make changes in Docker
docker exec -it supabase_db_klicktape psql -U postgres -d postgres

# Deploy to production
npm run db:deploy
```

### 2. **Profile Tier Updates**
```bash
# Update profile tier system in Docker
# Then sync to production
npm run db:sync:profile-tiers
```

### 3. **Continuous Development**
```bash
# Start watch mode
npm run db:watch

# Make changes to SQL files
# Changes automatically sync to production
```

### 4. **CI/CD Integration**
The GitHub Actions workflow automatically:
- ✅ Validates SQL syntax
- ✅ Tests deployment in staging
- ✅ Creates production backup
- ✅ Deploys to production on main branch
- ✅ Notifies deployment status

## 📁 File Structure

```
scripts/
├── auto-deploy.js                    # Main deployment automation
├── docker-to-supabase-sync.js        # Docker sync utilities
├── watch-and-sync.js                 # File watching and auto-sync
├── sync-profile-tiers.bat            # Windows profile tier sync
├── production-deployment-safe.sql    # Safe production deployment
├── production-profile-tier-deployment.sql # Profile tier deployment
└── combined-deployment.sql           # Generated combined script

.github/workflows/
└── database-sync.yml                 # CI/CD pipeline

docs/
├── DOCKER_TO_SUPABASE_AUTOMATION.md  # This documentation
├── PROFILE_TIER_API_GUIDE.md         # Profile tier API docs
└── MYTHOLOGICAL_RANKING_API.md       # Ranking system docs
```

## 🧪 Testing

### Local Testing
```bash
# Test local database connection
npm run db:test:local

# Verify mythological tiers
npm run db:verify:tiers

# Test schema export
npm run db:export:schema

# Test deployment script generation
node scripts/auto-deploy.js --generate-only
```

### Production Testing
```bash
# Test in staging environment
npm run db:sync --staging

# Verify deployment
# Check Supabase dashboard for new tables/functions
```

## 🔍 Troubleshooting

### Common Issues

#### 1. **Docker Not Running**
```
❌ Docker is not running. Please start Docker Desktop.
```
**Solution**: Start Docker Desktop and ensure containers are running.

#### 2. **Supabase Container Not Accessible**
```
❌ Supabase container is not running or accessible.
```
**Solution**: Check container status with `docker ps` and restart if needed.

#### 3. **Missing Environment Variables**
```
❌ Missing Supabase configuration in .env file
```
**Solution**: Ensure `.env` file contains all required Supabase credentials.

#### 4. **Supabase CLI Not Found**
```
⚠️ Supabase CLI not available for auto-deployment
```
**Solution**: Install with `npm install -g supabase` or use manual deployment.

### Debug Commands
```bash
# Check Docker status
docker ps

# Check Supabase container
docker exec supabase_db_klicktape psql -U postgres -d postgres -c "SELECT 1;"

# Check environment
node -e "require('dotenv').config(); console.log(process.env.EXPO_PUBLIC_SUPABASE_URL);"

# Check sync status
npm run db:status
```

## 🎉 Success Indicators

### ✅ **Deployment Successful When:**
- All prerequisite checks pass
- Script generation completes without errors
- Supabase SQL Editor opens automatically
- Verification queries return expected results
- Mythological tiers are accessible in production

### 🏆 **Mythological Ranking System Live:**
```sql
-- Verify in Supabase SQL Editor
SELECT unnest(enum_range(NULL::rank_tier)) as mythological_tiers;

-- Should return:
-- Loki of Klicktape
-- Odin of Klicktape  
-- Poseidon of Klicktape
-- Zeus of Klicktape
-- Hercules of Klicktape
```

## 🔮 Future Enhancements

### Planned Features
- **Real-time sync** with WebSocket connections
- **Conflict resolution** for concurrent changes
- **Schema versioning** with migration history
- **Performance monitoring** for sync operations
- **Multi-environment support** (dev, staging, prod)

---

## 🎯 **Ready to Use!**

Your Docker to Supabase automation system is now fully configured and ready for use!

**Start with**: `npm run db:deploy` to deploy your mythological ranking system to production! 🚀🏆
