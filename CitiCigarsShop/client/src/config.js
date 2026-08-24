// En production sur WHC, utiliser l'API Render
const isProduction = import.meta.env.PROD;
const LIVE_API_URL = 'https://citicigars-api.onrender.com';
const STAGING_API_URL = 'https://citicigars-api-staging.onrender.com';

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

const defaultApiUrl =
  hostname === 'citicigars-api-staging.onrender.com'
    ? STAGING_API_URL
    : (isProduction ? LIVE_API_URL : '');

export const API_URL = import.meta.env.VITE_API_URL || defaultApiUrl;

export const getApiUrl = (path) => {
  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};
