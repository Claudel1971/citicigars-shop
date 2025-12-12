// En production sur WHC, utiliser l'API Render
const isProduction = import.meta.env.PROD;
const RENDER_API_URL = 'https://citicigars-api.onrender.com';

export const API_URL = import.meta.env.VITE_API_URL || (isProduction ? RENDER_API_URL : '');

export const getApiUrl = (path) => {
  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};
