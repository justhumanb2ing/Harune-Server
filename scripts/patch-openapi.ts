import { readFile, writeFile } from "node:fs/promises";

const openApiPath = "./src/generated/openapi.json";

type OpenApiDocument = {
  paths?: Record<string, Record<string, unknown>>;
};

const raw = await readFile(openApiPath, "utf8");
const openApi = JSON.parse(raw) as OpenApiDocument;

const metadataGet = openApi.paths?.["/metadata"]?.get as
  | {
      parameters?: unknown[];
      responses?: Record<string, unknown>;
    }
  | undefined;

if (!metadataGet) {
  throw new Error("Could not find /metadata GET operation in openapi.json");
}

metadataGet.responses ??= {};
metadataGet.responses["200"] = {
  description: "Successful metadata response.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          url: { type: "string" },
          canonicalUrl: { type: "string", nullable: true },
          title: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          image: { type: "string", nullable: true },
          siteName: { type: "string", nullable: true },
          favicon: { type: "string", nullable: true },
        },
        required: [
          "url",
          "canonicalUrl",
          "title",
          "description",
          "image",
          "siteName",
          "favicon",
        ],
      },
    },
  },
};

metadataGet.parameters = [
  {
    name: "url",
    in: "query",
    required: true,
    description: "URL to fetch metadata from.",
    schema: {
      type: "string",
    },
  },
];

await writeFile(openApiPath, `${JSON.stringify(openApi, null, 2)}\n`);
