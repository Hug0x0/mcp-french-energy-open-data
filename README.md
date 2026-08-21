# mcp-french-energy-open-data

MCP server for French open energy data: ODRE, éCO2mix, RTE/Enedis source discovery, and electricity mix helpers.

## Tools

Run the MCP and call `french_energy_open_data_get_sources` first to inspect source coverage. This server also exposes domain-specific tools for the topic described above.

## Install

```bash
npm install
npm run build
npm test
npm run dev
```

## Claude Desktop

```json
{
  "mcpServers": {
    "french-energy-open-data": {
      "command": "npx",
      "args": ["mcp-french-energy-open-data"]
    }
  }
}
```

## Sources

- ODRE OpenDataSoft portal: https://odre.opendatasoft.com/
- éCO2mix national real-time dataset: https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/
- RTE éCO2mix downloads: https://www.rte-france.com/en/data-publications/eco2mix/download-indicators
- RTE services portal: https://www.services-rte.com/

## Publishing

See [docs/publishing.md](docs/publishing.md).

## Glama / Docker

The repo includes `Dockerfile` and `glama.json`.

Build steps:

```json
["npm install", "npm run build"]
```

CMD arguments:

```json
["node", "dist/index.js"]
```

## Safety

This MCP helps agents discover and summarize public sources. It is not an official authority. Verify decisions against the competent public service or original data producer.

## License

MIT
