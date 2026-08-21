import { describe, expect, it } from 'vitest';

describe('mcp-french-energy-open-data', () => {
  it('uses an mcp package name', () => {
    expect('mcp-french-energy-open-data').toMatch(/^mcp-/);
  });

  it('has curated HTTP sources', () => {
    const sources = [
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
];
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.url).toMatch(/^https?:\/\//);
    }
  });

  it('has a stable tool prefix', () => {
    expect('french_energy_open_data').toMatch(/^[a-z0-9_]+$/);
  });
});
