#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import CDP from "chrome-remote-interface";
import sanitizeHtml from "sanitize-html";

interface CDPClient {
  Runtime: {
    evaluate: (params: { expression: string; returnByValue?: boolean }) => Promise<{
      result: { value?: string; type: string };
      exceptionDetails?: unknown;
    }>;
  };
  close: () => Promise<void>;
}

interface CDPTarget {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl?: string;
}

interface GetHtmlParams {
  pageIndex?: number;
  selector?: string;
}

const CDP_HOST = process.env.CDP_HOST || "localhost";
const CDP_PORT = Number.parseInt(process.env.CDP_PORT || "9222", 10);

function removeUnwantedElements(html: string): string {
  // Use a well-tested HTML sanitizer instead of ad-hoc regex replacements.
  // Configure allowed tags and attributes to approximate the previous behavior:
  // - Disallow head/script/style/svg/iframe/meta/input/i and data-URI images.
  // - Allow only selected attributes on specific tags.
  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "p",
      "div",
      "span",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "b",
      "u",
      "small",
      "sub",
      "sup",
      "br",
      "hr",
      "code",
      "pre",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
      "button"
    ],
    allowedAttributes: {
      "*": ["id"],
      a: ["href"],
      img: ["src", "alt"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    // Disallow data: URLs entirely to avoid data:image/... payloads.
    allowedSchemesByTag: {
      img: ["http", "https"]
    }
  });
}

async function getTargets(): Promise<CDPTarget[]> {
  try {
    const targets = await CDP.List({ host: CDP_HOST, port: CDP_PORT }) as CDPTarget[];
    return targets.filter((t) => t.type === "page");
  } catch {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to connect to Chrome DevTools at ${CDP_HOST}:${CDP_PORT}. Ensure Chrome is running with --remote-debugging-port=${CDP_PORT}`
    );
  }
}

async function getHtmlContent(pageIndex = 0, selector?: string): Promise<string> {
  const targets = await getTargets();

  if (targets.length === 0) {
    throw new McpError(ErrorCode.InvalidRequest, "No open pages found in Chrome");
  }

  if (pageIndex < 0 || pageIndex >= targets.length) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Invalid page index. Available pages: 0-${targets.length - 1}`
    );
  }

  const target = targets[pageIndex];
  let client: CDPClient | null = null;

  try {
    client = await CDP({ target: target.id, host: CDP_HOST, port: CDP_PORT }) as CDPClient;

    const expression = selector
      ? `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          return el ? el.outerHTML : null;
        })()`
      : `document.documentElement.outerHTML`;

    const result = await client.Runtime.evaluate({
      expression,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      throw new McpError(ErrorCode.InternalError, "Failed to evaluate expression in page context");
    }

    let html = result.result.value;
    if (html === null || html === undefined) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        selector ? `Element not found for selector: ${selector}` : "Failed to get HTML content"
      );
    }

    html = removeUnwantedElements(html);
    return html;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function listPages(): Promise<{ index: number; title: string; url: string }[]> {
  const targets = await getTargets();
  return targets.map((t, index) => ({
    index,
    title: t.title,
    url: t.url,
  }));
}

const server = new McpServer({
  name: "crawl-mcp",
  version: "1.0.0",
});

server.registerTool(
  "get_page_html",
  {
    description:
      "Fetches the raw HTML content from an open Chrome page. Use this to get the full HTML source or a specific element's HTML. Chrome must be running with remote debugging enabled (--remote-debugging-port=9222).",
    inputSchema: z.object({
      pageIndex: z.number().optional().describe("The index of the page to fetch HTML from (0-based). Use list_chrome_pages to see available pages. Defaults to 0 (first page)."),
      selector: z.string().optional().describe("Optional CSS selector to get HTML of a specific element instead of the entire page. Example: '#main-content' or '.article-body'"),
    }),
  },
  async (params: GetHtmlParams) => {
    const html = await getHtmlContent(params.pageIndex, params.selector);
    return {
      content: [
        {
          type: "text" as const,
          text: html,
        },
      ],
    };
  }
);

server.registerTool(
  "list_chrome_pages",
  {
    description:
      "Lists all open pages in Chrome that can be accessed via Chrome DevTools Protocol. Returns page index, title, and URL for each page.",
    inputSchema: z.object({}),
  },
  async () => {
    const pages = await listPages();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(pages, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CrawlMCP server started");
}

try {
  await main();
} catch (error) {
  console.error("Server error:", error);
  process.exit(1);
}
