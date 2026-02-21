const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Extend basic test by providing "apiCalls" fixture
const testWithApiCapture = test.extend({
  apiCalls: async ({ page }, use) => {
    const apiCalls = [];
    
    // Capture all network requests
    page.on('request', (request) => {
      const requestInfo = {
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        timestamp: new Date().toISOString(),
        type: request.resourceType(),
      };
      
      // Try to get response if available
      request.response().then((response) => {
        if (response) {
          requestInfo.status = response.status();
          requestInfo.statusText = response.statusText();
          requestInfo.responseTime = Date.now();
          
          // Capture response headers
          requestInfo.responseHeaders = response.headers();
          
          // Try to get response body for API calls
          if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
            response.text().then((body) => {
              try {
                requestInfo.responseBody = JSON.parse(body);
              } catch (e) {
                requestInfo.responseBody = body;
              }
            }).catch(() => {
              // Response body might not be available
            });
          }
        }
      }).catch(() => {
        // Response might not be available
      });
      
      apiCalls.push(requestInfo);
    });
    
    await use(apiCalls);
  },
});

module.exports = { testWithApiCapture };
