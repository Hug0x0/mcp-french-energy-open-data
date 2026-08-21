#!/usr/bin/env node

const sources = [
  [
    "ODRE OpenDataSoft portal",
    "https://odre.opendatasoft.com/"
  ],
  [
    "éCO2mix national real-time dataset",
    "https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/"
  ],
  [
    "RTE éCO2mix downloads",
    "https://www.rte-france.com/en/data-publications/eco2mix/download-indicators"
  ],
  [
    "RTE services portal",
    "https://www.services-rte.com/"
  ]
];
let failures = 0;

for (const [title, url] of sources) {
  try {
    const response = await fetch(url, { headers: { Accept: 'text/html,application/json,*/*', 'User-Agent': 'mcp-french-energy-open-data-smoke/0.1' } });
    const body = await response.text();
    const ok = response.ok && body.length > 50;
    console.log(`${ok ? 'OK' : 'FAIL'} ${response.status} ${title} ${url}`);
    if (!ok) failures += 1;
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${title} ${url} ${error.message}`);
  }
}

process.exitCode = failures === 0 ? 0 : 1;
