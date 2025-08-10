const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  const isDev = import.meta.env.DEV;
  
  if (isDev) {
    return "http://localhost:8000/api/v1";
  }
  
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    return `${protocol}//${hostname}${port ? `:${port}` : ''}/api/v1`;
  }
  
  return "http://localhost:8000/api/v1";
};

export const env = {
  API_BASE_URL: getApiBaseUrl(),
  APP_ENV: import.meta.env.VITE_APP_ENV || "development",
} as const;
