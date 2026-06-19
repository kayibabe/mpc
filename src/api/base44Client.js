import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { createCustomClient } from './customClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Environment detection:
//   Base44 mode  — appId is injected via ?app_id= URL param by the Base44 runtime,
//                  or set via VITE_BASE44_APP_ID in a Base44-hosted build.
//   Custom mode  — no appId; VITE_BACKEND_URL points to the self-hosted FastAPI server.
export const isBase44Env = !!appId;

const customBackendURL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1';

export const base44 = isBase44Env
  ? createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl,
    })
  : createCustomClient(customBackendURL);
