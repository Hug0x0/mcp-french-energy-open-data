#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const CONFIG = {
  "name": "mcp-french-energy-open-data",
  "prefix": "french_energy_open_data",
  "description": "MCP server for French open energy data: ODRE, éCO2mix, RTE/Enedis source discovery, and electricity mix helpers.",
  "sources": [
    {
      "title": "ODRE OpenDataSoft portal",
      "url": "https://odre.opendatasoft.com/"
    },
    {
      "title": "éCO2mix national real-time dataset",
      "url": "https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/"
    },
    {
      "title": "RTE éCO2mix downloads",
      "url": "https://www.rte-france.com/en/data-publications/eco2mix/download-indicators"
    },
    {
      "title": "RTE services portal",
      "url": "https://www.services-rte.com/"
    }
  ]
} as const;

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

function jsonResult(data: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function errorResult(message: string): ToolResult {
  const data = { error: message };
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError: true,
  };
}

function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json,*/*',
      'User-Agent': `${CONFIG.name}/0.1 (+https://github.com/Hug0x0/${CONFIG.name})`,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,text/plain,application/xml,*/*',
      'User-Agent': `${CONFIG.name}/0.1 (+https://github.com/Hug0x0/${CONFIG.name})`,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return response.text();
}

function dataGouvDatasetSummary(dataset: Record<string, unknown>) {
  return {
    id: dataset.id,
    slug: dataset.slug,
    title: dataset.title,
    page: dataset.page,
    organization: dataset.organization && typeof dataset.organization === 'object'
      ? (dataset.organization as Record<string, unknown>).name
      : undefined,
    resources_count: Array.isArray(dataset.resources) ? dataset.resources.length : undefined,
  };
}

async function searchDataGouv(query: string, pageSize: number) {
  const url = new URL('https://www.data.gouv.fr/api/1/datasets/');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(pageSize));
  const data = await fetchJson<{ data?: Array<Record<string, unknown>>; total?: number }>(url.toString());
  return {
    query,
    total: data.total,
    datasets: (data.data ?? []).map(dataGouvDatasetSummary),
  };
}

function normalizePortalUrl(portalUrl: string): string {
  return portalUrl.replace(/\/$/, '');
}

async function odsRecords(portalUrl: string, dataset: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${normalizePortalUrl(portalUrl)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(dataset)}/records`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return fetchJson<Record<string, unknown>>(url.toString());
}

const server = new McpServer({ name: CONFIG.name, version: '0.1.0' });

server.tool(
  `${CONFIG.prefix}_get_sources`,
  'List curated sources used by this MCP.',
  {},
  async () => jsonResult({ server: CONFIG.name, description: CONFIG.description, sources: CONFIG.sources })
);

server.tool(
  `${CONFIG.prefix}_fetch_source_excerpt`,
  'Fetch a short text excerpt from a curated source by index or title keyword.',
  {
    source_key: z.string().describe('Source index, title keyword, or URL fragment.'),
    max_chars: z.number().int().min(200).max(4000).default(1200),
  },
  async ({ source_key, max_chars }) => {
    const normalized = source_key.toLowerCase();
    const source = CONFIG.sources.find((item, index) =>
      String(index + 1) === normalized ||
      item.title.toLowerCase().includes(normalized) ||
      item.url.toLowerCase().includes(normalized)
    );
    if (!source) return errorResult(`Unknown source: ${source_key}`);
    try {
      const text = await fetchText(source.url);
      return jsonResult({ source, excerpt: textFromHtml(text).slice(0, max_chars) });
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : 'Failed to fetch source excerpt');
    }
  }
);


server.tool('french_energy_open_data_get_eco2mix_latest', 'Fetch recent national éCO2mix rows from ODRE OpenDataSoft.', {
  limit: z.number().int().min(1).max(96).default(8),
}, async ({ limit }) => {
  try {
    const data = await odsRecords('https://odre.opendatasoft.com', 'eco2mix-national-tr', { order_by: 'date_heure DESC', limit });
    return jsonResult({ source: 'ODRE eco2mix-national-tr', result: data });
  } catch (error) { return errorResult(error instanceof Error ? error.message : 'Failed to fetch éCO2mix'); }
});

server.tool('french_energy_open_data_get_eco2mix_summary', 'Fetch the latest national éCO2mix observation and compute production mix percentages.', {
}, async () => {
  try {
    const data = await odsRecords('https://odre.opendatasoft.com', 'eco2mix-national-tr', { order_by: 'date_heure DESC', limit: 1 });
    const row = Array.isArray(data.results) ? data.results[0] as Record<string, unknown> | undefined : undefined;
    if (!row) return errorResult('No éCO2mix row returned');
    const technologies = ['fioul', 'charbon', 'gaz', 'nucleaire', 'eolien', 'solaire', 'hydraulique', 'bioenergies'];
    const production = technologies.map((technology) => ({
      technology,
      mw: typeof row[technology] === 'number' ? row[technology] : Number(row[technology] ?? 0),
    }));
    const totalProductionMw = production.reduce((sum, item) => sum + (Number.isFinite(item.mw) ? item.mw : 0), 0);
    return jsonResult({
      source: 'ODRE eco2mix-national-tr',
      timestamp: row.date_heure,
      consumption_mw: row.consommation,
      total_production_mw: totalProductionMw,
      mix: production.map((item) => ({
        ...item,
        share_pct: totalProductionMw > 0 ? Math.round((item.mw / totalProductionMw) * 1000) / 10 : undefined,
      })),
      raw: row,
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Failed to summarize éCO2mix');
  }
});

server.tool('french_energy_open_data_search_odre_catalog', 'Search the ODRE OpenDataSoft catalog.', {
  query: z.string().default('consommation'),
  limit: z.number().int().min(1).max(100).default(10),
}, async ({ query, limit }) => {
  try {
    const url = new URL('https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets');
    url.searchParams.set('where', `search('${query.replace(/'/g, "''")}')`);
    url.searchParams.set('limit', String(limit));
    return jsonResult({ query, result: await fetchJson<Record<string, unknown>>(url.toString()) });
  } catch (error) { return errorResult(error instanceof Error ? error.message : 'Failed to search ODRE catalog'); }
});

server.tool('french_energy_open_data_search_data_gouv', 'Search data.gouv.fr for French energy datasets.', {
  query: z.string().default('énergie consommation électricité'),
  page_size: z.number().int().min(1).max(50).default(10),
}, async ({ query, page_size }) => {
  try { return jsonResult(await searchDataGouv(query, page_size)); } catch (error) { return errorResult(error instanceof Error ? error.message : 'Failed to search energy datasets'); }
});


async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error(`${CONFIG.name} running on stdio`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
