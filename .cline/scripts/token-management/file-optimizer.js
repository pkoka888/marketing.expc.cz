#!/usr/bin/env node

/**
 * File Reading Optimization System
 * Provides intelligent file reading strategies to minimize token usage
 */

import fs from 'fs';
import path from 'path';

class FileOptimizer {
  constructor() {
    this.projectRoot = process.cwd();
    this.maxFileSize = 50000; // 50KB limit for direct reading
    this.chunkSize = 10000; // 10KB chunks
    this.maxLinesPerChunk = 200;
  }

  /**
   * Estimate file size in tokens
   */
  estimateFileTokens(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Rough estimation: 1 token ≈ 4 characters
      return Math.ceil(fileSize / 4);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if file is too large for direct reading
   */
  isFileTooLarge(filePath) {
    const tokens = this.estimateFileTokens(filePath);
    return tokens > this.maxFileSize;
  }

  /**
   * Get file reading strategy based on file size and content
   */
  getReadingStrategy(filePath) {
    const tokens = this.estimateFileTokens(filePath);
    const stats = { filePath, estimatedTokens: tokens };
    
    if (tokens === 0) {
      return { strategy: 'skip', reason: 'File not found or inaccessible', stats };
    }
    
    if (tokens > this.maxFileSize) {
      return { 
        strategy: 'chunked', 
        reason: `File too large (${this.formatFileSize(tokens * 4)})`, 
        stats,
        chunks: this.calculateChunks(filePath)
      };
    }
    
    if (this.isStructuredFile(filePath)) {
      return { 
        strategy: 'targeted', 
        reason: 'Structured file - use targeted extraction', 
        stats,
        structure: this.analyzeStructure(filePath)
      };
    }
    
    return { strategy: 'direct', reason: 'File size acceptable', stats };
  }

  /**
   * Calculate optimal chunks for large file reading
   */
  calculateChunks(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const totalLines = lines.length;
      
      const chunks = [];
      let currentLine = 0;
      
      while (currentLine < totalLines) {
        const chunkLines = lines.slice(currentLine, currentLine + this.maxLinesPerChunk);
        const chunkContent = chunkLines.join('\n');
        const chunkTokens = this.estimateTokens(chunkContent);
        
        chunks.push({
          startLine: currentLine + 1,
          endLine: Math.min(currentLine + this.maxLinesPerChunk, totalLines),
          lines: chunkLines.length,
          estimatedTokens: chunkTokens,
          preview: chunkContent.substring(0, 200) + '...'
        });
        
        currentLine += this.maxLinesPerChunk;
      }
      
      return chunks;
    } catch (error) {
      return [];
    }
  }

  /**
   * Analyze file structure for targeted reading
   */
  analyzeStructure(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const structure = {
        type: this.getFileType(filePath),
        sections: [],
        functions: [],
        classes: [],
        imports: []
      };
      
      const lines = content.split('\n');
      
      // Analyze different file types
      if (this.isJavaScriptFile(filePath)) {
        structure.sections = this.analyzeJavaScriptStructure(lines);
      } else if (this.isMarkdownFile(filePath)) {
        structure.sections = this.analyzeMarkdownStructure(lines);
      } else if (this.isConfigFile(filePath)) {
        structure.sections = this.analyzeConfigStructure(lines);
      }
      
      return structure;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Analyze JavaScript/TypeScript file structure
   */
  analyzeJavaScriptStructure(lines) {
    const sections = [];
    let currentSection = null;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Detect imports
      if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) {
        if (!currentSection || currentSection.type !== 'imports') {
          currentSection = { type: 'imports', startLine: index + 1, content: [] };
          sections.push(currentSection);
        }
        currentSection.content.push({ line: index + 1, content: trimmed });
      }
      // Detect function declarations
      else if (trimmed.match(/^(function|const|let|var)\s+\w+/) || trimmed.match(/^\w+\s*\(.*\)\s*=>/)) {
        sections.push({
          type: 'function',
          startLine: index + 1,
          name: this.extractFunctionName(trimmed),
          preview: trimmed.substring(0, 100)
        });
      }
      // Detect class declarations
      else if (trimmed.match(/^class\s+\w+/)) {
        sections.push({
          type: 'class',
          startLine: index + 1,
          name: this.extractClassName(trimmed),
          preview: trimmed.substring(0, 100)
        });
      }
      // Detect exports
      else if (trimmed.startsWith('export ')) {
        sections.push({
          type: 'export',
          startLine: index + 1,
          content: trimmed,
          preview: trimmed.substring(0, 100)
        });
      }
    });
    
    return sections;
  }

  /**
   * Analyze Markdown file structure
   */
  analyzeMarkdownStructure(lines) {
    const sections = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Detect headings
      if (trimmed.match(/^#{1,6}\s/)) {
        const level = trimmed.match(/^#+/)[0].length;
        sections.push({
          type: 'heading',
          level,
          startLine: index + 1,
          title: trimmed.replace(/^#+\s*/, ''),
          preview: lines.slice(index, index + 3).join(' ').substring(0, 100)
        });
      }
    });
    
    return sections;
  }

  /**
   * Analyze configuration file structure
   */
  analyzeConfigStructure(lines) {
    const sections = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Detect section headers (INI-style)
      if (trimmed.match(/^\[.*\]$/)) {
        sections.push({
          type: 'section',
          startLine: index + 1,
          name: trimmed.replace(/[\[\]]/g, ''),
          preview: trimmed
        });
      }
      // Detect key-value pairs
      else if (trimmed.match(/^\w+\s*=/)) {
        const [key, value] = trimmed.split('=').map(s => s.trim());
        sections.push({
          type: 'key-value',
          startLine: index + 1,
          key,
          value: value.substring(0, 50),
          preview: `${key} = ${value.substring(0, 50)}`
        });
      }
    });
    
    return sections;
  }

  /**
   * Read file with optimized strategy
   */
  async readOptimized(filePath, options = {}) {
    const strategy = this.getReadingStrategy(filePath);
    
    switch (strategy.strategy) {
      case 'direct':
        return await this.readDirect(filePath);
      case 'chunked':
        return await this.readChunked(filePath, options);
      case 'targeted':
        return await this.readTargeted(filePath, options);
      default:
        return { error: 'Unknown reading strategy' };
    }
  }

  /**
   * Read file directly (for small files)
   */
  async readDirect(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const tokens = this.estimateTokens(content);
      
      return {
        strategy: 'direct',
        content,
        stats: {
          filePath,
          fileSize: content.length,
          estimatedTokens: tokens,
          lines: content.split('\n').length
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Read file in chunks (for large files)
   */
  async readChunked(filePath, options = {}) {
    const chunks = this.calculateChunks(filePath);
    const targetChunk = options.chunk || 1;
    
    if (targetChunk > chunks.length) {
      return { error: `Chunk ${targetChunk} not found. File has ${chunks.length} chunks.` };
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const chunk = chunks[targetChunk - 1];
      
      const chunkContent = lines.slice(chunk.startLine - 1, chunk.endLine).join('\n');
      
      return {
        strategy: 'chunked',
        chunk: {
          number: targetChunk,
          total: chunks.length,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          content: chunkContent,
          estimatedTokens: chunk.estimatedTokens
        },
        stats: {
          filePath,
          totalChunks: chunks.length,
          currentChunk: targetChunk
        },
        recommendations: this.getChunkedRecommendations(chunks, targetChunk)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Read file with targeted extraction (for structured files)
   */
  async readTargeted(filePath, options = {}) {
    const structure = this.analyzeStructure(filePath);
    const targetType = options.type || 'all';
    const targetName = options.name;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      let extractedContent = '';
      let found = false;
      
      if (targetType === 'all') {
        extractedContent = content;
        found = true;
      } else if (targetName) {
        // Find specific section/function/class
        const target = structure.sections.find(section => 
          section.type === targetType && section.name === targetName
        );
        
        if (target) {
          const startLine = target.startLine - 1;
          const endLine = this.findEndLine(lines, startLine, targetType);
          extractedContent = lines.slice(startLine, endLine).join('\n');
          found = true;
        }
      } else {
        // Return structure overview
        extractedContent = this.formatStructureOverview(structure);
        found = true;
      }
      
      return {
        strategy: 'targeted',
        targetType,
        targetName,
        content: extractedContent,
        found,
        structure,
        stats: {
          filePath,
          extractedLines: extractedContent.split('\n').length,
          estimatedTokens: this.estimateTokens(extractedContent)
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Find end line for a specific code block
   */
  findEndLine(lines, startLine, type) {
    let currentLine = startLine;
    let braceCount = 0;
    let inBlock = false;
    
    // Skip to start of block
    if (type === 'function' || type === 'class') {
      while (currentLine < lines.length && !lines[currentLine].includes('{')) {
        currentLine++;
      }
      if (currentLine < lines.length) {
        inBlock = true;
        braceCount = 1;
        currentLine++;
      }
    }
    
    // Find end of block
    while (currentLine < lines.length && inBlock) {
      const line = lines[currentLine];
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      if (braceCount === 0) {
        return currentLine + 1;
      }
      currentLine++;
    }
    
    return Math.min(currentLine + 10, lines.length); // Fallback
  }

  /**
   * Get recommendations for chunked reading
   */
  getChunkedRecommendations(chunks, currentChunk) {
    const recommendations = [];
    
    if (currentChunk < chunks.length) {
      recommendations.push({
        type: 'continue_reading',
        message: `Continue to chunk ${currentChunk + 1} of ${chunks.length}`,
        action: `readChunked(filePath, { chunk: ${currentChunk + 1} })`
      });
    }
    
    if (currentChunk > 1) {
      recommendations.push({
        type: 'previous_chunk',
        message: `Review previous chunk ${currentChunk - 1}`,
        action: `readChunked(filePath, { chunk: ${currentChunk - 1} })`
      });
    }
    
    recommendations.push({
      type: 'search_alternative',
      message: 'Consider using search_files for specific content',
      action: 'search_files(filePath, pattern)'
    });
    
    return recommendations;
  }

  /**
   * Format structure overview for display
   */
  formatStructureOverview(structure) {
    let overview = `# File Structure Overview\n\n`;
    
    if (structure.sections) {
      overview += `## Sections (${structure.sections.length})\n\n`;
      structure.sections.forEach(section => {
        overview += `- **${section.type}**: ${section.name || 'unnamed'} (line ${section.startLine})\n`;
      });
    }
    
    return overview;
  }

  // Helper methods
  isStructuredFile(filePath) {
    const structuredExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml', '.md', '.txt'];
    const ext = path.extname(filePath).toLowerCase();
    return structuredExtensions.includes(ext);
  }

  isJavaScriptFile(filePath) {
    const jsExtensions = ['.js', '.ts', '.jsx', '.tsx'];
    const ext = path.extname(filePath).toLowerCase();
    return jsExtensions.includes(ext);
  }

  isMarkdownFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md';
  }

  isConfigFile(filePath) {
    const configExtensions = ['.json', '.yaml', '.yml', '.ini', '.env', '.config'];
    const ext = path.extname(filePath).toLowerCase();
    return configExtensions.includes(ext);
  }

  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (this.isJavaScriptFile(filePath)) return 'javascript';
    if (this.isMarkdownFile(filePath)) return 'markdown';
    if (this.isConfigFile(filePath)) return 'config';
    return 'text';
  }

  extractFunctionName(line) {
    const match = line.match(/(?:function\s+|const\s+|let\s+|var\s+)(\w+)/);
    return match ? match[1] : 'anonymous';
  }

  extractClassName(line) {
    const match = line.match(/class\s+(\w+)/);
    return match ? match[1] : 'anonymous';
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  }
}

// CLI Interface
class FileOptimizerCLI {
  constructor() {
    this.optimizer = new FileOptimizer();
  }

  async handleCommand(args) {
    const command = args[0] || 'analyze';
    const filePath = args[1];
    
    if (!filePath) {
      console.log('Please provide a file path');
      return this.showHelp();
    }
    
    switch (command) {
      case 'analyze':
        return this.analyzeFile(filePath);
      case 'read':
        return this.readFile(filePath, args.slice(2));
      case 'strategy':
        return this.showStrategy(filePath);
      default:
        return this.showHelp();
    }
  }

  async analyzeFile(filePath) {
    const strategy = this.optimizer.getReadingStrategy(filePath);
    
    console.log('\n📊 File Analysis');
    console.log('='.repeat(50));
    console.log(`File: ${filePath}`);
    console.log(`Strategy: ${strategy.strategy.toUpperCase()}`);
    console.log(`Reason: ${strategy.reason}`);
    console.log(`Estimated Tokens: ${strategy.stats.estimatedTokens.toLocaleString()}`);
    
    if (strategy.chunks) {
      console.log(`Chunks: ${strategy.chunks.length}`);
    }
    
    if (strategy.structure) {
      console.log(`Structure Type: ${strategy.structure.type}`);
      console.log(`Sections: ${strategy.structure.sections.length}`);
    }
    
    console.log('');
    return strategy;
  }

  async readFile(filePath, options) {
    const opts = this.parseOptions(options);
    const result = await this.optimizer.readOptimized(filePath, opts);
    
    console.log('\n📖 File Reading Result');
    console.log('='.repeat(50));
    console.log(`Strategy: ${result.strategy}`);
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
      return result;
    }
    
    if (result.content) {
      console.log(`Content Length: ${result.content.length} characters`);
      console.log(`Estimated Tokens: ${this.optimizer.estimateTokens(result.content).toLocaleString()}`);
      console.log('\n--- Content Preview ---');
      console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
    }
    
    if (result.recommendations) {
      console.log('\n💡 Recommendations:');
      result.recommendations.forEach(rec => {
        console.log(`- ${rec.message}`);
      });
    }
    
    console.log('');
    return result;
  }

  showStrategy(filePath) {
    const strategy = this.optimizer.getReadingStrategy(filePath);
    console.log('\n🎯 Recommended Reading Strategy');
    console.log('='.repeat(50));
    console.log(`Strategy: ${strategy.strategy}`);
    console.log(`Reason: ${strategy.reason}`);
    console.log(`Estimated Tokens: ${strategy.stats.estimatedTokens.toLocaleString()}`);
    
    if (strategy.strategy === 'chunked') {
      console.log(`Total Chunks: ${strategy.chunks.length}`);
      console.log('Recommendation: Use chunked reading to avoid token limits');
    } else if (strategy.strategy === 'targeted') {
      console.log('Recommendation: Use targeted reading for specific sections');
    }
    
    console.log('');
    return strategy;
  }

  parseOptions(args) {
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--chunk=')) {
        options.chunk = parseInt(arg.split('=')[1]);
      } else if (arg.startsWith('--type=')) {
        options.type = arg.split('=')[1];
      } else if (arg.startsWith('--name=')) {
        options.name = arg.split('=')[1];
      }
    }
    
    return options;
  }

  showHelp() {
    console.log(`
🔧 File Optimizer CLI

USAGE:
  file-optimizer [command] [file] [options]

COMMANDS:
  analyze <file>     Analyze file and recommend reading strategy
  read <file>        Read file with optimized strategy
  strategy <file>    Show recommended reading strategy

OPTIONS:
  --chunk=<n>        For chunked reading, specify chunk number
  --type=<type>      For targeted reading, specify type (function, class, etc.)
  --name=<name>      For targeted reading, specify name

EXAMPLES:
  file-optimizer analyze large-file.js
  file-optimizer read large-file.js --chunk=2
  file-optimizer read config.json --type=function --name=initApp

STRATEGIES:
  - direct: Read entire file (small files only)
  - chunked: Read in chunks (large files)
  - targeted: Extract specific sections (structured files)
    `);
  }
}

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const cli = new FileOptimizerCLI();
  cli.handleCommand(args);
}

export default FileOptimizer;