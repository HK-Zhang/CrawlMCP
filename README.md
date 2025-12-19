# CrawlMCP

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![MCP Server](https://img.shields.io/badge/MCP-Server-blue)](https://modelcontextprotocol.io/)
[![npm](https://img.shields.io/npm/v/crawl-mcp)](https://www.npmjs.com/package/crawl-mcp)

A Model Context Protocol (MCP) server that fetches raw HTML content from Chrome pages via the Chrome DevTools Protocol. Designed to complement [chrome-devtools-mcp](https://github.com/anthropics/chrome-devtools-mcp) by providing HTML extraction capabilities.

## Features

- **get_page_html**: Fetch the complete raw HTML of any open Chrome page, or extract HTML of specific elements using CSS selectors
- **list_chrome_pages**: List all open pages in Chrome available for HTML extraction

## Prerequisites

- Node.js 18+
- Chrome/Chromium running with remote debugging enabled

### Start Chrome with Remote Debugging

```bash
# Windows
chrome.exe --remote-debugging-port=9222

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

## Installation

```bash
npm install
npm run build
```

## Usage

### Configure in VS Code (Copilot)

Add to your VS Code `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "crawl-mcp": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "crawl-mcp"
        ]
      }
    }
  }
}
```

### Configure in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crawl-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "crawl-mcp"
      ]
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CDP_HOST` | `localhost` | Chrome DevTools Protocol host |
| `CDP_PORT` | `9222` | Chrome DevTools Protocol port |

## Tools

### get_page_html

Fetches raw HTML content from an open Chrome page.

**Parameters:**
- `pageIndex` (number, optional): Page index (0-based). Defaults to 0.
- `selector` (string, optional): CSS selector to get HTML of a specific element.

**Examples:**

Get full page HTML:
```
Use the get_page_html tool to fetch the HTML from the first Chrome tab
```

Get specific element:
```
Use get_page_html with selector "#main-content" to get only that section
```

### list_chrome_pages

Lists all open pages accessible via Chrome DevTools Protocol.

**Returns:** Array of objects with `index`, `title`, and `url`.

## Using with chrome-devtools-mcp

This MCP is designed to work alongside chrome-devtools-mcp. Use chrome-devtools-mcp for:
- Navigation and page interaction
- Taking screenshots and snapshots
- Console and network monitoring

Use CrawlMCP for:
- Extracting raw HTML source code
- Getting HTML of specific DOM elements

## License

MIT