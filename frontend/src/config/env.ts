export const env = {
  API_BASE_URL:
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  APP_ENV: import.meta.env.VITE_APP_ENV || "development",
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === "true",
} as const;
