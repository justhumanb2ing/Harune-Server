export const BASE_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8787",
  "https://harune.me",
  "https://www.harune.me",
];

type OriginEnv = {
  FRONTEND_URL?: string;
};

export function getAllowedOrigins(env?: OriginEnv) {
  return [...new Set([...BASE_ORIGINS, env?.FRONTEND_URL].filter((origin): origin is string => Boolean(origin)))];
}
