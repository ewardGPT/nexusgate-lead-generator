/**
 * NexusGate Lead Form Configuration
 * 
 * IMPORTANT: Never hardcode secrets here. Use environment variables
 * or a server-side config endpoint in production.
 */
const FORM_CONFIG = {
  // n8n webhook URL — set via environment variable or build config
  webhookUrl: typeof process !== 'undefined' 
    ? process.env.FORM_WEBHOOK_URL 
    : (window.FORM_ENV && window.FORM_ENV.WEBHOOK_URL) || 'https://your-n8n-instance.com/webhook/incoming-lead',

  // Webhook secret header (for HMAC verification)
  webhookSecret: typeof process !== 'undefined'
    ? process.env.WEBHOOK_SECRET
    : (window.FORM_ENV && window.FORM_ENV.WEBHOOK_SECRET) || '',

  // Rate limiting hint (server-side enforcement is in n8n)
  rateLimit: {
    windowMs: 60000,     // 1 minute
    maxRequests: 10      // max 10 submissions per window
  },

  // Form behavior
  behavior: {
    showStep2AfterStep1: true,
    requireStep2: false,  // Step 2 is optional enrichment
    confirmOnSubmit: true,
    resetAfterSubmit: true
  },

  // Validation rules
  validation: {
    email: {
      regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email address'
    },
    useCase: {
      maxLength: 500,
      message: 'Use case must be under 500 characters'
    },
    name: {
      maxLength: 100,
      message: 'Name must be under 100 characters'
    },
    company: {
      maxLength: 150,
      message: 'Company name must be under 150 characters'
    },
    companyDomain: {
      regex: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/,
      message: 'Please enter a valid domain (e.g., company.com)'
    }
  }
};

// Export for module systems, or attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FORM_CONFIG;
} else if (typeof window !== 'undefined') {
  window.FORM_CONFIG = FORM_CONFIG;
}
