#!/usr/bin/env node

/**
 * Docker to Supabase Automated Deployment Pipeline
 * Syncs database changes from local Docker to Supabase production
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
require('dotenv').config();

// Get __dirname equivalent for ES modules compatibility
const __filename = fileURLToPath(import.meta.url || 'file://' + __filename);
const __dirname = path.dirname(__filename);

class DockerToSupabaseSync {
    constructor() {
        this.dockerContainer = 'supabase_db_klicktape';
        this.tempDir = path.join(__dirname, 'temp');
        this.supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        this.projectRef = this.extractProjectRef();
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    extractProjectRef() {
        if (!this.supabaseUrl) {
            throw new Error('EXPO_PUBLIC_SUPABASE_URL not found in environment');
        }
        const match = this.supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
        return match ? match[1] : null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '📋',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[type];
        
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async executeDockerCommand(command) {
        try {
            const result = execSync(
                `docker exec ${this.dockerContainer} ${command}`,
                { encoding: 'utf8', stdio: 'pipe' }
            );
            return result.trim();
        } catch (error) {
            throw new Error(`Docker command failed: ${error.message}`);
        }
    }

    async exportDockerSchema() {
        this.log('Exporting schema from Docker database...');
        
        const schemaFile = path.join(this.tempDir, 'docker_schema.sql');
        
        try {
            // Export schema only (no data)
            const command = `pg_dump -U postgres -d postgres --schema-only --no-owner --no-privileges`;
            const schema = await this.executeDockerCommand(command);
            
            fs.writeFileSync(schemaFile, schema);
            this.log(`Schema exported to ${schemaFile}`, 'success');
            
            return schemaFile;
        } catch (error) {
            this.log(`Failed to export schema: ${error.message}`, 'error');
            throw error;
        }
    }

    async exportDockerData(tables = []) {
        this.log('Exporting data from Docker database...');
        
        const dataFile = path.join(this.tempDir, 'docker_data.sql');
        
        try {
            let command = `pg_dump -U postgres -d postgres --data-only --no-owner --no-privileges`;
            
            if (tables.length > 0) {
                const tableArgs = tables.map(table => `-t ${table}`).join(' ');
                command += ` ${tableArgs}`;
            }
            
            const data = await this.executeDockerCommand(command);
            fs.writeFileSync(dataFile, data);
            
            this.log(`Data exported to ${dataFile}`, 'success');
            return dataFile;
        } catch (error) {
            this.log(`Failed to export data: ${error.message}`, 'error');
            throw error;
        }
    }

    async generateMigrationScript() {
        this.log('Generating migration script...');
        
        const migrationFile = path.join(this.tempDir, 'auto_migration.sql');
        
        try {
            // Get current schema differences
            const currentSchema = await this.exportDockerSchema();
            const schemaContent = fs.readFileSync(currentSchema, 'utf8');
            
            // Create a safe migration script
            const migrationContent = `
-- =====================================================
-- AUTOMATED MIGRATION FROM DOCKER TO SUPABASE
-- Generated: ${new Date().toISOString()}
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Begin transaction for safety
BEGIN;

${schemaContent}

-- Commit transaction
COMMIT;

-- Verification queries
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as total_tables FROM pg_tables WHERE schemaname = 'public';
SELECT COUNT(*) as total_functions FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
`;

            fs.writeFileSync(migrationFile, migrationContent);
            this.log(`Migration script generated: ${migrationFile}`, 'success');
            
            return migrationFile;
        } catch (error) {
            this.log(`Failed to generate migration: ${error.message}`, 'error');
            throw error;
        }
    }

    async deployToSupabase(migrationFile) {
        this.log('Deploying to Supabase production...');
        
        try {
            // Read migration content
            const migrationContent = fs.readFileSync(migrationFile, 'utf8');
            
            // Use Supabase API to execute SQL
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'apikey': this.supabaseKey
                },
                body: JSON.stringify({
                    sql: migrationContent
                })
            });

            if (!response.ok) {
                throw new Error(`Supabase API error: ${response.statusText}`);
            }

            const result = await response.json();
            this.log('Successfully deployed to Supabase!', 'success');
            
            return result;
        } catch (error) {
            this.log(`Deployment failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async deployViaSupabaseCLI(migrationFile) {
        this.log('Deploying via Supabase CLI...');
        
        try {
            // Check if Supabase CLI is available
            try {
                execSync('npx supabase --version', { stdio: 'pipe' });
            } catch {
                this.log('Installing Supabase CLI...', 'warning');
                execSync('npm install -g supabase', { stdio: 'inherit' });
            }

            // Link to project if not already linked
            try {
                execSync(`npx supabase link --project-ref ${this.projectRef}`, { 
                    stdio: 'pipe',
                    cwd: process.cwd()
                });
                this.log('Linked to Supabase project', 'success');
            } catch (error) {
                this.log('Project already linked or link failed', 'warning');
            }

            // Execute migration via CLI
            const migrationContent = fs.readFileSync(migrationFile, 'utf8');
            const tempSqlFile = path.join(this.tempDir, 'cli_migration.sql');
            fs.writeFileSync(tempSqlFile, migrationContent);

            execSync(`npx supabase db push --file ${tempSqlFile}`, {
                stdio: 'inherit',
                cwd: process.cwd()
            });

            this.log('Successfully deployed via Supabase CLI!', 'success');
        } catch (error) {
            this.log(`CLI deployment failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async syncSpecificTables(tables) {
        this.log(`Syncing specific tables: ${tables.join(', ')}`);
        
        try {
            for (const table of tables) {
                this.log(`Syncing table: ${table}`);
                
                // Export table schema
                const schemaCommand = `pg_dump -U postgres -d postgres --schema-only -t ${table}`;
                const schema = await this.executeDockerCommand(schemaCommand);
                
                // Export table data
                const dataCommand = `pg_dump -U postgres -d postgres --data-only -t ${table}`;
                const data = await this.executeDockerCommand(dataCommand);
                
                // Create combined script
                const tableScript = `
-- Sync table: ${table}
${schema}
${data}
`;
                
                const tableFile = path.join(this.tempDir, `sync_${table}.sql`);
                fs.writeFileSync(tableFile, tableScript);
                
                this.log(`Table ${table} exported to ${tableFile}`, 'success');
            }
        } catch (error) {
            this.log(`Table sync failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async fullSync(options = {}) {
        const {
            includeData = false,
            specificTables = [],
            deployMethod = 'cli' // 'cli' or 'api'
        } = options;

        this.log('Starting full Docker to Supabase sync...', 'info');
        
        try {
            // Step 1: Export schema
            const schemaFile = await this.exportDockerSchema();
            
            // Step 2: Export data if requested
            let dataFile = null;
            if (includeData) {
                dataFile = await this.exportDockerData(specificTables);
            }
            
            // Step 3: Generate migration script
            const migrationFile = await this.generateMigrationScript();
            
            // Step 4: Deploy to Supabase
            if (deployMethod === 'cli') {
                await this.deployViaSupabaseCLI(migrationFile);
            } else {
                await this.deployToSupabase(migrationFile);
            }
            
            this.log('Full sync completed successfully!', 'success');
            
            // Cleanup temp files
            this.cleanup();
            
            return {
                success: true,
                schemaFile,
                dataFile,
                migrationFile
            };
            
        } catch (error) {
            this.log(`Full sync failed: ${error.message}`, 'error');
            throw error;
        }
    }

    cleanup() {
        try {
            if (fs.existsSync(this.tempDir)) {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
                this.log('Cleaned up temporary files', 'success');
            }
        } catch (error) {
            this.log(`Cleanup failed: ${error.message}`, 'warning');
        }
    }

    async watchForChanges() {
        this.log('Starting change watcher...', 'info');
        
        // This would implement file watching or database change detection
        // For now, we'll provide a manual trigger method
        this.log('Change watcher not implemented yet. Use manual sync.', 'warning');
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const sync = new DockerToSupabaseSync();
    
    switch (command) {
        case 'schema':
            sync.exportDockerSchema()
                .then(() => console.log('Schema export completed'))
                .catch(console.error);
            break;
            
        case 'data':
            const tables = args.slice(1);
            sync.exportDockerData(tables)
                .then(() => console.log('Data export completed'))
                .catch(console.error);
            break;
            
        case 'sync':
            const includeData = args.includes('--data');
            const specificTables = args.filter(arg => arg.startsWith('--table=')).map(arg => arg.split('=')[1]);
            
            sync.fullSync({ 
                includeData, 
                specificTables: specificTables.length > 0 ? specificTables : undefined 
            })
                .then(() => console.log('Full sync completed'))
                .catch(console.error);
            break;
            
        case 'watch':
            sync.watchForChanges()
                .catch(console.error);
            break;
            
        default:
            console.log(`
🚀 Docker to Supabase Sync Tool

Usage:
  node docker-to-supabase-sync.js <command> [options]

Commands:
  schema                    Export schema only
  data [tables...]         Export data for specific tables
  sync [--data] [--table=name]  Full sync (schema + optional data)
  watch                    Watch for changes (not implemented)

Examples:
  node docker-to-supabase-sync.js schema
  node docker-to-supabase-sync.js data profiles posts
  node docker-to-supabase-sync.js sync
  node docker-to-supabase-sync.js sync --data
  node docker-to-supabase-sync.js sync --table=profiles --table=posts
            `);
    }
}

module.exports = DockerToSupabaseSync;
