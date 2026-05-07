const handleRegex = /^[A-Za-z0-9_]+$/;

const reservedHandles = new Set([
  "app",
  "api",
  "billing",
  "blog",
  "changelog",
  "cookie",
  "create",
  "docs",
  "join",
  "explore",
  "profile",
  "privacy",
  "refund",
  "roadmap",
  "sign-in",
  "sign-up",
  "subscribe",
  "terms",
]);

export const normalizeHandle = (value: string) => value.trim().toLowerCase();

export const isValidHandleFormat = (value: string) => handleRegex.test(value);

export const isReservedHandle = (value: string) => reservedHandles.has(value.toLowerCase());

export const validateHandle = (value: string) => {
  const normalizedHandle = normalizeHandle(value);

  if (!normalizedHandle) {
    return "Handle is required.";
  }

  if (!isValidHandleFormat(normalizedHandle)) {
    return "Only letters, numbers, and underscores are allowed.";
  }

  if (isReservedHandle(normalizedHandle)) {
    return "This handle is not available.";
  }

  return null;
};

