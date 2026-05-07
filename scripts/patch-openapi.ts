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

metadataGet.responses = metadataGet.responses ?? {};
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

metadataGet.responses["400"] = {
  description:
    "Invalid URL request. Returned when the url query parameter is missing, empty, malformed, or uses an unsupported protocol.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: {
                type: "string",
                enum: ["missing_url", "invalid_url", "invalid_protocol", "blocked_host"],
              },
              message: { type: "string" },
              details: {
                oneOf: [
                  {},
                  {
                    type: "object",
                    properties: {
                      rawUrl: { type: "string" },
                      protocol: { type: "string" },
                      hostname: { type: "string" },
                    },
                  },
                ],
              },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      examples: {
        missingUrl: {
          summary: "Missing url",
          value: {
            error: {
              code: "missing_url",
              message: "url query parameter is required",
            },
          },
        },
      },
    },
  },
};

metadataGet.responses["404"] = {
  description: "Target was not found.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", enum: ["not_found"] },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
};

metadataGet.responses["500"] = {
  description: "Internal metadata processing failure.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", enum: ["internal_error"] },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
};

metadataGet.responses["502"] = {
  description: "Upstream metadata fetch failed.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", enum: ["fetch_failed"] },
              message: { type: "string" },
              details: {
                oneOf: [
                  {},
                  {
                    type: "object",
                    properties: {
                      reason: { type: "string" },
                      status: { type: "number" },
                    },
                  },
                ],
              },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
};

delete metadataGet.responses["default"];

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

const handleGet = openApi.paths?.["/handle/check"]?.get as
  | {
      parameters?: unknown[];
      responses?: Record<string, unknown>;
    }
  | undefined;

if (!handleGet) {
  throw new Error("Could not find /handle/check GET operation in openapi.json");
}

handleGet.responses ??= {};
handleGet.responses["200"] = {
  description: "Available when the handle is unused or already owned by the current session user.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          available: { type: "boolean" },
        },
        required: ["available"],
      },
      examples: {
        available: {
          summary: "Handle can be used",
          value: { available: true },
        },
        unavailable: {
          summary: "Handle is already owned by another user",
          value: { available: false },
        },
      },
    },
  },
};

handleGet.responses["400"] = {
  description: "Invalid request. Returned when the handle is missing, empty, malformed, or reserved.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", enum: ["validation_error"] },
              message: { type: "string" },
              details: {
                oneOf: [
                  {},
                  {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        reason: { type: "string" },
                        message: { type: "string" },
                        type: { type: "string" },
                      },
                    },
                  },
                ],
              },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      examples: {
        required: {
          summary: "Missing handle",
          value: {
            error: {
              code: "validation_error",
              message: "invalid request",
            },
          },
        },
      },
    },
  },
};

handleGet.responses["401"] = {
  description: "Authentication required.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", enum: ["unauthorized"] },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      examples: {
        unauthorized: {
          summary: "No session",
          value: {
            error: {
              code: "unauthorized",
              message: "authentication required",
            },
          },
        },
      },
    },
  },
};

handleGet.parameters = [
  {
    name: "handle",
    in: "query",
    required: true,
    description:
      "Handle to check. The server trims whitespace, lowercases the value, and applies the canonical handle validation rules before looking it up in the database.",
    schema: {
      type: "string",
    },
  },
];

const profileGet = openApi.paths?.["/profile/{handle}"]?.get as
  | {
      parameters?: unknown[];
      responses?: Record<string, unknown>;
      summary?: string;
      description?: string;
      tags?: string[];
      operationId?: string;
    }
  | undefined;

if (!profileGet) {
  throw new Error("Could not find /profile/{handle} GET operation in openapi.json");
}

profileGet.summary = "Get a profile by handle";
profileGet.description =
  "Returns a profile page and its bento blocks for the provided handle. This endpoint is read-only and does not require authentication. If a session is present, the `viewer` object reflects whether the current user can edit the page.";
profileGet.operationId = "getProfileByHandle";
profileGet.tags = ["Profile API"];
profileGet.parameters = [
  {
    name: "handle",
    in: "path",
    required: true,
    description:
      "Profile handle from the URL path. The route forwards this value directly to the lookup layer.",
    schema: {
      type: "string",
    },
    example: "kinmongsang",
  },
];
profileGet.responses = {
  200: {
    description:
      "Successful profile response. `layout` is always present for every bento item. `viewer.canEdit` is true only for the authenticated owner of the page.",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            page: {
              type: "object",
              properties: {
                id: { type: "string" },
                userId: { type: "string" },
                handle: { type: "string" },
                name: { type: "string", nullable: true },
                role: { type: "string", nullable: true },
                bio: { type: "string", nullable: true },
                image: { type: "string", nullable: true },
                backgroundImage: { type: "string", nullable: true },
                location: { type: "string", nullable: true },
                updatedAt: {
                  type: "string",
                  format: "date-time",
                },
              },
              required: [
                "id",
                "userId",
                "handle",
                "name",
                "role",
                "bio",
                "image",
                "backgroundImage",
                "location",
                "updatedAt",
              ],
            },
            bento: {
              type: "array",
              items: {
                oneOf: [
                  profileLinkBentoSchema(),
                  profileTextBentoSchema(),
                  profilePlaylistBentoSchema(),
                  profileSectionBentoSchema(),
                  profileMediaBentoSchema(),
                  profileMapBentoSchema(),
                ],
              },
            },
            viewer: {
              type: "object",
              properties: {
                isAuthenticated: { type: "boolean" },
                userId: { type: "string", nullable: true },
                canEdit: { type: "boolean" },
              },
              required: ["isAuthenticated", "userId", "canEdit"],
            },
          },
          required: ["page", "bento", "viewer"],
        },
        examples: {
          default: {
            value: {
              page: {
                id: "profile_page_123",
                userId: "user_456",
                handle: "kinmongsang",
                name: "Kinmongsang",
                role: "Photographer",
                bio: "Photo community profile",
                image: "https://cdn.example.com/avatar.jpg",
                backgroundImage: "https://cdn.example.com/background.jpg",
                location: "Seoul, KR",
                updatedAt: "2026-05-07T00:00:00.000Z",
              },
              bento: [
                {
                  id: "bento_link_1",
                  type: "link",
                  layout: {
                    desktop: { x: 0, y: 0, w: 4, h: 2 },
                    compact: { x: 0, y: 0, w: 2, h: 2 },
                  },
                  content: {
                    title: "Portfolio",
                    description: "Main portfolio site",
                    favicon: "https://cdn.example.com/favicon.ico",
                    thumbnail: "https://cdn.example.com/thumb.jpg",
                    url: "https://example.com",
                  },
                },
              ],
              viewer: {
                isAuthenticated: true,
                userId: "user_456",
                canEdit: true,
              },
            },
          },
        },
      },
    },
  },
  404: {
    description: "No profile page exists for the requested handle.",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "profile_not_found" },
                message: { type: "string", example: "profile not found" },
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
      },
    },
  },
  500: {
    description:
      "Internal profile data is inconsistent. This usually means a required layout or subtype row is missing.",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
      },
    },
  },
};

await writeFile(openApiPath, `${JSON.stringify(openApi, null, 2)}\n`);

function profileBaseLayoutSchema() {
  return {
    type: "object",
    properties: {
      x: { type: "number" },
      y: { type: "number" },
      w: { type: "number" },
      h: { type: "number" },
    },
    required: ["x", "y", "w", "h"],
  };
}

function profileLayoutSchema() {
  return {
    type: "object",
    properties: {
      desktop: profileBaseLayoutSchema(),
      compact: profileBaseLayoutSchema(),
    },
    required: ["desktop", "compact"],
  };
}

function profileLinkBentoSchema() {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["link"] },
      layout: profileLayoutSchema(),
      content: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string", nullable: true },
          favicon: { type: "string", nullable: true },
          thumbnail: { type: "string", nullable: true },
          url: { type: "string" },
        },
        required: ["title", "description", "favicon", "thumbnail", "url"],
      },
    },
    required: ["id", "type", "layout", "content"],
  };
}

function profileTextBentoSchema() {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["text"] },
      layout: profileLayoutSchema(),
      content: {
        type: "object",
        properties: {
          content: { type: "string" },
        },
        required: ["content"],
      },
    },
    required: ["id", "type", "layout", "content"],
  };
}

function profilePlaylistBentoSchema() {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["playlist"] },
      layout: profileLayoutSchema(),
      content: {
        type: "object",
        properties: {
          title: { type: "string" },
          provider: { type: "string" },
          url: { type: "string" },
          content: { type: "string" },
        },
        required: ["title", "provider", "url", "content"],
      },
    },
    required: ["id", "type", "layout", "content"],
  };
}

function profileSectionBentoSchema() {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["section"] },
      layout: profileLayoutSchema(),
      content: {
        type: "object",
        properties: {
          title: { type: "string" },
        },
        required: ["title"],
      },
    },
    required: ["id", "type", "layout", "content"],
  };
}

function profileMediaBentoSchema() {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["media"] },
      layout: profileLayoutSchema(),
      content: {
        type: "object",
        properties: {
          mediaType: { type: "string", enum: ["image", "video"] },
          url: { type: "string" },
          objectKey: { type: "string" },
          href: { type: "string", nullable: true },
          alt: { type: "string" },
          caption: { type: "string" },
        },
        required: ["mediaType", "url", "objectKey", "href", "alt", "caption"],
      },
    },
    required: ["id", "type", "layout", "content"],
  };
}

function profileMapBentoSchema() {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["map"] },
      layout: profileLayoutSchema(),
      content: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
          zoom: { type: "number" },
          caption: { type: "string" },
          url: { type: "string" },
        },
        required: ["latitude", "longitude", "zoom", "caption", "url"],
      },
    },
    required: ["id", "type", "layout", "content"],
  };
}
