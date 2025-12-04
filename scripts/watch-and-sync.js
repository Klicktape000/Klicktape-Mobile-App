#!/usr/bin/env node

/**
 * Watch and Sync Service
 * Monitors Docker database changes and auto-syncs to Supabase
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chokidar = require('chokidar');
require('dotenv').config();

class WatchAndSync {
    constructor() {
        this.isWatching = false;
        this.lastSyncTime = Date.now();
        this.syncCooldown = 30000; // 30 seconds between syncs
        this.watchedFiles = [
            'sql/**/*.sql',
            'migrations/**/*.sql',
            'scripts/**/*.sql'
        ];
        this.projectRef = this.extractProjectRef();
    }

    extractProjectRef() {
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!url) return null;
        const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
        return match ? match[1] : null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const icons = {
            info: '📋',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            watch: '👁️',
            sync: '🔄'
        };
        console.log(`${icons[type]} [${timestamp}] ${message}`);
    }

    async checkDockerChanges() {
        try {
            // Get last modification time of Docker database
            const result = execSync(
                'docker exec supabase_db_klicktape psql -U postgres -d postgres -t -c "SELECT pg_stat_file(\'base/1/PG_VERSION\').modification;"',
                { encoding: 'utf8', stdio: 'pipe' }
            );
            
            const dbModTime = new Date(result.trim()).getTime();
            return dbModTime;
        } catch (error) {
            this.log(`Failed to check Docker changes: ${error.message}`, 'error');
            return null;
        }
    }

    async exportCurrentSchema() {
        this.log('Exporting current schema from Docker...', 'sync');
        
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportFile = `exports/schema_${timestamp}.sql`;
            
            // Ensure exports directory exists
            if (!fs.existsSync('exports')) {
                fs.mkdirSync('exports', { recursive: true });
            }
            
            // Export schema
            const schema = execSync(
                'docker exec supabase_db_klicktape pg_dump -U postgres -d postgres --schema-only --no-owner --no-privileges',
                { encoding: 'utf8', stdio: 'pipe' }
            );
            
            fs.writeFileSync(exportFile, schema);
            this.log(`Schema exported to ${exportFile}`, 'success');
            
            return exportFile;
        } catch (error) {
            this.log(`Schema export failed: ${error.message}`, 'error');
            return null;
        }
    }

    async syncToSupabase() {
        const now = Date.now();
        if (now - this.lastSyncTime < this.syncCooldown) {
            this.log('Sync cooldown active, skipping...', 'warning');
            return;
        }

        this.log('Starting sync to Supabase...', 'sync');
        this.lastSyncTime = now;

        try {
            // Export current schema
            const schemaFile = await this.exportCurrentSchema();
            if (!schemaFile) return;

            // Create deployment script
            const deploymentScript = this.createDeploymentScript(schemaFile);
            
            // Try automatic deployment
            const success = await this.deployAutomatically(deploymentScript);
            
            if (success) {
                this.log('Sync completed successfully!', 'success');
            } else {
                this.log('Automatic sync failed, manual intervention required', 'warning');
            }

        } catch (error) {
            this.log(`Sync failed: ${error.message}`, 'error');
        }
    }

    createDeploymentScript(schemaFile) {
        const timestamp = new Date().toISOString();
        const schemaContent = fs.readFileSync(schemaFile, 'utf8');
        
        const deploymentContent = `-- =====================================================
-- AUTOMATED SYNC FROM DOCKER TO SUPABASE
-- Generated: ${timestamp}
-- Source: ${schemaFile}
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Begin safe deployment
BEGIN;

${schemaContent}

-- Commit changes
COMMIT;

-- Verification
SELECT 'Automated sync completed successfully!' as status;
SELECT COUNT(*) as total_tables FROM pg_tables WHERE schemaname = 'public';
`;

        const deploymentFile = `exports/deployment_${Date.now()}.sql`;
        fs.writeFileSync(deploymentFile, deploymentContent);
        
        return deploymentFile;
    }

    async deployAutomatically(scriptPath) {
        try {
            // Check if Supabase CLI is available
            try {
                execSync('npx supabase --version', { stdio: 'pipe' });
            } catch {
                this.log('Supabase CLI not available for auto-deployment', 'warning');
                return false;
            }

            // Execute deployment
            const scriptContent = fs.readFileSync(scriptPath, 'utf8');
            const tempFile = 'temp_auto_sync.sql';
            fs.writeFileSync(tempFile, scriptContent);

            execSync(`npx supabase db push --file ${tempFile}`, {
                stdio: 'pipe'
            });

            // Cleanup
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }

            return true;

        } catch (error) {
            this.log(`Auto-deployment failed: ${error.message}`, 'error');
            return false;
        }
    }

    startWatching() {
        if (this.isWatching) {
            this.log('Already watching for changes', 'warning');
            return;
        }

        this.log('Starting file watcher...', 'watch');
        this.isWatching = true;

        // Watch SQL files for changes
        const watcher = chokidar.watch(this.watchedFiles, {
            ignored: /node_modules/,
            persistent: true,
            ignoreInitial: true
        });

        watcher.on('change', (filePath) => {
            this.log(`File changed: ${filePath}`, 'watch');
            this.syncToSupabase();
        });

        watcher.on('add', (filePath) => {
            this.log(`File added: ${filePath}`, 'watch');
            this.syncToSupabase();
        });

        watcher.on('error', (error) => {
            this.log(`Watcher error: ${error.message}`, 'error');
        });

        this.log('File watcher started. Monitoring SQL files for changes...', 'success');
        this.log('Press Ctrl+C to stop watching', 'info');

        // Keep the process alive
        process.on('SIGINT', () => {
            this.log('Stopping file watcher...', 'info');
            watcher.close();
            process.exit(0);
        });
    }

    async startDatabasePolling(interval = 60000) {
        this.log(`Starting database polling (every ${interval/1000}s)...`, 'watch');
        
        let lastDbModTime = await this.checkDockerChanges();
        
        const pollInterval = setInterval(async () => {
            const currentDbModTime = await this.checkDockerChanges();
            
            if (currentDbModTime && currentDbModTime > lastDbModTime) {
                this.log('Database changes detected!', 'watch');
                lastDbModTime = currentDbModTime;
                await this.syncToSupabase();
            }
        }, interval);

        this.log('Database polling started', 'success');
        
        process.on('SIGINT', () => {
            this.log('Stopping database polling...', 'info');
            clearInterval(pollInterval);
            process.exit(0);
        });
    }

    async manualSync() {
        this.log('Starting manual sync...', 'sync');
        await this.syncToSupabase();
    }

    showStatus() {
        this.log('=== Watch and Sync Status ===', 'info');
        this.log(`Project: ${this.projectRef || 'Not configured'}`, 'info');
        this.log(`Watching: ${this.isWatching ? 'Active' : 'Inactive'}`, 'info');
        this.log(`Last sync: ${new Date(this.lastSyncTime).toISOString()}`, 'info');
        this.log(`Cooldown: ${this.syncCooldown/1000}s`, 'info');
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const watcher = new WatchAndSync();
    
    switch (command) {
        case 'watch':
            watcher.startWatching();
            break;
            
        case 'poll':
            const interval = parseInt(args[1]) || 60000;
            watcher.startDatabasePolling(interval);
            break;
            
        case 'sync':
            watcher.manualSync();
            break;
            
        case 'status':
            watcher.showStatus();
            break;
            
        default:
            console.log(`
👁️ Watch and Sync Service

Usage:
  node watch-and-sync.js <command> [options]

Commands:
  watch                    Watch SQL files for changes
  poll [interval]         Poll database for changes (default: 60s)
  sync                    Manual sync to Supabase
  status                  Show current status

Examples:
  node watch-and-sync.js watch
  node watch-and-sync.js poll 30000
  node watch-and-sync.js sync
            `);
    }
}

module.exports = WatchAndSync;
