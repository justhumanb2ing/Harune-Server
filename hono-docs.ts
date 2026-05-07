import { defineConfig } from "@rcmade/hono-docs";

export default defineConfig({
  tsConfigPath: "./tsconfig.json",
  openApi: {
    openapi: "3.0.0",
    info: {
      title: "Harune API",
      version: "1.0.0",
      description: "API documentation for Harune",
    },
    servers: [
      { url: "http://localhost:8787" },
      { url: "https://api.harune.me" },
    ],
  },
  outputs: {
    openApiJson: "./src/generated/openapi.json",
  },
  apis: [
    {
      name: "Metadata API",
      apiPrefix: "/metadata",
      appTypePath: "src/routes/metadata-route.ts",
      api: [
        {
          api: "/",
          method: "get",
          summary: "Fetch metadata for a URL",
          description: "Returns metadata extracted from the target URL.",
          tag: ["Metadata API"],
        },
      ],
    },
    {
      name: "Handle API",
      apiPrefix: "/handle",
      appTypePath: "src/routes/handle-route.ts",
      api: [
        {
          api: "/check",
          method: "get",
          summary: "Check handle availability",
          description:
            "Checks whether the authenticated user can use a handle. The requested value is normalized to lowercase before validation. Empty values, invalid formats, and reserved handles are rejected with a validation error. When the session is missing the route returns 401. When the handle is already owned by the current user it is treated as available; when another user owns it the response is { available: false }.",
          tag: ["Handle API"],
        },
      ],
    },
    {
      name: "Profile API",
      apiPrefix: "/profile",
      appTypePath: "src/routes/profile-route.ts",
      api: [
        {
          api: "/:handle",
          method: "get",
          summary: "Get profile by handle",
          description:
            "Returns the profile page, bento blocks, and viewer state for the requested handle. The handle is treated as a path parameter and is not revalidated beyond being present.",
          tag: ["Profile API"],
        },
      ],
    },
  ],
});
