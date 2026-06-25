/**
 * FastAPI adapter that implements the same interface as @base44/sdk.
 * Lets all 48 Base44 pages work against the self-hosted FastAPI backend
 * without any changes to the page components.
 *
 * Usage: exported from base44Client.js when VITE_BASE44_APP_ID / ?app_id= is absent.
 */

// ─── TOKEN MANAGEMENT ────────────────────────────────────────────────────────

const TOKEN_KEY = 'zcpc_access_token';
const REFRESH_KEY = 'zcpc_refresh_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Turn an API error (from the custom adapter or the Base44 SDK) into a readable
 * message. Handles FastAPI's 422 `detail` arrays ([{loc, msg}, ...]),
 * string `detail`, and plain Error messages.
 */
export function formatApiError(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.data?.detail ?? err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join('; ');
  }
  if (typeof detail === 'string') return detail;
  return err?.message || fallback;
}

function setTokens(access, refresh) {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ─── FETCH WRAPPER ────────────────────────────────────────────────────────────

function buildURL(baseURL, path, params) {
  const url = new URL(baseURL + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function doFetch(baseURL, path, options = {}) {
  const { method = 'GET', body, params, headers = {}, _retried = false } = options;
  const token = getToken();
  const isFormData = body instanceof FormData;

  const reqHeaders = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  };

  const res = await fetch(buildURL(baseURL, path, params), {
    method,
    headers: reqHeaders,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let errData = {};
    try { errData = await res.json(); } catch { /* plain error */ }

    // Auto-refresh on 401
    if (res.status === 401 && !_retried) {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh) {
        try {
          const rr = await fetch(buildURL(baseURL, '/auth/refresh', null), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh }),
          });
          if (rr.ok) {
            const td = await rr.json();
            setTokens(td.access_token, td.refresh_token);
            return doFetch(baseURL, path, { ...options, _retried: true });
          }
        } catch { /**/ }
        clearTokens();
      }
    }

    const err = new Error(errData.detail || errData.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = errData;
    throw err;
  }

  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

function makeHttp(baseURL) {
  return {
    get: (path, { params } = {}) => doFetch(baseURL, path, { params }),
    post: (path, body, { headers } = {}) => doFetch(baseURL, path, { method: 'POST', body, headers }),
    put: (path, body) => doFetch(baseURL, path, { method: 'PUT', body }),
    patch: (path, body) => doFetch(baseURL, path, { method: 'PATCH', body }),
    del: (path) => doFetch(baseURL, path, { method: 'DELETE' }),
  };
}

// ─── ENTITY DEFINITIONS ───────────────────────────────────────────────────────
// For each Base44 entity name: endpoint path, field transforms (both directions),
// and a filterMap for renaming filter keys before sending to FastAPI.

const ENTITY_DEFS = {
  Patient: {
    endpoint: '/patients',
    fromAPI: (p) => p && ({
      ...p,
      created_date: p.created_at,
      updated_date: p.updated_at,
      insurance_scheme: p.insurance_provider,
      insurance_member_number: p.insurance_number,
    }),
    toAPI: (d) => ({
      ...d,
      insurance_provider: d.insurance_scheme ?? d.insurance_provider,
      insurance_number: d.insurance_member_number ?? d.insurance_number,
    }),
    filterMap: { created_date: 'created_at', updated_date: 'updated_at' },
  },

  // Base44 calls OPD encounters "Visit"
  Visit: {
    endpoint: '/encounters',
    fromAPI: (e) => e && ({
      ...e,
      visit_type: e.encounter_type,
      visit_date: e.encounter_date || e.created_at,
      queue_status: e.status,
      created_date: e.created_at,
      updated_date: e.updated_at,
    }),
    toAPI: (d) => ({
      ...d,
      encounter_type: d.visit_type || d.encounter_type || 'opd',
      encounter_date: d.visit_date || d.encounter_date,
      status: d.queue_status || d.status,
    }),
    filterMap: {
      visit_type: 'encounter_type',
      queue_status: 'status',
      visit_date: 'encounter_date',
      created_date: 'created_at',
    },
  },

  LabOrder: {
    endpoint: '/lab/orders',
    fromAPI: (o) => o && ({
      ...o,
      created_date: o.created_at,
      updated_date: o.updated_at,
      // Base44 stores tests as a comma-string; FastAPI stores as items array
      tests: Array.isArray(o.items)
        ? o.items.map((i) => i.test_name || i.test_id).join(', ')
        : o.tests || '',
    }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  Drug: {
    endpoint: '/pharmacy/drugs',
    fromAPI: (d) => d && ({
      ...d,
      created_date: d.created_at,
      // Normalise stock to a single quantity_in_stock field
      quantity_in_stock: d.quantity_in_stock ??
        (Array.isArray(d.stock)
          ? d.stock.reduce((s, b) => s + (b.quantity_remaining || 0), 0)
          : 0),
    }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  Prescription: {
    endpoint: '/pharmacy/prescriptions',
    fromAPI: (p) => p && ({ ...p, created_date: p.created_at }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  PrescriptionItem: {
    endpoint: '/pharmacy/prescription-items',
    fromAPI: (i) => i && ({ ...i, created_date: i.created_at }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  Ward: {
    endpoint: '/admissions/wards',
    fromAPI: (w) => w && ({ ...w, created_date: w.created_at }),
    toAPI: (d) => d,
    filterMap: {},
  },

  Bed: {
    endpoint: '/admissions/beds',
    fromAPI: (b) => b && ({ ...b, created_date: b.created_at }),
    toAPI: (d) => d,
    filterMap: { status: 'status' },
  },

  Admission: {
    endpoint: '/admissions',
    fromAPI: (a) => a && ({
      ...a,
      created_date: a.created_at,
      admission_date: a.admitted_at,
    }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  Invoice: {
    endpoint: '/billing/invoices',
    fromAPI: (i) => i && ({
      ...i,
      paid_amount: i.amount_paid ?? i.paid_amount ?? 0,
      net_amount: i.total_amount - (i.balance ?? 0),
      created_date: i.created_at,
    }),
    toAPI: (d) => d,
    filterMap: { paid_amount: 'amount_paid', created_date: 'created_at' },
  },

  Payment: {
    endpoint: '/billing/payments',
    fromAPI: (p) => p && ({
      ...p,
      payment_method: p.payment_mode ?? p.payment_method,
      payment_date: p.created_at,
      created_date: p.created_at,
    }),
    toAPI: (d) => d,
    filterMap: { payment_method: 'payment_mode', created_date: 'created_at' },
  },

  InvoiceItem: {
    endpoint: '/billing/invoice-items',
    fromAPI: (i) => i && ({ ...i, created_date: i.created_at }),
    toAPI: (d) => d,
    filterMap: {},
  },

  VitalSigns: {
    endpoint: '/nursing/vitals',
    fromAPI: (v) => v && ({
      ...v,
      created_date: v.recorded_at || v.created_at,
    }),
    toAPI: (d) => d,
    filterMap: {},
  },

  AuditLog: {
    endpoint: '/admin/audit-logs',
    fromAPI: (a) => a && ({ ...a, created_date: a.timestamp || a.created_at }),
    toAPI: (d) => d,
    filterMap: {},
  },

  // Read-only flattened view of resulted lab order items. Result *entry* still
  // flows through the normalized /lab/orders/{id}/results/{item_id} endpoint;
  // creating a LabResult directly from the Base44 page is not wired (see notes).
  LabResult: {
    endpoint: '/lab/results',
    fromAPI: (r) => r && ({ ...r, created_date: r.resulted_at || r.created_at }),
    toAPI: (d) => d,
    filterMap: {},
  },

  User: {
    endpoint: '/admin/users',
    fromAPI: (u) => u && ({
      ...u,
      created_date: u.created_at,
      name: u.full_name,
      email: u.email || `${u.employee_id}@zcpc.local`,
    }),
    toAPI: (d) => d,
    filterMap: {},
  },
};

// Entities with no FastAPI endpoint — return empty data gracefully
// (keeps UI from crashing; features gradually become available as endpoints are added)
const STUB_ENTITIES = new Set([
  'PatientJourney', 'Notification', 'Appointment', 'InsuranceClaim',
  'MedicalAidScheme', 'InvoiceSplit', 'PharmacyDispensing', 'ImagingOrder',
  'ImagingResult', 'SurgicalBooking', 'SurgicalChecklist', 'SurgicalRequisition',
  'SurgicalDispensing', 'SurgicalSupplyKit', 'MaternalVisit', 'NewbornRecord',
  'PartographEntry', 'WardTransfer', 'Discharge', 'Diagnosis', 'PatientAllergy',
  'LabReagent', 'AuditFlag', 'IncidentReport', 'DigitalSignature',
  'IPCSurveillance', 'WasteLog', 'WasteCategory', 'DeathCertificate',
  'DHIS2Export', 'DoctorSchedule', 'DoctorHandover', 'ShiftHandoverLog',
  'LoginSession', 'StaffCompliance', 'UserSecurity', 'NurseTask',
  'ClinicalTemplate', 'HandoverTemplate', 'NursingCarePlan', 'ClinicalPlan',
  'ExchangeRate', 'CashierShift',
]);

// ─── FILTER HELPERS ───────────────────────────────────────────────────────────

// Builds FastAPI query params from a Base44 filter object.
// $in operators are skipped here and handled client-side to avoid server-side
// incompatibility with comma-joined values.
function buildParams(filters, def, limit) {
  const params = {};
  if (limit) params.limit = limit;
  if (!filters) return params;

  const fm = def?.filterMap || {};
  for (const [key, val] of Object.entries(filters)) {
    const apiKey = fm[key] ?? key;
    if (val !== null && typeof val === 'object' && '$in' in val) {
      // Handled client-side after fetch
    } else if (val !== null && val !== undefined) {
      params[apiKey] = val;
    }
  }
  return params;
}

// Post-fetch client-side filter for $in operators.
function applyClientFilter(arr, filters, def) {
  if (!filters) return arr;
  const fm = def?.filterMap || {};
  return arr.filter((item) =>
    Object.entries(filters).every(([key, val]) => {
      if (val !== null && typeof val === 'object' && '$in' in val) {
        const apiKey = fm[key] ?? key;
        // Check both the API field name and original Base44 field name
        return val.$in.includes(item[apiKey]) || val.$in.includes(item[key]);
      }
      return true;
    })
  );
}

// ─── ENTITY HANDLER ───────────────────────────────────────────────────────────

// No-op real-time subscription. Base44 supports live entity subscriptions;
// the FastAPI backend does not (yet), so return an unsubscribe function that
// does nothing. This keeps components that call `.subscribe()` from crashing.
function noopSubscribe() {
  return () => {};
}

function stubHandler() {
  return {
    list: async () => [],
    filter: async () => [],
    get: async () => null,
    create: async (data) => ({
      ...data,
      id: crypto.randomUUID(),
      created_date: new Date().toISOString(),
    }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => {},
    subscribe: noopSubscribe,
  };
}

function liveHandler(def, http) {
  const xform = def.fromAPI || ((x) => x);
  const toAPI = def.toAPI || ((x) => x);

  function normalise(data) {
    const arr = Array.isArray(data) ? data : (data?.items || data?.results || []);
    return arr.map(xform);
  }

  return {
    async list(_sortBy, limit) {
      const data = await http.get(def.endpoint, { params: buildParams(null, def, limit) });
      return normalise(data);
    },

    async filter(filters, _sortBy, limit) {
      const data = await http.get(def.endpoint, { params: buildParams(filters, def, limit) });
      return applyClientFilter(normalise(data), filters, def);
    },

    async get(id) {
      const data = await http.get(`${def.endpoint}/${id}`);
      return xform(data);
    },

    async create(body) {
      const data = await http.post(def.endpoint, toAPI(body));
      return xform(data);
    },

    async update(id, body) {
      const data = await http.put(`${def.endpoint}/${id}`, toAPI(body));
      return xform(data);
    },

    async delete(id) {
      await http.del(`${def.endpoint}/${id}`);
    },

    subscribe: noopSubscribe,
  };
}

// ─── FUNCTION HANDLERS ────────────────────────────────────────────────────────

async function invokeFunction(name, params, http) {
  if (name === 'generateDailyReport') {
    const data = await http.get('/admin/stats');
    return { data };
  }

  if (name === 'checkInventoryAlerts') {
    try {
      const raw = await http.get('/pharmacy/drugs', { params: { limit: 500 } });
      const drugs = Array.isArray(raw) ? raw : (raw?.items || raw?.results || []);
      const allAlerts = [];
      let lowStock = 0;
      for (const d of drugs) {
        const qty = d.quantity_in_stock ?? (Array.isArray(d.stock) ? d.stock.reduce((s, b) => s + (b.quantity_remaining || 0), 0) : 0);
        const reorder = d.reorder_level ?? 10;
        if (qty === 0) {
          lowStock++;
          allAlerts.push({ severity: 'critical', message: `${d.name}: Out of stock` });
        } else if (qty <= reorder) {
          lowStock++;
          allAlerts.push({ severity: 'warning', message: `${d.name}: Low stock (${qty} remaining)` });
        }
      }
      return { data: { total_alerts: allAlerts.length, alerts: allAlerts, low_stock_count: lowStock, expiring_count: 0, expired_count: 0 } };
    } catch {
      return { data: { total_alerts: 0, alerts: [], low_stock_count: 0, expiring_count: 0, expired_count: 0 } };
    }
  }

  if (name === 'runExpiryAlerts') {
    return { data: { total_notifications: 0, notifications: [] } };
  }

  // All other Base44 serverless functions are stubs.
  // Add cases here as FastAPI equivalents are built.
  // Return `data: null` (not a truthy placeholder): components consistently
  // guard with `if (!data) return null` or fall back via `result || emptyData`,
  // both of which only work when the stub result is falsy.
  console.info(`[zcpc-custom] function stub: ${name}`, params);
  return { data: null };
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

function makeAuth(http) {
  return {
    async me() {
      if (!getToken()) {
        // Mirror the error shape AuthContext expects for auth_required
        const err = new Error('Not authenticated');
        err.status = 403;
        err.data = { extra_data: { reason: 'auth_required' } };
        throw err;
      }
      const data = await http.get('/auth/me');
      return {
        ...data,
        email: data.email || `${data.employee_id}@zcpc.local`,
      };
    },

    // Primary login method used by CustomLogin.jsx
    async login(employeeId, password) {
      const data = await http.post('/auth/login', { employee_id: employeeId, password });
      setTokens(data.access_token, data.refresh_token);
      return data;
    },

    // Called by Login.jsx (Base44's email/password flow) — treat the email field as employee_id
    async loginViaEmailPassword(email, password) {
      return this.login(email, password);
    },

    // Social/provider login is not supported in custom backend mode
    loginWithProvider(_provider, redirectUrl) {
      console.warn('[zcpc-custom] Social login unavailable in custom backend mode');
      const next = encodeURIComponent(redirectUrl || '/');
      window.location.href = `/custom-login?next=${next}`;
    },

    logout(redirectUrl) {
      clearTokens();
      // Redirect to custom login, preserving the return URL if one was provided
      window.location.href = redirectUrl
        ? `/custom-login?next=${encodeURIComponent(redirectUrl)}`
        : '/custom-login';
    },

    redirectToLogin(returnUrl) {
      // Guard against redirect loops when already on the login page
      if (window.location.pathname.startsWith('/custom-login')) return;
      const next = encodeURIComponent(returnUrl || window.location.pathname);
      window.location.href = `/custom-login?next=${next}`;
    },
  };
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export function createCustomClient(baseURL) {
  const http = makeHttp(baseURL);
  const auth = makeAuth(http);

  return {
    entities: new Proxy(
      {},
      {
        get(_, entityName) {
          if (typeof entityName !== 'string') return undefined;
          if (STUB_ENTITIES.has(entityName)) return stubHandler();
          const def = ENTITY_DEFS[entityName];
          if (!def) {
            console.warn(`[zcpc-custom] Unknown entity: ${entityName} — returning empty stub`);
            return stubHandler();
          }
          return liveHandler(def, http);
        },
      }
    ),

    auth,

    functions: {
      invoke: (name, params) => invokeFunction(name, params, http),
    },

    integrations: {
      Core: {
        UploadFile: async ({ file }) => {
          const form = new FormData();
          form.append('file', file);
          const data = await doFetch(baseURL, '/files/upload', {
            method: 'POST',
            body: form,
          });
          return { data };
        },
      },
    },
  };
}
