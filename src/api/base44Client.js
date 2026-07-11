import { createCustomClient } from './customClient';

const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1';

export const base44 = createCustomClient(backendURL);
