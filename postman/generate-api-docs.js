/**
 * Harmoniv Time — API Documentation Generator
 *
 * Generates a Postman Collection, Postman Environment and an OpenAPI 3.0 spec
 * directly from the source, tailored to this project's architecture:
 *
 *   - Route gateways live in  src/routes/<gateway>/index.ts  and mount module
 *     routers with  router.use("/products", productRouter)  (gateway adds the
 *     resource prefix; everything is served under /api).
 *   - Endpoints are defined in module route files  src/modules/.../X.routes.ts
 *     using  router.get("/:id", validate(schema), controller)  where controller
 *     functions are imported from the sibling  ./X.controller  file.
 *   - Validation is inline  validate(schemaName)  with schemas imported from
 *     the sibling  ./X.validation  file.
 *   - Auth is a single  authMiddleware.
 *
 * Run: npm run docs:generate [-- --version=1.0.0] [-- --bump=patch|minor|major]
 */

const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  MODULES_DIR: path.join(__dirname, "../src/modules"),
  ROUTES_LAYER_DIR: path.join(__dirname, "../src/routes"), // gateway dirs
  POSTMAN_DIR: path.join(__dirname, "collections"),
  ENV_DIR: path.join(__dirname, "environments"),
  OPENAPI_DIR: path.join(__dirname, "openapi"),
  VERSION_FILE: path.join(__dirname, "version.json"),
  BASE_NAME: "harmoniv_time",
  API_TITLE: "Harmoniv Time API",
  BASE_URL: "http://localhost:5000/api",
  PROD_URL: "https://api.harmonivtime.com/api",
};

[CONFIG.POSTMAN_DIR, CONFIG.ENV_DIR, CONFIG.OPENAPI_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============================================================================
// UTILITIES
// ============================================================================

function titleCase(str) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function jsonToYaml(obj, indent = 0) {
  const spaces = "  ".repeat(indent);
  let yaml = "";

  if (Array.isArray(obj)) {
    if (obj.length === 0) return `[]\n`;
    obj.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        yaml += `${spaces}-\n${jsonToYaml(item, indent + 1)}`;
      } else {
        yaml += `${spaces}- ${formatYamlValue(item)}\n`;
      }
    });
  } else if (typeof obj === "object" && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      if (value === undefined) return;
      if (Array.isArray(value)) {
        if (value.length === 0) yaml += `${spaces}${key}: []\n`;
        else yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
      } else if (typeof value === "object" && value !== null) {
        yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
      } else {
        yaml += `${spaces}${key}: ${formatYamlValue(value)}\n`;
      }
    });
  }
  return yaml;
}

function formatYamlValue(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number")
    return value.toString();
  if (typeof value === "string") {
    if (/[\n:#"]/.test(value)) {
      const escaped = value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
      return `"${escaped}"`;
    }
    return value || '""';
  }
  return String(value);
}

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

function getVersionInfo() {
  if (fs.existsSync(CONFIG.VERSION_FILE))
    return JSON.parse(fs.readFileSync(CONFIG.VERSION_FILE, "utf-8"));
  return { current: "1.0.0", history: [] };
}

function saveVersionInfo(info) {
  fs.writeFileSync(CONFIG.VERSION_FILE, JSON.stringify(info, null, 2));
}

function incrementVersion(current, bumpType = "patch") {
  const [major, minor, patch] = current.split(".").map(Number);
  if (bumpType === "major") return `${major + 1}.0.0`;
  if (bumpType === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// ============================================================================
// JOI SCHEMA PARSING
// ============================================================================

function parseValidationFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const schemas = {};

  // export const X = Joi.object({ ... });   (also handles .fork(...).min() chains)
  const schemaRegex = /export\s+const\s+(\w+)\s*=\s*Joi\.object\s*\(\s*\{/g;
  let match;
  while ((match = schemaRegex.exec(content)) !== null) {
    const schemaName = match[1];
    const body = extractBalancedBraces(content, match.index + match[0].length - 1);
    if (body) schemas[schemaName] = parseJoiSchemaBody(body);
  }
  return schemas;
}

function extractBalancedBraces(content, startIndex) {
  let depth = 0;
  let start = -1;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (content[i] === "}") {
      depth--;
      if (depth === 0) return content.substring(start + 1, i);
    }
  }
  return null;
}

function parseJoiSchemaBody(schemaBody) {
  const fields = {};
  const fieldMatches = schemaBody.matchAll(
    /(\w+)\s*:\s*Joi\.(\w+)\s*\(\s*([^)]*)\s*\)([\s\S]*?)(?=,\s*\w+\s*:|$)/g
  );
  for (const match of fieldMatches) {
    const [, fieldName, joiType, typeArgs, constraints] = match;
    fields[fieldName] = {
      type: mapJoiType(joiType),
      joiType,
      required:
        constraints.includes(".required()") &&
        !constraints.includes(".optional()"),
      constraints: parseJoiConstraints(constraints),
    };
  }
  return fields;
}

function mapJoiType(joiType) {
  const map = {
    string: "string",
    number: "number",
    boolean: "boolean",
    array: "array",
    object: "object",
    date: "string",
    binary: "string",
    any: "any",
  };
  return map[joiType] || "string";
}

function parseJoiConstraints(constraints) {
  const result = {};
  const min = constraints.match(/\.min\(\s*(-?\d+(?:\.\d+)?)\s*\)/);
  if (min) result.min = parseFloat(min[1]);
  const max = constraints.match(/\.max\(\s*(-?\d+(?:\.\d+)?)\s*\)/);
  if (max) result.max = parseFloat(max[1]);
  if (constraints.includes(".email()")) result.format = "email";
  if (constraints.includes(".uri()")) result.format = "uri";
  if (constraints.includes(".integer()")) result.integer = true;

  const valid = constraints.match(/\.valid\s*\(\s*([^)]+)\s*\)/);
  if (valid) {
    result.enum = valid[1]
      .split(",")
      .map((v) => v.trim().replace(/["'.]/g, (m) => (m === "." ? "." : "")))
      .map((v) => (v.includes(".") ? v.split(".").pop() : v))
      .map((v) => v.replace(/["']/g, ""))
      .filter(Boolean);
  }
  const def = constraints.match(/\.default\(\s*["']?([^"')]+)["']?\s*\)/);
  if (def) result.default = def[1];
  return result;
}

// ============================================================================
// EXAMPLE DATA GENERATION (watch-marketplace flavoured)
// ============================================================================

function generateExample(schema) {
  if (!schema || Object.keys(schema).length === 0) return {};
  const example = {};
  for (const [fieldName, field] of Object.entries(schema))
    example[fieldName] = generateFieldExample(fieldName, field);
  return example;
}

const SAMPLE_OBJECT_ID = "507f1f77bcf86cd799439011";

function generateFieldExample(fieldName, field) {
  const name = fieldName.toLowerCase();
  const { type, constraints = {} } = field;

  if (constraints.enum && constraints.enum.length > 0) return constraints.enum[0];
  if (constraints.default !== undefined) return constraints.default;

  if (type === "string") {
    if (name.includes("phone") || name.includes("mobile")) return "+919876543210";
    if (name === "countrycode") return "+91";
    if (name.includes("otp")) return "123456";
    if (name.includes("password")) return "Password@123";
    if (name.includes("email") || constraints.format === "email")
      return "user@example.com";
    if (
      name.includes("url") ||
      name.includes("image") ||
      name.includes("photo") ||
      constraints.format === "uri"
    )
      return "https://i.ibb.co/abc123/watch.jpg";

    // Razorpay fields
    if (name === "razorpay_order_id") return "order_DBJOWzybf0sJbb";
    if (name === "razorpay_payment_id") return "pay_DBJOWzybf0sJbb";
    if (name === "razorpay_signature")
      return "d9e3b4be4c0489eb6a5a1a93e6a5c1ef8b4f0e75c8f2e";

    // ObjectId reference fields (anything ending in ID / Id)
    if (/(^|[a-z])id$/i.test(fieldName) || name.endsWith("ids"))
      return SAMPLE_OBJECT_ID;

    // Watch-domain names
    if (name === "productname") return "Submariner Date";
    if (name === "brandname") return "Rolex";
    if (name === "collectionname") return "Submariner";
    if (name === "categoryname") return "Diver";
    if (name === "recipientname") return "Men";
    if (name === "dialcolorname") return "Black";
    if (name === "movementname") return "Automatic";
    if (name === "strapmaterialname") return "Oystersteel";
    if (name === "casematerialname") return "Stainless Steel";
    if (name === "watchmarkername") return "Index";
    if (name === "deliveryoptionname") return "Standard Delivery";
    if (name === "offername") return "Festive Sale";

    // Shipment fields
    if (name === "courier") return "BlueDart";
    if (name === "trackingnumber") return "1Z999AA10123456784";
    if (name === "shipmentstatus") return "Shipped";

    // Address fields
    if (name.includes("firstname")) return "John";
    if (name.includes("lastname")) return "Doe";
    if (name.includes("addressline1")) return "123 Main Street";
    if (name.includes("addressline2")) return "Apt 4B";
    if (name.includes("city")) return "Mumbai";
    if (name.includes("state")) return "Maharashtra";
    if (name.includes("postalcode") || name.includes("pincode")) return "400001";
    if (name.includes("country")) return "India";

    if (name.includes("currency")) return "INR";
    if (name.includes("status")) return "Pending";
    if (name.includes("title")) return "About this watch";
    if (name.includes("content") || name.includes("description"))
      return "A detailed description of the timepiece.";
    if (name.includes("notes")) return "Please deliver after 6 PM";
    if (name.includes("rolename")) return "customer";
    if (name.includes("guarantee")) return "2 years";
    if (name.includes("diameter")) return "41mm";
    if (name.includes("waterresistant")) return "300m";

    return "sample_string";
  }

  if (type === "number") {
    if (name.includes("amount") || name.includes("price") || name.includes("total"))
      return 25000;
    if (name.includes("discountpercentage")) return 10;
    if (name.includes("quantity")) return 1;
    if (name.endsWith("id")) return 3; // numeric RoleID / UserRoleID
    return constraints.min || 0;
  }

  if (type === "boolean") return name.includes("active") ? true : false;
  if (type === "array") {
    if (name.includes("ids")) return [SAMPLE_OBJECT_ID, "507f1f77bcf86cd799439012"];
    if (name.includes("imageurls"))
      return [{ url: "https://i.ibb.co/abc123/watch.jpg", key: "abc123" }];
    if (name.includes("watchbrands")) return [{ BrandName: "Rolex" }];
    return [];
  }
  if (type === "object") return {};
  if (field.joiType === "date") return new Date().toISOString();
  return null;
}

// ============================================================================
// ROUTE DISCOVERY  (gateways → module routers → endpoints)
// ============================================================================

// Read a gateway index.ts and return [{ prefix, moduleDir }].
function parseGateway(gatewayDir) {
  const indexFile = path.join(gatewayDir, "index.ts");
  if (!fs.existsSync(indexFile)) return [];
  const content = fs.readFileSync(indexFile, "utf-8");

  // Map imported router name → resolved module folder.
  const importMap = {};
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let im;
  while ((im = importRegex.exec(content)) !== null) {
    const names = im[1].split(",").map((s) => s.trim()).filter(Boolean);
    const fromPath = im[2];
    if (!fromPath.includes("modules/")) continue;
    const resolved = path.resolve(gatewayDir, fromPath);
    names.forEach((n) => (importMap[n] = resolved));
  }

  // router.use("/prefix", routerName)
  const mounts = [];
  const useRegex = /router\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g;
  let um;
  while ((um = useRegex.exec(content)) !== null) {
    const prefix = um[1];
    const routerName = um[2];
    const moduleDir = importMap[routerName];
    if (moduleDir) mounts.push({ prefix, moduleDir });
  }
  return mounts;
}

// Find the *.routes.ts file inside a module folder.
function findRoutesFile(moduleDir) {
  if (!fs.existsSync(moduleDir)) return null;
  const file = fs
    .readdirSync(moduleDir)
    .find((f) => f.endsWith(".routes.ts"));
  return file ? path.join(moduleDir, file) : null;
}

// Parse a module route file into endpoint objects.
function parseModuleRoutes(routesFile) {
  const content = fs.readFileSync(routesFile, "utf-8");
  const moduleDir = path.dirname(routesFile);

  // Load sibling validation schemas (relative ./X.validation import).
  let schemas = {};
  const valMatch = content.match(/from\s+["']\.\/([\w.-]+\.validation)["']/);
  if (valMatch)
    schemas = parseValidationFile(path.join(moduleDir, valMatch[1] + ".ts"));

  const endpoints = [];
  const lines = content.split("\n");
  let comments = [];
  let buffer = "";
  let multi = false;

  const flush = (str) => {
    const ep = parseRouteLine(str, comments, schemas);
    if (ep) endpoints.push(ep);
    comments = [];
    buffer = "";
  };

  for (const raw of lines) {
    const line = raw.trim();
    const c = line.match(/^\/\/\s*(.+)$/);
    if (c) {
      comments.push(c[1].trim());
      continue;
    }
    if (!multi && /^router\.(get|post|put|patch|delete)\s*\(/i.test(line)) {
      buffer = line;
      multi = !line.endsWith(");");
      if (!multi) flush(buffer);
      else continue;
      continue;
    }
    if (multi) {
      buffer += " " + line;
      if (line.endsWith(");")) {
        flush(buffer);
        multi = false;
      }
      continue;
    }
    if (line && !line.startsWith("import") && !line.startsWith("const"))
      comments = [];
  }
  return endpoints;
}

function parseRouteLine(routeStr, comments, schemas) {
  const methodMatch = routeStr.match(/router\.(get|post|put|patch|delete)\s*\(/i);
  if (!methodMatch) return null;
  const method = methodMatch[1].toUpperCase();

  const pathMatch = routeStr.match(/\(\s*["']([^"']+)["']/);
  if (!pathMatch) return null;
  const route = pathMatch[1];

  const argsMatch = routeStr.match(/\(\s*["'][^"']+["']\s*,(.+)\)/s);
  const args = argsMatch ? argsMatch[1] : "";

  const auth = args.includes("authMiddleware") ? "general" : null;

  let requestBody = null;
  let schemaFields = null;
  const validate = args.match(/validate\s*\(\s*(\w+)\s*\)/);
  if (validate && schemas[validate[1]]) {
    schemaFields = schemas[validate[1]];
    requestBody = generateExample(schemaFields);
  }

  const primaryComment = comments.find((c) => !/^-{2,}/.test(c)) || null;

  return {
    method,
    route,
    auth,
    primaryComment,
    schemaFields,
    requestBody,
    hasBody: ["POST", "PUT", "PATCH"].includes(method),
  };
}

// ============================================================================
// NAMING / DESCRIPTIONS
// ============================================================================

// Action segments that read as verbs — kept as-is rather than prefixed with a CRUD verb.
const VERB_TOKENS = [
  "register", "login", "logout", "verify", "reset", "refresh", "resend",
  "send", "confirm", "cancel", "activate", "deactivate", "create", "update",
  "delete", "upload",
];

// Singularise the last word of a (possibly multi-word) resource label.
function singularize(resource) {
  const words = resource.split(" ");
  let last = words[words.length - 1];
  if (/ies$/i.test(last)) last = last.replace(/ies$/i, "y"); // Categories → Category
  else if (/ss$/i.test(last)) {
    /* keep, e.g. Address */
  } else if (/s$/i.test(last)) last = last.replace(/s$/i, ""); // Products → Product
  words[words.length - 1] = last;
  return words.join(" ");
}

// Produce a human endpoint name. Uses an explicit `//` comment when present;
// otherwise derives a sensible name from the HTTP method + route shape.
function generateEndpointName(method, route, comment, resource) {
  if (comment && comment.length > 3)
    return comment.replace(/^\d+\.\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();

  const segments = route.split("/").filter(Boolean);
  const prefixSeg = segments[0];
  const nonParam = segments.filter((s) => !s.startsWith(":"));
  const last = nonParam[nonParam.length - 1];
  const hasId = route.includes(":");
  const singular = singularize(resource);
  const baseVerb = { GET: "Get", POST: "Create", PUT: "Update", PATCH: "Update", DELETE: "Delete" }[method];

  // Standard CRUD on the resource root or /:id (no extra action segment).
  if (!last || last === prefixSeg) {
    if (method === "GET") return hasId ? `Get ${singular}` : `Get All ${resource}`;
    return `${baseVerb} ${singular}`;
  }

  // There is an action / sub-resource segment beyond the resource prefix.
  const lastIdx = segments.indexOf(last);
  const followedByParam =
    segments[lastIdx + 1] && segments[lastIdx + 1].startsWith(":");
  const actionLabel = titleCase(last.replace(/-/g, " "));

  // Sub-collection lookup: /cart/user/:userID → "Get Cart By User".
  if (followedByParam)
    return `${method === "GET" ? "Get" : baseVerb} ${singular} By ${actionLabel}`;

  if (last === "bulk") return `Bulk Create ${singular}`;

  // Verb-like POST actions (register, login, verify-email, create-order…) read
  // best on their own, without a CRUD prefix.
  const isVerbish = VERB_TOKENS.some((t) => last.toLowerCase().includes(t));
  if (method === "POST" && isVerbish) return actionLabel;

  // Otherwise prefix with the HTTP verb (Update Availability, Get Profile…).
  return `${baseVerb} ${actionLabel}`;
}

function generateEndpointDescription(ep, resource) {
  const parts = [];
  if (ep.primaryComment) parts.push(ep.primaryComment.replace(/^\d+\.\s*/, ""));
  else parts.push(`${ep.method} ${ep.route}`);

  if (ep.auth) parts.push(`\n\n🔐 Requires authentication (Bearer token)`);

  if (ep.schemaFields && Object.keys(ep.schemaFields).length > 0) {
    parts.push("\n\n📋 Request Body Fields:");
    for (const [f, field] of Object.entries(ep.schemaFields))
      parts.push(`• ${f}: ${field.type} ${field.required ? "(required)" : "(optional)"}`);
  }
  return parts.join("\n");
}

// ============================================================================
// POSTMAN
// ============================================================================

function joinRoute(prefix, route) {
  const tail = route === "/" ? "" : route;
  return (prefix + tail).replace(/\/{2,}/g, "/");
}

function createPostmanRequest(ep, resource) {
  const fullRoute = ep.fullRoute;
  const name = generateEndpointName(ep.method, fullRoute, ep.primaryComment, resource);
  const description = generateEndpointDescription(ep, resource);

  const pathParts = fullRoute.split("/").filter(Boolean).map((p) =>
    p.startsWith(":") ? `{{${p.substring(1).toUpperCase()}}}` : p
  );

  const item = {
    name,
    request: {
      method: ep.method,
      header: [],
      url: {
        raw: `{{BASE_URL}}${fullRoute.replace(/:(\w+)/g, "{{$1}}")}`,
        host: ["{{BASE_URL}}"],
        path: pathParts,
      },
      description,
    },
    response: [],
  };

  if (ep.auth) {
    item.request.auth = {
      type: "bearer",
      bearer: [{ key: "token", value: "{{TOKEN}}", type: "string" }],
    };
  }

  if (ep.hasBody && ep.requestBody) {
    item.request.header.push({ key: "Content-Type", value: "application/json" });
    item.request.body = {
      mode: "raw",
      raw: JSON.stringify(ep.requestBody, null, 2),
      options: { raw: { language: "json" } },
    };
  }

  const pathVars = fullRoute.match(/:(\w+)/g);
  if (pathVars) {
    item.request.url.variable = pathVars.map((v) => ({
      key: v.substring(1),
      value: `{{${v.substring(1).toUpperCase()}}}`,
      description: `${titleCase(v.substring(1))}`,
    }));
  }

  item.response = [
    exampleResponse(name, 200),
    exampleResponse(name, 400),
    exampleResponse(name, 401),
  ];
  return item;
}

// Mirrors the project's { message, data } envelope.
function exampleResponse(name, status) {
  let body;
  if (status === 200 || status === 201)
    body = { message: `${name} successful`, data: {} };
  else if (status === 400)
    body = { message: "Validation error", data: [] };
  else if (status === 401) body = { message: "Unauthorized", data: null };
  else body = { message: "Error occurred", data: null };

  const text = { 200: "Success", 400: "Bad Request", 401: "Unauthorized" };
  return {
    name: text[status] || "Response",
    status: text[status] || "Response",
    code: status,
    header: [{ key: "Content-Type", value: "application/json" }],
    body: JSON.stringify(body, null, 2),
  };
}

function generatePostmanCollection(categories, version) {
  return {
    info: {
      name: `Harmoniv Time API v${version}`,
      description: generateCollectionDescription(categories, version),
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      version,
    },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{TOKEN}}", type: "string" }] },
    variable: [{ key: "BASE_URL", value: CONFIG.BASE_URL, type: "string" }],
    item: Object.entries(categories).map(([category, sub]) => {
      const items = [];
      for (const [resource, eps] of Object.entries(sub)) {
        const requests = eps.map((ep) => createPostmanRequest(ep, resource));
        // Avoid a redundant folder-in-folder (e.g. Auth → Auth): when the only
        // resource matches the gateway name, place its requests directly.
        if (resource === category) {
          items.push(...requests);
        } else {
          items.push({
            name: resource,
            description: `${resource} endpoints`,
            item: requests,
          });
        }
      }
      return {
        name: category,
        description: `${category} gateway endpoints`,
        item: items,
      };
    }),
  };
}

function generateCollectionDescription(categories, version) {
  const total = Object.values(categories)
    .flatMap((sub) => Object.values(sub))
    .flat().length;
  let desc = `# Harmoniv Time API v${version}\n\nGenerated: ${new Date().toISOString()}\n\n`;
  desc += `## Summary\n- **Total Endpoints:** ${total}\n- **Gateways:** ${Object.keys(categories).length}\n\n`;
  desc += `## Authentication\nSet \`TOKEN\` in the environment to a Bearer JWT obtained from \`POST /api/auth/login\`.\n\n`;
  desc += `## Gateways\n`;
  for (const [cat, sub] of Object.entries(categories)) {
    const n = Object.values(sub).flat().length;
    desc += `- **${cat}**: ${n} endpoints\n`;
  }
  return desc;
}

// ============================================================================
// ENVIRONMENT
// ============================================================================

function generatePostmanEnvironment(categories, version) {
  const pathVars = new Set();
  Object.values(categories).forEach((sub) =>
    Object.values(sub).forEach((eps) =>
      eps.forEach((ep) => {
        const vars = ep.fullRoute.match(/:(\w+)/g) || [];
        vars.forEach((v) => pathVars.add(v.substring(1).toUpperCase()));
      })
    )
  );

  const values = [
    { key: "BASE_URL", value: CONFIG.BASE_URL, type: "default", enabled: true },
    { key: "TOKEN", value: "", type: "secret", enabled: true },
    ...[...pathVars].sort().map((v) => ({
      key: v,
      value: "",
      type: "default",
      enabled: true,
    })),
  ];

  return {
    id: `harmoniv-env-${version.replace(/\./g, "-")}`,
    name: `Harmoniv Time Environment v${version}`,
    values,
    _postman_variable_scope: "environment",
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: "Harmoniv Time API Doc Generator",
  };
}

// ============================================================================
// OPENAPI
// ============================================================================

function generatePathParameters(route) {
  const params = route.match(/:(\w+)/g);
  if (!params) return undefined;
  return params.map((p) => ({
    name: p.substring(1),
    in: "path",
    required: true,
    schema: { type: "string" },
    description: `${titleCase(p.substring(1))} identifier`,
  }));
}

function generateJsonSchema(schemaFields) {
  if (!schemaFields) return { type: "object", properties: {} };
  const properties = {};
  const required = [];
  for (const [f, field] of Object.entries(schemaFields)) {
    const prop = { type: field.type };
    if (field.constraints) {
      if (field.constraints.format) prop.format = field.constraints.format;
      if (field.constraints.min !== undefined) prop.minimum = field.constraints.min;
      if (field.constraints.max !== undefined) prop.maximum = field.constraints.max;
      if (field.constraints.enum) prop.enum = field.constraints.enum;
    }
    properties[f] = prop;
    if (field.required) required.push(f);
  }
  return { type: "object", properties, required: required.length ? required : undefined };
}

function generateOpenAPISpec(categories, version) {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: CONFIG.API_TITLE,
      version,
      description: "Watch-selling marketplace API",
    },
    servers: [
      { url: CONFIG.BASE_URL, description: "Development" },
      { url: CONFIG.PROD_URL, description: "Production" },
    ],
    tags: Object.keys(categories).map((c) => ({ name: c, description: `${c} endpoints` })),
    paths: {},
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  };

  for (const [category, sub] of Object.entries(categories)) {
    for (const [resource, eps] of Object.entries(sub)) {
      for (const ep of eps) {
        const pathKey = ep.fullRoute.replace(/:(\w+)/g, "{$1}");
        if (!spec.paths[pathKey]) spec.paths[pathKey] = {};

        const op = {
          tags: [category],
          summary: generateEndpointName(ep.method, ep.fullRoute, ep.primaryComment, resource),
          description: generateEndpointDescription(ep, resource),
          operationId: `${ep.method.toLowerCase()}${ep.fullRoute.replace(/[/:{}-]/g, "_")}`,
          parameters: generatePathParameters(ep.fullRoute),
          responses: {
            200: { description: "Successful operation" },
            400: { description: "Bad request" },
            401: { description: "Unauthorized" },
            404: { description: "Not found" },
            500: { description: "Internal server error" },
          },
        };
        if (ep.auth) op.security = [{ BearerAuth: [] }];
        if (ep.hasBody && ep.requestBody) {
          op.requestBody = {
            required: true,
            content: {
              "application/json": {
                schema: generateJsonSchema(ep.schemaFields),
                example: ep.requestBody,
              },
            },
          };
        }
        spec.paths[pathKey][ep.method.toLowerCase()] = op;
      }
    }
  }
  return spec;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log("\n" + "═".repeat(70));
  console.log("  🚀 Harmoniv Time API Documentation Generator");
  console.log("═".repeat(70) + "\n");

  const args = process.argv.slice(2);
  let manualVersion = null;
  let bumpType = "patch";
  args.forEach((a) => {
    if (a.startsWith("--version=")) manualVersion = a.split("=")[1];
    if (a.startsWith("--bump=")) bumpType = a.split("=")[1];
  });

  // Step 1: discover gateways
  console.log("📁 Step 1: Discovering route gateways...");
  const gatewayDirs = fs
    .readdirSync(CONFIG.ROUTES_LAYER_DIR)
    .map((d) => path.join(CONFIG.ROUTES_LAYER_DIR, d))
    .filter((p) => fs.statSync(p).isDirectory());
  console.log(`   Found ${gatewayDirs.length} gateways\n`);

  // Step 2: parse gateways → modules → endpoints
  console.log("📋 Step 2: Parsing endpoints...");
  const categories = {};
  let total = 0;

  for (const gatewayDir of gatewayDirs) {
    const category = titleCase(path.basename(gatewayDir));
    const mounts = parseGateway(gatewayDir);
    if (mounts.length === 0) {
      console.log(`   ⚠️  ${category}: no mounts found`);
      continue;
    }
    categories[category] = categories[category] || {};

    for (const { prefix, moduleDir } of mounts) {
      const routesFile = findRoutesFile(moduleDir);
      if (!routesFile) {
        console.log(`   ⚠️  ${category} ${prefix}: no routes file`);
        continue;
      }
      const resource = titleCase(prefix.replace(/^\//, "").replace(/-/g, " "));
      const endpoints = parseModuleRoutes(routesFile);
      endpoints.forEach((ep) => (ep.fullRoute = joinRoute(prefix, ep.route)));
      if (endpoints.length === 0) continue;

      categories[category][resource] = endpoints;
      total += endpoints.length;
      console.log(`   ✅ ${category} → ${resource}: ${endpoints.length} endpoints`);
    }
  }
  console.log(`\n   📊 Total: ${total} endpoints across ${Object.keys(categories).length} gateways\n`);

  // Step 3: version
  console.log("🔢 Step 3: Version management...");
  const versionInfo = getVersionInfo();
  const newVersion = manualVersion || incrementVersion(versionInfo.current, bumpType);
  console.log(`   ${versionInfo.current} → ${newVersion}\n`);

  // Step 4: generate
  console.log("📝 Step 4: Generating documentation...");
  const prefix = `${CONFIG.BASE_NAME}_${newVersion.replace(/\./g, "_")}`;

  const postmanFile = path.join(CONFIG.POSTMAN_DIR, `${prefix}.postman_collection.json`);
  fs.writeFileSync(postmanFile, JSON.stringify(generatePostmanCollection(categories, newVersion), null, 2));
  console.log(`   ✅ Postman Collection: ${path.basename(postmanFile)}`);

  const envFile = path.join(CONFIG.ENV_DIR, `${prefix}.postman_environment.json`);
  fs.writeFileSync(envFile, JSON.stringify(generatePostmanEnvironment(categories, newVersion), null, 2));
  console.log(`   ✅ Postman Environment: ${path.basename(envFile)}`);

  const openAPIFile = path.join(CONFIG.OPENAPI_DIR, `${prefix}.openapi.yaml`);
  fs.writeFileSync(openAPIFile, jsonToYaml(generateOpenAPISpec(categories, newVersion)));
  console.log(`   ✅ OpenAPI Spec: ${path.basename(openAPIFile)}`);

  // Step 5: persist version
  versionInfo.current = newVersion;
  versionInfo.history.push({
    version: newVersion,
    timestamp: new Date().toISOString(),
    endpoints: total,
    gateways: Object.keys(categories).length,
  });
  saveVersionInfo(versionInfo);

  console.log("\n" + "═".repeat(70));
  console.log("  ✨ Documentation generated successfully!");
  console.log("═".repeat(70));
  console.log(`
  📦 Version:   ${newVersion}
  📊 Endpoints: ${total}
  📁 Gateways:  ${Object.keys(categories).length}

  📂 Output:
     • ${path.relative(process.cwd(), postmanFile)}
     • ${path.relative(process.cwd(), envFile)}
     • ${path.relative(process.cwd(), openAPIFile)}
  `);
}

try {
  main();
} catch (error) {
  console.error("\n❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
}
