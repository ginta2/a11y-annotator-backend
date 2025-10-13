#!/usr/bin/env node

/**
 * Figma Plugin Fetch Safety Checker
 * Scans JavaScript files for illegal fetch init options that would cause runtime errors
 */

const fs = require('fs');
const path = require('path');

// Illegal fetch init keys that cause Figma runtime validation errors
const BANNED_KEYS = [
  'mode',
  'cache', 
  'credentials',
  'keepalive',
  'referrer',
  'referrerPolicy',
  'redirect',
  'integrity',
  'signal',
  'priority'
];

// Files to scan (exclude node_modules, build artifacts, etc.)
const SCAN_PATHS = [
  'code.js',
  'ui.js', 
  'src/**/*.js',
  'src/**/*.ts'
];

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function getAllFiles(dir, extensions = ['.js', '.ts']) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip common ignore directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
          traverse(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for banned keys in various contexts
    for (const key of BANNED_KEYS) {
      const patterns = [
        // Direct key: value assignments
        new RegExp(`${key}\\s*:`, 'g'),
        // In object literals
        new RegExp(`['"]${key}['"]\\s*:`, 'g'),
        // In spread operations that might contain banned keys
        new RegExp(`\\.\\.\\.\\w*${key}\\w*`, 'g'),
        // In variable assignments that might be used in fetch
        new RegExp(`\\w*${key}\\w*\\s*=`, 'g')
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          // Skip if it's in a comment
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            continue;
          }
          
          issues.push({
            file: filePath,
            line: lineNum,
            column: match.index + 1,
            key: key,
            context: line.trim(),
            type: 'banned_key'
          });
        }
      }
    }
    
    // Check for fetch calls that might use spread operators with unknown objects
    const fetchWithSpread = line.match(/fetch\s*\(\s*[^,]+,\s*\.\.\.[^)]+\)/g);
    if (fetchWithSpread) {
      issues.push({
        file: filePath,
        line: lineNum,
        column: line.indexOf('fetch'),
        key: 'spread_operator',
        context: line.trim(),
        type: 'dangerous_spread'
      });
    }
  }
  
  return issues;
}

function main() {
  console.log(`${colors.bold}${colors.blue}🔍 Figma Plugin Fetch Safety Checker${colors.reset}\n`);
  
  const projectRoot = process.cwd();
  const files = getAllFiles(projectRoot);
  
  console.log(`Scanning ${files.length} JavaScript/TypeScript files...\n`);
  
  let totalIssues = 0;
  const issuesByFile = {};
  
  for (const file of files) {
    const issues = scanFile(file);
    if (issues.length > 0) {
      issuesByFile[file] = issues;
      totalIssues += issues.length;
    }
  }
  
  // Report results
  if (totalIssues === 0) {
    console.log(`${colors.green}✅ All files are safe! No illegal fetch init options found.${colors.reset}\n`);
    process.exit(0);
  }
  
  console.log(`${colors.red}❌ Found ${totalIssues} potential issues:${colors.reset}\n`);
  
  for (const [file, issues] of Object.entries(issuesByFile)) {
    console.log(`${colors.bold}📁 ${file}${colors.reset}`);
    
    for (const issue of issues) {
      const icon = issue.type === 'banned_key' ? '🚫' : '⚠️';
      const color = issue.type === 'banned_key' ? colors.red : colors.yellow;
      
      console.log(`  ${icon} ${color}Line ${issue.line}:${issue.column}${colors.reset}`);
      console.log(`     ${color}${issue.key}${colors.reset} - ${issue.context}`);
    }
    console.log('');
  }
  
  console.log(`${colors.yellow}💡 Fix suggestions:${colors.reset}`);
  console.log(`   • Remove illegal fetch init keys: ${BANNED_KEYS.join(', ')}`);
  console.log(`   • Use only: method, headers, body`);
  console.log(`   • Avoid spread operators in fetch calls`);
  console.log(`   • Use safePostJSON() helper for all network calls\n`);
  
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { BANNED_KEYS, scanFile };
