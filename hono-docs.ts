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
  ],
});
