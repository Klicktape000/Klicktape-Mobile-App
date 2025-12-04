#!/usr/bin/env node

/**
 * Production Email Verification Page Deployment Script
 * 
 * This script helps deploy the email verification page to your production server.
 * You can customize the deployment method based on your hosting setup.
 */

const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

// Get __dirname equivalent for ES modules compatibility
const __filename = fileURLToPath(import.meta.url || 'file://' + __filename);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    sourceFile: path.join(__dirname, '..', 'public', 'verify-email-production.html'),
    targetFileName: 'verify-email.html',
    productionUrl: 'https://klicktape.com/verify-email.html',
    
    // Deployment methods (uncomment the one you use)
    deploymentMethods: {
        // FTP/SFTP
        ftp: {
            host: 'your-ftp-server.com',
            username: 'your-username',
            password: 'your-password', // Use environment variable in production
            remotePath: '/public_html/'
        },
        
        // AWS S3
        s3: {
            bucket: 'your-bucket-name',
            region: 'us-east-1',
            key: 'verify-email.html'
        },
        
        // Vercel/Netlify (copy to public folder)
        static: {
            publicDir: '/path/to/your/public/folder'
        }
    }
};

function validateSourceFile() {
    if (!fs.existsSync(CONFIG.sourceFile)) {
        throw new Error(`Source file not found: ${CONFIG.sourceFile}`);
    }
    
    const stats = fs.statSync(CONFIG.sourceFile);
    if (stats.size === 0) {
        throw new Error('Source file is empty');
    }
    
    console.log(`✅ Source file validated: ${CONFIG.sourceFile} (${stats.size} bytes)`);
}

function readSourceFile() {
    try {
        const content = fs.readFileSync(CONFIG.sourceFile, 'utf8');
        
        // Basic validation
        if (!content.includes('KlickTape') || !content.includes('supabase')) {
            throw new Error('Source file appears to be invalid (missing expected content)');
        }
        
        console.log(`✅ Source file read successfully (${content.length} characters)`);
        return content;
    } catch (error) {
        throw new Error(`Failed to read source file: ${error.message}`);
    }
}

function deployToStatic(content) {
    console.log('\n📁 Static Deployment Method');
    console.log('This method copies the file to a local public directory.');
    console.log('Use this if you\'re using Vercel, Netlify, or similar static hosting.');
    
    // Create a local copy for manual upload
    const localTarget = path.join(__dirname, '..', 'dist', CONFIG.targetFileName);
    const distDir = path.dirname(localTarget);
    
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    
    fs.writeFileSync(localTarget, content, 'utf8');
    console.log(`✅ File copied to: ${localTarget}`);
    
    console.log('\n📋 Next Steps:');
    console.log(`1. Upload ${localTarget} to your web server`);
    console.log(`2. Ensure it's accessible at: ${CONFIG.productionUrl}`);
    console.log('3. Test the URL in your browser');
}

function deployToFTP(content) {
    console.log('\n🌐 FTP Deployment Method');
    console.log('Note: This is a template. You\'ll need to install an FTP library like "ftp" or "ssh2-sftp-client"');
    
    console.log('\nTo implement FTP deployment:');
    console.log('1. npm install ftp');
    console.log('2. Uncomment and configure the FTP code below');
    console.log('3. Set your FTP credentials in environment variables');
    
    /*
    // Example FTP deployment (requires 'ftp' package)
    const Client = require('ftp');
    const client = new Client();
    
    client.on('ready', function() {
        client.put(Buffer.from(content), CONFIG.deploymentMethods.ftp.remotePath + CONFIG.targetFileName, function(err) {
            if (err) throw err;
            console.log('✅ File uploaded via FTP');
            client.end();
        });
    });
    
    client.connect(CONFIG.deploymentMethods.ftp);
    */
}

function deployToS3(content) {
    console.log('\n☁️ AWS S3 Deployment Method');
    console.log('Note: This is a template. You\'ll need to install AWS SDK');
    
    console.log('\nTo implement S3 deployment:');
    console.log('1. npm install @aws-sdk/client-s3');
    console.log('2. Configure AWS credentials');
    console.log('3. Uncomment and configure the S3 code below');
    
    /*
    // Example S3 deployment (requires '@aws-sdk/client-s3' package)
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({ region: CONFIG.deploymentMethods.s3.region });
    
    const uploadParams = {
        Bucket: CONFIG.deploymentMethods.s3.bucket,
        Key: CONFIG.deploymentMethods.s3.key,
        Body: content,
        ContentType: 'text/html',
        CacheControl: 'no-cache'
    };
    
    s3Client.send(new PutObjectCommand(uploadParams))
        .then(() => console.log('✅ File uploaded to S3'))
        .catch(err => console.error('❌ S3 upload failed:', err));
    */
}

function generateDeploymentInstructions() {
    console.log('\n📋 Manual Deployment Instructions');
    console.log('=====================================');
    
    console.log('\n1. Upload the file:');
    console.log(`   Source: ${CONFIG.sourceFile}`);
    console.log(`   Target: ${CONFIG.productionUrl}`);
    
    console.log('\n2. Verify deployment:');
    console.log(`   Test URL: ${CONFIG.productionUrl}`);
    console.log('   Expected: Page should load with KlickTape branding');
    
    console.log('\n3. Update Supabase configuration:');
    console.log('   Dashboard: https://app.supabase.com/project/wpxkjqfcoudcddluiiab');
    console.log('   Section: Authentication → URL Configuration');
    console.log('   Add to Redirect URLs:');
    console.log(`   - ${CONFIG.productionUrl}`);
    console.log('   - https://klicktape.com/auth/verified');
    console.log('   - klicktape://auth/verified');
    
    console.log('\n4. Test the complete flow:');
    console.log('   a. Sign up with a new email in your app');
    console.log('   b. Check the confirmation email');
    console.log('   c. Click the verification link');
    console.log('   d. Verify the page loads and attempts to open your app');
}

function main() {
    try {
        console.log('🚀 KlickTape Email Verification Page Deployment');
        console.log('===============================================');
        
        // Validate and read source file
        validateSourceFile();
        const content = readSourceFile();
        
        // Deploy using static method (safest default)
        deployToStatic(content);
        
        // Show other deployment options
        console.log('\n🔧 Other Deployment Methods Available:');
        console.log('- FTP/SFTP: Uncomment deployToFTP() function');
        console.log('- AWS S3: Uncomment deployToS3() function');
        console.log('- Manual: Follow the instructions below');
        
        // Generate manual instructions
        generateDeploymentInstructions();
        
        console.log('\n✅ Deployment preparation complete!');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    deployToStatic,
    deployToFTP,
    deployToS3,
    generateDeploymentInstructions
};