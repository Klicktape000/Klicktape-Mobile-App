/**
 * Script to safely remove/replace console logs in the project
 * This script will:
 * 1. Keep console.error (important for debugging)
 * 2. Remove console.log, console.warn, console.info, console.debug in production code
 * 3. Skip files that already use the logger utility
 * 4. Skip test files, scripts, and documentation
 */

const fs = require('fs');
const path = require('path');

// Directories to process
const DIRS_TO_PROCESS = [
  'app',
  'components',
  'hooks',
  'lib',
  'src'
];

// Directories and files to skip
const SKIP_PATTERNS = [
  'node_modules',
  '.expo',
  '.git',
  'dist',
  'build',
  'scripts',
  'docs',
  '__tests__',
  '.test.',
  '.spec.',
  'logger.ts',
  'developmentErrorFilter.ts',
  'CommentsDebugger',
  'NotificationDebugger',
  'debug-',
  'Debug'
];

// Console methods to remove (keep console.error)
const CONSOLE_METHODS_TO_REMOVE = [
  'console.log',
  'console.warn',
  'console.info',
  'console.debug',
  'console.trace'
];

let filesProcessed = 0;
let logsRemoved = 0;
let filesSkipped = 0;

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(pattern => filePath.includes(pattern));
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if file already uses logger utility
    if (content.includes("from '@/lib/utils/logger'") || 
        content.includes('from "../utils/logger"') ||
        content.includes('from "../../utils/logger"')) {
      filesSkipped++;
      return;
    }
    
    // Skip if file has no console statements to remove
    const hasConsoleLogs = CONSOLE_METHODS_TO_REMOVE.some(method => 
      content.includes(method)
    );
    
    if (!hasConsoleLogs) {
      filesSkipped++;
      return;
    }
    
    let newContent = content;
    let removedCount = 0;
    
    // Remove or comment out console statements
    CONSOLE_METHODS_TO_REMOVE.forEach(method => {
      const regex = new RegExp(`\\s*${method.replace('.', '\\.')}\\([^;]*\\);?`, 'g');
      const matches = newContent.match(regex);
      
      if (matches) {
        removedCount += matches.length;
        // Comment out instead of removing to preserve line numbers
        newContent = newContent.replace(regex, (match) => {
          // If it's a multi-line console statement, comment each line
          const lines = match.split('\n');
          return lines.map(line => line.trim() ? `// ${line.trim()}` : '').join('\n');
        });
      }
    });
    
    if (removedCount > 0) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      filesProcessed++;
      logsRemoved += removedCount;
      console.log(`✅ Processed: ${filePath} (${removedCount} logs removed)`);
    } else {
      filesSkipped++;
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

function processDirectory(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (shouldSkipFile(fullPath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        processDirectory(fullPath);
      } else if (entry.isFile() && (
        entry.name.endsWith('.ts') ||
        entry.name.endsWith('.tsx') ||
        entry.name.endsWith('.js') ||
        entry.name.endsWith('.jsx')
      )) {
        processFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing directory ${dir}:`, error.message);
  }
}

// Main execution
console.log('🚀 Starting console log removal...\n');

DIRS_TO_PROCESS.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`📁 Processing directory: ${dir}`);
    processDirectory(fullPath);
  }
});

console.log('\n📊 Summary:');
console.log('='.repeat(50));
console.log(`✅ Files processed: ${filesProcessed}`);
console.log(`🗑️  Console logs removed: ${logsRemoved}`);
console.log(`⏭️  Files skipped: ${filesSkipped}`);
console.log('='.repeat(50));

if (filesProcessed > 0) {
  console.log('\n⚠️  IMPORTANT: Review the changes before committing!');
  console.log('💡 TIP: Use the logger utility from lib/utils/logger.ts for future logging');
}

