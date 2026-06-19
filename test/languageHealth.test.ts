import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateLanguageHealth,
  formatLanguageHealthStatus,
  LanguageHealthService,
  type LanguageHealthProbe
} from '../src/languageHealth';
import { goLanguageAdapter, pythonLanguageAdapter } from '../src/languages/languageRegistry';

test('reports ready when recommended extensions and language probes are available', async () => {
  const health = await evaluateLanguageHealth({
    languageId: 'python',
    adapter: pythonLanguageAdapter,
    documentUri: 'file:///order.py',
    position: { line: 1, character: 4 },
    probe: probe({
      installedExtensions: ['ms-python.python', 'ms-python.vscode-pylance'],
      hoverAvailable: true,
      definitionAvailable: true
    })
  });

  assert.equal(health.state, 'ready');
  assert.equal(health.languageId, 'python');
  assert.equal(health.adapterDisplayName, 'Python');
  assert.deepEqual(health.recommendedExtensions, ['ms-python.python', 'ms-python.vscode-pylance']);
  assert.deepEqual(health.checkedCapabilities, {
    hover: true,
    definition: true,
    sourceFallback: true
  });
});

test('reports missing dependency before probing language features', async () => {
  let hoverProbeCalled = false;
  const health = await evaluateLanguageHealth({
    languageId: 'python',
    adapter: pythonLanguageAdapter,
    documentUri: 'file:///order.py',
    position: { line: 1, character: 4 },
    probe: {
      isExtensionInstalled: async () => false,
      hasHover: async () => {
        hoverProbeCalled = true;
        return true;
      },
      hasDefinition: async () => true
    }
  });

  assert.equal(health.state, 'missingDependency');
  assert.equal(health.reason, 'Missing recommended extensions: ms-python.python, ms-python.vscode-pylance.');
  assert.equal(hoverProbeCalled, false);
});

test('reports degraded when hover or definition probes are unavailable', async () => {
  const health = await evaluateLanguageHealth({
    languageId: 'go',
    adapter: goLanguageAdapter,
    documentUri: 'file:///order.go',
    position: { line: 1, character: 4 },
    probe: probe({
      installedExtensions: ['golang.Go'],
      hoverAvailable: false,
      definitionAvailable: true
    })
  });

  assert.equal(health.state, 'degraded');
  assert.equal(health.reason, 'Hover provider returned no usable documentation.');
  assert.deepEqual(health.checkedCapabilities, {
    hover: false,
    definition: true,
    sourceFallback: true
  });
});

test('reports unknown when probes time out', async () => {
  const health = await evaluateLanguageHealth({
    languageId: 'go',
    adapter: goLanguageAdapter,
    documentUri: 'file:///order.go',
    position: { line: 1, character: 4 },
    timeoutMs: 1,
    probe: {
      isExtensionInstalled: async () => true,
      hasHover: async () => new Promise((resolve) => setTimeout(() => resolve(true), 20)),
      hasDefinition: async () => true
    }
  });

  assert.equal(health.state, 'unknown');
  assert.equal(health.reason, 'Language health check timed out.');
});

test('caches health checks for the same language position', async () => {
  let hoverProbeCount = 0;
  const service = new LanguageHealthService({
    isExtensionInstalled: async () => true,
    hasHover: async () => {
      hoverProbeCount += 1;
      return true;
    },
    hasDefinition: async () => true
  });

  const first = await service.evaluate({
    languageId: 'go',
    adapter: goLanguageAdapter,
    documentUri: 'file:///order.go',
    position: { line: 1, character: 4 }
  });
  const second = await service.evaluate({
    languageId: 'go',
    adapter: goLanguageAdapter,
    documentUri: 'file:///order.go',
    position: { line: 1, character: 4 }
  });

  assert.equal(first, second);
  assert.equal(hoverProbeCount, 1);
});

test('formats missing dependency status with install guidance', () => {
  const message = formatLanguageHealthStatus({
    languageId: 'python',
    adapterDisplayName: 'Python',
    supportLevel: 'experimental',
    documentationSource: 'language-service-with-source-fallback',
    state: 'missingDependency',
    reason: 'Missing recommended extensions: ms-python.python, ms-python.vscode-pylance.',
    recommendedExtensions: ['ms-python.python', 'ms-python.vscode-pylance'],
    checkedCapabilities: {
      hover: false,
      definition: false,
      sourceFallback: true
    }
  });

  assert.match(message, /missingDependency/);
  assert.match(message, /ms-python.python/);
  assert.match(message, /ms-python.vscode-pylance/);
  assert.match(message, /Install or enable/i);
  assert.match(message, /Documentation source: language service with source fallback\./);
});

test('formats degraded and unknown status with recovery guidance', () => {
  const degraded = formatLanguageHealthStatus({
    languageId: 'go',
    adapterDisplayName: 'Go',
    supportLevel: 'stable',
    documentationSource: 'language-service-with-source-fallback',
    state: 'degraded',
    reason: 'Hover provider returned no usable documentation.',
    recommendedExtensions: ['golang.Go'],
    checkedCapabilities: {
      hover: false,
      definition: true,
      sourceFallback: true
    }
  });
  const unknown = formatLanguageHealthStatus({
    languageId: 'go',
    adapterDisplayName: 'Go',
    supportLevel: 'stable',
    documentationSource: 'language-service-with-source-fallback',
    state: 'unknown',
    reason: 'Language health check timed out.',
    recommendedExtensions: ['golang.Go'],
    checkedCapabilities: {
      hover: false,
      definition: false,
      sourceFallback: true
    }
  });

  assert.match(degraded, /documented symbol/i);
  assert.match(degraded, /indexing/i);
  assert.match(unknown, /Try again/i);
  assert.match(unknown, /indexing/i);
});

function probe(options: {
  installedExtensions: readonly string[];
  hoverAvailable: boolean;
  definitionAvailable: boolean;
}): LanguageHealthProbe {
  return {
    isExtensionInstalled: async (extensionId) => options.installedExtensions.includes(extensionId),
    hasHover: async () => options.hoverAvailable,
    hasDefinition: async () => options.definitionAvailable
  };
}
