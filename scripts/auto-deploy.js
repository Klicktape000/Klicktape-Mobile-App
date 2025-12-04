#!/usr/bin/env node

/**
 * Automated Deployment Script
 * One-click deployment from Docker to Supabase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class AutoDeploy {
    constructor() {
        this.projectRef = this.extractProjectRef();
        this.supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        this.deploymentScripts = [
            'scripts/production-deployment-safe.sql',
            'scripts/production-profile-tier-deployment.sql'
        ];
    }

    extractProjectRef() {
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!url) {
            throw new Error('EXPO_PUBLIC_SUPABASE_URL not found in .env file');
        }
        const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
        return match ? match[1] : null;
    }

    log(message, type = 'info') {
        const icons = {
            info: '📋',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            deploy: '🚀'
        };
        console.log(`${icons[type]} ${message}`);
    }

    async checkPrerequisites() {
        this.log('Checking prerequisites...', 'info');

        // Check Docker
        try {
            execSync('docker ps', { stdio: 'pipe' });
            this.log('Docker is running', 'success');
        } catch (error) {
            throw new Error('Docker is not running. Please start Docker Desktop.');
        }

        // Check Supabase container
        try {
            execSync('docker exec supabase_db_klicktape psql -U postgres -d postgres -c "SELECT 1;"', { stdio: 'pipe' });
            this.log('Supabase container is accessible', 'success');
        } catch (error) {
            throw new Error('Supabase container is not running or accessible.');
        }

        // Check environment variables
        if (!this.supabaseUrl || !this.projectRef) {
            throw new Error('Missing Supabase configuration in .env file');
        }
        this.log(`Connected to project: ${this.projectRef}`, 'success');

        // Check deployment scripts exist
        for (const script of this.deploymentScripts) {
            if (!fs.existsSync(script)) {
                throw new Error(`Deployment script not found: ${script}`);
            }
        }
        this.log('All deployment scripts found', 'success');
    }

    async generateCombinedScript() {
        this.log('Generating combined deployment script...', 'info');

        const timestamp = new Date().toISOString();
        let combinedScript = `-- =====================================================
-- KLICKTAPE AUTOMATED DEPLOYMENT
-- Generated: ${timestamp}
-- Project: ${this.projectRef}
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

`;

        // Combine all deployment scripts
        for (const scriptPath of this.deploymentScripts) {
            const scriptName = path.basename(scriptPath);
            this.log(`Adding ${scriptName}...`, 'info');

            combinedScript += `
-- =====================================================
-- ${scriptName.toUpperCase()}
-- =====================================================

`;
            const scriptContent = fs.readFileSync(scriptPath, 'utf8');
            combinedScript += scriptContent + '\n\n';
        }

        // Add final verification
        combinedScript += `
-- =====================================================
-- FINAL DEPLOYMENT VERIFICATION
-- =====================================================

SELECT '🎉 KLICKTAPE DEPLOYMENT COMPLETED SUCCESSFULLY! 🏆' as final_status;
SELECT 'Mythological ranking system with profile tiers is now live!' as feature_status;

-- Show deployment summary
SELECT 
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_type WHERE typname = 'rank_tier') as mythological_enums,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'current_tier') as profile_tier_columns,
    (SELECT COUNT(*) FROM pg_views WHERE viewname LIKE '%tier%') as tier_views;
`;

        const outputPath = 'scripts/combined-deployment.sql';
        fs.writeFileSync(outputPath, combinedScript);
        
        this.log(`Combined script created: ${outputPath}`, 'success');
        return outputPath;
    }

    async copyToClipboard(filePath) {
        try {
            if (process.platform === 'win32') {
                execSync(`type "${filePath}" | clip`, { stdio: 'pipe' });
            } else if (process.platform === 'darwin') {
                execSync(`cat "${filePath}" | pbcopy`, { stdio: 'pipe' });
            } else {
                execSync(`cat "${filePath}" | xclip -selection clipboard`, { stdio: 'pipe' });
            }
            this.log('Deployment script copied to clipboard', 'success');
        } catch (error) {
            this.log('Could not copy to clipboard, but script is ready', 'warning');
        }
    }

    async openSupabaseDashboard() {
        const sqlEditorUrl = `https://app.supabase.com/project/${this.projectRef}/sql`;
        
        try {
            if (process.platform === 'win32') {
                execSync(`start ${sqlEditorUrl}`, { stdio: 'pipe' });
            } else if (process.platform === 'darwin') {
                execSync(`open ${sqlEditorUrl}`, { stdio: 'pipe' });
            } else {
                execSync(`xdg-open ${sqlEditorUrl}`, { stdio: 'pipe' });
            }
            this.log('Supabase SQL Editor opened in browser', 'success');
        } catch (error) {
            this.log(`Please open manually: ${sqlEditorUrl}`, 'warning');
        }
    }

    async deployAutomatically(scriptPath) {
        this.log('Attempting automatic deployment...', 'deploy');

        try {
            // Try using Supabase CLI
            try {
                execSync('npx supabase --version', { stdio: 'pipe' });
            } catch {
                this.log('Installing Supabase CLI...', 'info');
                execSync('npm install -g supabase', { stdio: 'inherit' });
            }

            // Link project
            try {
                execSync(`npx supabase link --project-ref ${this.projectRef}`, { 
                    stdio: 'pipe',
                    input: '\n' // Auto-confirm
                });
            } catch {
                this.log('Project linking skipped (may already be linked)', 'warning');
            }

            // Execute deployment
            const scriptContent = fs.readFileSync(scriptPath, 'utf8');
            const tempFile = 'temp_deployment.sql';
            fs.writeFileSync(tempFile, scriptContent);

            execSync(`npx supabase db push --file ${tempFile}`, {
                stdio: 'inherit'
            });

            // Cleanup
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }

            this.log('Automatic deployment completed!', 'success');
            return true;

        } catch (error) {
            this.log(`Automatic deployment failed: ${error.message}`, 'error');
            this.log('Falling back to manual deployment...', 'warning');
            return false;
        }
    }

    async run(options = {}) {
        const { autoMode = false } = options;

        try {
            this.log('Starting KlickTape automated deployment...', 'deploy');
            
            // Step 1: Check prerequisites
            await this.checkPrerequisites();
            
            // Step 2: Generate combined script
            const scriptPath = await this.generateCombinedScript();
            
            // Step 3: Try automatic deployment if requested
            if (autoMode) {
                const success = await this.deployAutomatically(scriptPath);
                if (success) {
                    this.log('🎉 Deployment completed automatically!', 'success');
                    return;
                }
            }
            
            // Step 4: Manual deployment fallback
            await this.copyToClipboard(scriptPath);
            await this.openSupabaseDashboard();
            
            this.log('', 'info');
            this.log('🎯 MANUAL DEPLOYMENT STEPS:', 'info');
            this.log('1. Supabase SQL Editor should now be open in your browser', 'info');
            this.log('2. Paste the deployment script (Ctrl+V) - it\'s in your clipboard', 'info');
            this.log('3. Click "Run" to execute the deployment', 'info');
            this.log('4. Verify success with the included verification queries', 'info');
            this.log('', 'info');
            this.log('🏆 Your mythological ranking system will be live!', 'success');
            
        } catch (error) {
            this.log(`Deployment failed: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const autoMode = args.includes('--auto');
    
    const deployer = new AutoDeploy();
    deployer.run({ autoMode });
}

module.exports = AutoDeploy;
