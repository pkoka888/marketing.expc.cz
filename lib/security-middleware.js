/**
 * Security Middleware for MCP Servers
 * 
 * Provides authentication, rate limiting, and security headers
 * for all MCP server implementations.
 */

const fs = require('fs');
const path = require('path');

// Security configuration
const SECURITY_CONFIG = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 900 // 15 minutes in seconds
    }
  },
  apiKey: {
    headerName: 'x-api-key',
    validKeys: process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : []
  },
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'"
  }
};

/**
 * Rate limiting middleware
 */
function createRateLimitMiddleware() {
  const requests = new Map();
  
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - SECURITY_CONFIG.rateLimit.windowMs;
    
    // Clean old entries
    if (requests.has(clientIP)) {
      const clientRequests = requests.get(clientIP);
      const validRequests = clientRequests.filter(time => time > windowStart);
      requests.set(clientIP, validRequests);
    }
    
    // Check rate limit
    const clientRequests = requests.get(clientIP) || [];
    if (clientRequests.length >= SECURITY_CONFIG.rateLimit.max) {
      return res.status(429).json(SECURITY_CONFIG.rateLimit.message);
    }
    
    // Add current request
    clientRequests.push(now);
    requests.set(clientIP, clientRequests);
    
    next();
  };
}

/**
 * Authentication middleware
 */
function createAuthMiddleware() {
  return (req, res, next) => {
    const apiKey = req.headers[SECURITY_CONFIG.apiKey.headerName];
    
    // Check if API key is provided
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide a valid API key in the x-api-key header'
      });
    }
    
    // Validate API key
    if (!isValidApiKey(apiKey)) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }
    
    next();
  };
}

/**
 * Security headers middleware
 */
function createSecurityHeadersMiddleware() {
  return (req, res, next) => {
    Object.entries(SECURITY_CONFIG.securityHeaders).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
    
    next();
  };
}

/**
 * Input validation middleware
 */
function createInputValidationMiddleware() {
  return (req, res, next) => {
    // Basic input sanitization
    if (req.body && typeof req.body === 'object') {
      const sanitizedBody = sanitizeObject(req.body);
      req.body = sanitizedBody;
    }
    
    next();
  };
}

/**
 * Sanitize input object
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Remove potentially dangerous keys
    if (key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token')) {
      continue;
    }
    
    if (typeof value === 'string') {
      // Basic XSS prevention
      sanitized[key] = value.replace(/[<>]/g, '');
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * API key validation
 */
function isValidApiKey(key) {
  // Check environment variable first
  if (SECURITY_CONFIG.apiKey.validKeys.length > 0) {
    return SECURITY_CONFIG.apiKey.validKeys.includes(key);
  }
  
  // Check secrets file
  try {
    const secretsPath = path.join(__dirname, '..', 'secrets', 'github_token.txt');
    if (fs.existsSync(secretsPath)) {
      const secretKey = fs.readFileSync(secretsPath, 'utf8').trim();
      return key === secretKey;
    }
  } catch (error) {
    console.warn('Could not read secrets file for API key validation');
  }
  
  return false;
}

/**
 * Error handling middleware
 */
function createErrorHandlingMiddleware() {
  return (error, req, res, next) => {
    console.error('Security middleware error:', error);
    
    // Don't expose internal errors to client
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid input provided'
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  };
}

/**
 * Health check endpoint with security
 */
function createHealthCheckEndpoint() {
  return (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      security: {
        rateLimiting: 'enabled',
        authentication: 'enabled',
        securityHeaders: 'enabled'
      }
    });
  };
}

/**
 * Apply all security middleware to an Express app
 */
function applySecurityMiddleware(app) {
  // Security headers
  app.use(createSecurityHeadersMiddleware());
  
  // Rate limiting
  app.use(createRateLimitMiddleware());
  
  // Input validation
  app.use(createInputValidationMiddleware());
  
  // Authentication (for protected routes)
  // Note: Health check and some public endpoints should be exempt
  app.use('/api', createAuthMiddleware());
  
  // Error handling
  app.use(createErrorHandlingMiddleware());
  
  // Health check endpoint
  app.get('/health', createHealthCheckEndpoint());
  
  return app;
}

module.exports = {
  createRateLimitMiddleware,
  createAuthMiddleware,
  createSecurityHeadersMiddleware,
  createInputValidationMiddleware,
  createErrorHandlingMiddleware,
  createHealthCheckEndpoint,
  applySecurityMiddleware,
  isValidApiKey,
  SECURITY_CONFIG
};