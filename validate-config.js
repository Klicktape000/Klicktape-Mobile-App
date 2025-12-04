#!/usr/bin/env node

/**
 * Local Expo Configuration Validator
 * Validates app.config.js syntax and structure without network dependency
 */

const fs = require('fs');
const path = require('path');

// Define __dirname for CommonJS compatibility
const __dirname = path.dirname(require.main.filename || process.cwd());

console.log('🔍 Validating Expo Configuration Locally...\n');

try {
  // Check if app.config.js exists
  const configPath = path.join(__dirname, 'app.config.js');
  if (!fs.existsSync(configPath)) {
    console.error('❌ app.config.js not found');
    process.exit(1);
  }

  // Load and validate the configuration
  console.log('📁 Loading app.config.js...');
  const config = require('./app.config.js');
  
  // Basic structure validation
  console.log('✅ Configuration loaded successfully');
  
  if (typeof config !== 'object' || config === null) {
    throw new Error('Configuration must export an object');
  }

  // Check required fields
  const requiredFields = ['name', 'slug', 'version'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  console.log('✅ Required fields present');

  // Validate icon and splash screen paths
  if (config.icon) {
    const iconPath = path.join(__dirname, config.icon);
    if (fs.existsSync(iconPath)) {
      console.log('✅ App icon file exists:', config.icon);
    } else {
      console.warn('⚠️  App icon file not found:', config.icon);
    }
  }

  if (config.splash && config.splash.image) {
    const splashPath = path.join(__dirname, config.splash.image);
    if (fs.existsSync(splashPath)) {
      console.log('✅ Splash screen image exists:', config.splash.image);
    } else {
      console.warn('⚠️  Splash screen image not found:', config.splash.image);
    }
  }

  // Check platform-specific configurations
  if (config.android) {
    console.log('✅ Android configuration present');
    if (config.android.package) {
      console.log('  📱 Package:', config.android.package);
    }
  }

  if (config.ios) {
    console.log('✅ iOS configuration present');
    if (config.ios.bundleIdentifier) {
      console.log('  📱 Bundle ID:', config.ios.bundleIdentifier);
    }
  }

  if (config.web) {
    console.log('✅ Web configuration present');
    if (config.web.favicon) {
      const faviconPath = path.join(__dirname, config.web.favicon);
      if (fs.existsSync(faviconPath)) {
        console.log('  🌐 Favicon exists:', config.web.favicon);
      } else {
        console.warn('  ⚠️  Favicon not found:', config.web.favicon);
      }
    }
  }

  console.log('\n🎉 Configuration validation completed successfully!');
  console.log('📝 Summary:');
  console.log(`   App Name: ${config.name}`);
  console.log(`   Slug: ${config.slug}`);
  console.log(`   Version: ${config.version}`);
  console.log(`   Platform: ${config.platforms ? config.platforms.join(', ') : 'all'}`);

} catch (error) {
  console.error('\n❌ Configuration validation failed:');
  console.error('Error:', error.message);
  
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  
  process.exit(1);
}