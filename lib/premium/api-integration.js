'use strict';

/**
 * lib/premium/api-integration.js
 *
 * Premium feature: API Integration for Tax Compliance Calculator.
 *
 * Provides functions to:
 *  - Push tax calculation results to external REST APIs (webhooks, accounting
 *    platforms, custom endpoints).
 *  - Pull live tax-rate updates from a remote data source.
 *  - Sync compliance reports to cloud storage endpoints.
 *  - Batch-submit multiple calculation payloads with retry logic and
 *    structured response handling.
 *
 * All network I/O is done with the built-in `https` / `http` modules so the
 * module has zero extra runtime dependencies.
 */

const https = require('https');
const http = require('http');
const url = require('url');
const { requirePro } = require('./gate');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Perform an HTTP/HTTPS request and return a Promise that resolves with
 * { statusCode, headers, body } or rejects on network / timeout errors.
 *
 * @param {string} endpoint  - Full URL string.
 * @param {object} options   - Overrides merged into the request options.
 * @param {*}      payload   - Optional body. Objects are JSON-serialised.
 * @param {number} timeoutMs - Request timeout in milliseconds (default 15 000).
 * @returns {Promise<{statusCode:number, headers:object, body:string}>}
 */
function request(endpoint, options = {}, payload = null, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (!endpoint || typeof endpoint !== 'string') {
      return reject(new Error('api-integration: endpoint must be a non-empty string'));
    }

    let parsedUrl;
    try {
      parsedUrl = new url.URL(endpoint);
    } catch (e) {
      return reject(new Error(`api-integration: invalid endpoint URL — ${endpoint}`));
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    let bodyStr = null;
    if (payload !== null && payload !== undefined) {
      bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    }

    const reqOptions = Object.assign(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        method: bodyStr ? 'POST' : 'GET',
        headers: {},
      },
      options
    );

    if (bodyStr) {
      reqOptions.headers = Object.assign(
        {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        reqOptions.headers
      );
    }

    const req = transport.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      res.on('error', reject);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`api-integration: request timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt `fn` up to `maxAttempts` times with exponential back-off.
 *
 * @param {Function} fn          - Async function to retry.
 * @param {number}   maxAttempts - Maximum number of attempts (default 3).
 * @param {number}   baseDelayMs - Initial delay in ms (doubles each retry).
 * @returns {Promise<*>}
 */
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }
  throw lastError;
}

/**
 * Build a standard envelope that wraps every outbound payload.
 *
 * @param {string} eventType - Logical event name (e.g. 'tax.calculation.result').
 * @param {object} data      - The actual payload data.
 * @param {object} meta      - Optional caller-supplied metadata.
 * @returns {object}
 */
function buildEnvelope(eventType, data, meta = {}) {
  return {
    event: eventType || 'tax.event',
    timestamp: new Date().toISOString(),
    source: 'tax-compliance-calculator',
    version: '1.0.0',
    meta: meta && typeof meta === 'object' ? meta : {},
    data: data || {},
  };
}

/**
 * Parse a JSON response body safely.
 *
 * @param {string} body
 * @returns {object|string}
 */
function safeParseJSON(body) {
  try {
    return JSON.parse(body);
  } catch (_) {
    return body;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Push a tax calculation result to an external webhook / REST endpoint.
 *
 * @param {object} calculationResult - Output from computeTotalTaxLiability or
 *                                     any calculator function.
 * @param {string} webhookUrl        - Destination URL.
 * @param {object} [opts]
 * @param {object} [opts.headers]    - Extra HTTP headers (e.g. Authorization).
 * @param {object} [opts.meta]       - Metadata merged into the envelope.
 * @param {number} [opts.retries]    - Max retry attempts (default 3).
 * @param {number} [opts.timeoutMs]  - Per-request timeout ms (default 15 000).
 * @returns {Promise<{success:boolean, statusCode:number, response:*}>}
 */
async function pushCalculationResult(calculationResult, webhookUrl, opts = {}) {
  requirePro('api-integration');

  if (!calculationResult || typeof calculationResult !== 'object') {
    throw new Error('api-integration: calculationResult must be a non-null object');
  }
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new Error('api-integration: webhookUrl must be a non-empty string');
  }

  const {
    headers = {},
    meta = {},
    retries = 3,
    timeoutMs = 15000,
  } = opts;

  const envelope = buildEnvelope('tax.calculation.result', calculationResult, meta);

  const reqOptions = {
    method: 'POST',
    headers: Object.assign({ 'User-Agent': 'tax-compliance-calculator/1.0.0' }, headers),
  };

  const res = await withRetry(
    () => request(webhookUrl, reqOptions, envelope, timeoutMs),
    retries
  );

  const parsed = safeParseJSON(res.body);
  const success = res.statusCode >= 200 && res.statusCode < 300;

  return {
    success,
    statusCode: res.statusCode,
    response: parsed,
  };
}

/**
 * Fetch live tax-rate data from a remote API endpoint and return the parsed
 * payload.  Useful for keeping jurisdiction rules up-to-date without
 * re-installing the package.
 *
 * @param {string} ratesApiUrl       - URL that returns a JSON tax-rates object.
 * @param {object} [opts]
 * @param {object} [opts.headers]    - Extra HTTP headers (e.g. API key).
 * @param {number} [opts.retries]    - Max retry attempts (default 3).
 * @param {number} [opts.timeoutMs]  - Per-request timeout ms (default 15 000).
 * @returns {Promise<{success:boolean, statusCode:number, rates:object|null}>}
 */
async function fetchLiveTaxRates(ratesApiUrl, opts = {}) {
  requirePro('api-integration');

  if (!ratesApiUrl || typeof ratesApiUrl !== 'string') {
    throw new Error('api-integration: ratesApiUrl must be a non-empty string');
  }

  const {
    headers = {},
    retries = 3,
    timeoutMs = 15000,
  } = opts;

  const reqOptions = {
    method: 'GET',
    headers: Object.assign(
      {
        'Accept': 'application/json',
        'User-Agent': 'tax-compliance-calculator/1.0.0',
      },
      headers
    ),
  };

  const res = await withRetry(
    () => request(ratesApiUrl, reqOptions, null, timeoutMs),
    retries
  );

  const success = res.statusCode >= 200 && res.statusCode < 300;
  let rates = null;

  if (success) {
    const parsed = safeParseJSON(res.body);
    rates = parsed && typeof parsed === 'object' ? parsed : null;
  }

  return {
    success,
    statusCode: res.statusCode,
    rates,
  };
}

/**
 * Sync a compliance report (plain text or JSON) to a cloud storage or
 * document-management endpoint via HTTP PUT or POST.
 *
 * @param {string|object} report     - Report content. Objects are serialised.
 * @param {string}        syncUrl    - Destination URL.
 * @param {object}        [opts]
 * @param {string}        [opts.method]      - HTTP method: 'PUT' | 'POST' (default 'PUT').
 * @param {object}        [opts.headers]     - Extra HTTP headers.
 * @param {object}        [opts.meta]        - Metadata merged into envelope when
 *                                             report is an object.
 * @param {boolean}       [opts.rawBody]     - When true, send report as-is without
 *                                             wrapping in an envelope (default false).
 * @param {number}        [opts.retries]     - Max retry attempts (default 3).
 * @param {number}        [opts.timeoutMs]   - Per-request timeout ms (default 15 000).
 * @returns {Promise<{success:boolean, statusCode:number, response:*}>}
 */
async function syncReportToCloud(report, syncUrl, opts = {}) {
  requirePro('api-integration');

  if (report === null || report === undefined) {
    throw new Error('api-integration: report must not be null or undefined');
  }
  if (!syncUrl || typeof syncUrl !== 'string') {
    throw new Error('api-integration: syncUrl must be a non-empty string');
  }

  const {
    method = 'PUT',
    headers = {},
    meta = {},
    rawBody = false,
    retries = 3,
    timeoutMs = 15000,
  } = opts;

  let payload;
  let contentType;

  if (rawBody) {
    payload = typeof report === 'string' ? report : JSON.stringify(report);
    contentType = typeof report === 'string' ? 'text/plain' : 'application/json';
  } else {
    const data = typeof report === 'string' ? { content: report } : report;
    payload = buildEnvelope('tax.compliance.report', data, meta);
    contentType = 'application/json';
  }

  const reqOptions = {
    method: method.toUpperCase(),
    headers: Object.assign(
      {
        'Content-Type': contentType,
        'User-Agent': 'tax-compliance-calculator/1.0.0',
      },
      headers
    ),
  };

  const res = await withRetry(
    () => request(syncUrl, reqOptions, payload, timeoutMs),
    retries
  );

  const parsed = safeParseJSON(res.body);
  const success = res.statusCode >= 200 && res.statusCode < 300;

  return {
    success,
    statusCode: res.statusCode,
    response: parsed,
  };
}

/**
 * Batch-submit multiple calculation payloads to an endpoint.
 *
 * Each item in `payloads` is sent individually (sequential by default, or
 * concurrently when `opts.concurrent` is true).  Returns an array of result
 * objects in the same order as the input array.
 *
 * @param {Array<object>} payloads   - Array of calculation result objects.
 * @param {string}        endpointUrl - Destination URL for each payload.
 * @param {object}        [opts]
 * @param {object}        [opts.headers]     - Extra HTTP headers.
 * @param {object}        [opts.meta]        - Metadata merged into each envelope.
 * @param {boolean}       [opts.concurrent]  - Send all requests in parallel (default false).
 * @param {number}        [opts.retries]     - Max retry attempts per item (default 3).
 * @param {number}        [opts.timeoutMs]   - Per-request timeout ms (default 15 000).
 * @param {number}        [opts.delayMs]     - Delay between sequential requests ms (default 0).
 * @returns {Promise<Array<{index:number, success:boolean, statusCode:number, response:*}>>}
 */
async function batchSubmitCalculations(payloads, endpointUrl, opts = {}) {
  requirePro('api-integration');

  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new Error('api-integration: payloads must be a non-empty array');
  }
  if (!endpointUrl || typeof endpointUrl !== 'string') {
    throw new Error('api-integration: endpointUrl must be a non-empty string');
  }

  const {
    headers = {},
    meta = {},
    concurrent = false,
    retries = 3,
    timeoutMs = 15000,
    delayMs = 0,
  } = opts;

  const reqOptions = {
    method: 'POST',
    headers: Object.assign({ 'User-Agent': 'tax-compliance-calculator/1.0.0' }, headers),
  };

  /**
   * Submit a single payload and return a labelled result.
   * @param {object} item
   * @param {number} index
   * @returns {Promise<object>}
   */
  async function submitOne(item, index) {
    const envelope = buildEnvelope('tax.calculation.batch.item', item || {}, meta);
    try {
      const res = await withRetry(
        () => request(endpointUrl, reqOptions, envelope, timeoutMs),
        retries
      );
      return {
        index,
        success: res.statusCode >= 200 && res.statusCode < 300,
        statusCode: res.statusCode,
        response: safeParseJSON(res.body),
      };
    } catch (err) {
      return {
        index,
        success: false,
        statusCode: null,
        response: null,
        error: err && err.message ? err.message : String(err),
      };
    }
  }

  if (concurrent) {
    return Promise.all(payloads.map((item, i) => submitOne(item, i)));
  }

  // Sequential with optional delay
  const results = [];
  for (let i = 0; i < payloads.length; i++) {
    results.push(await submitOne(payloads[i], i));
    if (delayMs > 0 && i < payloads.length - 1) {
      await sleep(delayMs);
    }
  }
  return results;
}

/**
 * Register this tool as a data source with a third-party accounting or
 * tax-platform API.  Sends a registration handshake and returns the
 * platform's acknowledgement (e.g. an integration ID or token).
 *
 * @param {string} registrationUrl - Platform registration endpoint.
 * @param {object} credentials     - Object containing API key / secret fields
 *                                   required by the platform.
 * @param {object} [opts]
 * @param {object} [opts.headers]  - Extra HTTP headers.
 * @param {object} [opts.profile]  - Optional profile data (business name, EIN, etc.).
 * @param {number} [opts.retries]  - Max retry attempts (default 3).
 * @param {number} [opts.timeoutMs] - Per-request timeout ms (default 15 000).
 * @returns {Promise<{success:boolean, statusCode:number, integrationId:string|null, response:*}>}
 */
async function registerIntegration(registrationUrl, credentials, opts = {}) {
  requirePro('api-integration');

  if (!registrationUrl || typeof registrationUrl !== 'string') {
    throw new Error('api-integration: registrationUrl must be a non-empty string');
  }
  if (!credentials || typeof credentials !== 'object') {
    throw new Error('api-integration: credentials must be a non-null object');
  }

  const {
    headers = {},
    profile = {},
    retries = 3,
    timeoutMs = 15000,
  } = opts;

  const payload = {
    source: 'tax-compliance-calculator',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    credentials,
    profile: profile && typeof profile === 'object' ? profile : {},
  };

  const reqOptions = {
    method: 'POST',
    headers: Object.assign(
      {
        'Content-Type': 'application/json',
        'User-Agent': 'tax-compliance-calculator/1.0.0',
      },
      headers
    ),
  };

  const res = await withRetry(
    () => request(registrationUrl, reqOptions, payload, timeoutMs),
    retries
  );

  const parsed = safeParseJSON(res.body);
  const success = res.statusCode >= 200 && res.statusCode < 300;

  let integrationId = null;
  if (success && parsed && typeof parsed === 'object') {
    integrationId =
      parsed.integrationId ||
      parsed.integration_id ||
      parsed.id ||
      null;
    if (integrationId !== null) {
      integrationId = String(integrationId);
    }
  }

  return {
    success,
    statusCode: res.statusCode,
    integrationId,
    response: parsed,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * apiIntegration — main entry point for the premium API Integration feature.
 *
 * Accepts a `command` string and a `params` object, dispatches to the
 * appropriate sub-function, and returns a structured result.
 *
 * Supported commands:
 *   'push'       — pushCalculationResult
 *   'fetch-rates'— fetchLiveTaxRates
 *   'sync-report'— syncReportToCloud
 *   'batch'      — batchSubmitCalculations
 *   'register'   — registerIntegration
 *
 * @param {string} command - One of the supported command strings above.
 * @param {object} params  - Parameters forwarded to the underlying function.
 * @returns {Promise<object>}
 */
async function apiIntegration(command, params = {}) {
  requirePro('api-integration');

  if (!command || typeof command !== 'string') {
    throw new Error('api-integration: command must be a non-empty string');
  }

  const p = params && typeof params === 'object' ? params : {};

  switch (command.toLowerCase().trim()) {
    case 'push':
      return pushCalculationResult(
        p.calculationResult,
        p.webhookUrl,
        p.opts
      );

    case 'fetch-rates':
      return fetchLiveTaxRates(
        p.ratesApiUrl,
        p.opts
      );

    case 'sync-report':
      return syncReportToCloud(
        p.report,
        p.syncUrl,
        p.opts
      );

    case 'batch':
      return batchSubmitCalculations(
        p.payloads,
        p.endpointUrl,
        p.opts
      );

    case 'register':
      return registerIntegration(
        p.registrationUrl,
        p.credentials,
        p.opts
      );

    default:
      throw new Error(
        `api-integration: unknown command "${command}". ` +
        'Valid commands: push, fetch-rates, sync-report, batch, register'
      );
  }
}

// Attach sub-functions for direct import convenience
apiIntegration.pushCalculationResult = pushCalculationResult;
apiIntegration.fetchLiveTaxRates = fetchLiveTaxRates;
apiIntegration.syncReportToCloud = syncReportToCloud;
apiIntegration.batchSubmitCalculations = batchSubmitCalculations;
apiIntegration.registerIntegration = registerIntegration;

module.exports = apiIntegration;