import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommentHints, type CommentHintResolver } from '../src/hintBuilder';

test('builds inlay hints from resolved candidate documentation', async () => {
  const resolver: CommentHintResolver = {
    resolve: async (candidate) =>
      candidate.word.startsWith('OrderStatus')
        ? {
            summary: '已支付订单',
            fullText: '已支付订单\n用于订单列表展示',
            location: { uri: 'file:///status.ts', line: 1, character: 13 }
          }
        : undefined
  };

  const hints = await buildCommentHints({
    lines: ['const status = OrderStatusPaid;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
        enabled: true,
        languages: ['typescript'],
        maxHintsPerRequest: 20,
        minIdentifierLength: 2,
        preferPropertyTail: true,
        dedupeLineHints: true,
        resolveTimeoutMs: 750
      },
      resolver
    });

  assert.deepEqual(hints, [
    {
      line: 0,
      character: 31,
      label: '// 已支付订单',
      tooltip: '已支付订单\n用于订单列表展示',
      location: { uri: 'file:///status.ts', line: 1, character: 13 }
    }
  ]);
});

test('places hints at absolute line ends for dense visible-range lines', async () => {
  const line = 'const status = OrderStatusPaid;';
  const resolver: CommentHintResolver = {
    resolve: async (candidate) =>
      candidate.word === 'OrderStatusPaid'
        ? {
            summary: '已支付订单',
            fullText: '已支付订单'
          }
        : undefined
  };

  const hints = await buildCommentHints({
    lines: [line],
    range: { startLine: 42, endLineInclusive: 42 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints, [
    {
      line: 42,
      character: line.length,
      label: '// 已支付订单',
      tooltip: '已支付订单'
    }
  ]);
});

test('filters resolved documentation below the configured word budget', async () => {
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => ({
      summary: candidate.word === 'OrderStatusPaid' ? 'Status' : 'Useful order documentation',
      fullText: candidate.word === 'OrderStatusPaid' ? 'Status' : 'Useful order documentation'
    })
  };

  const hints = await buildCommentHints({
    lines: ['const paid = OrderStatusPaid; const refund = RefundStatus;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      minimumDocumentationWords: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints.map((hint) => hint.label), ['// Useful order documentation']);
});

test('returns no hints when disabled or language is not enabled', async () => {
  const resolver: CommentHintResolver = {
    resolve: async () => {
      throw new Error('resolver should not be called');
    }
  };

  assert.deepEqual(
    await buildCommentHints({
      lines: ['const status = OrderStatusPaid;'],
      range: { startLine: 0, endLineInclusive: 0 },
      languageId: 'typescript',
      documentUri: 'file:///order.ts',
      documentVersion: 1,
      config: {
        enabled: false,
        languages: ['typescript'],
        maxHintsPerRequest: 20,
        minIdentifierLength: 2,
        preferPropertyTail: true,
        dedupeLineHints: true,
        resolveTimeoutMs: 750
      },
      resolver
    }),
    []
  );

  assert.deepEqual(
    await buildCommentHints({
      lines: ['const status = OrderStatusPaid;'],
      range: { startLine: 0, endLineInclusive: 0 },
      languageId: 'go',
      documentUri: 'file:///order.go',
      documentVersion: 1,
      config: {
        enabled: true,
        languages: ['typescript'],
        maxHintsPerRequest: 20,
        minIdentifierLength: 2,
        preferPropertyTail: true,
        dedupeLineHints: true,
        resolveTimeoutMs: 750
      },
      resolver
    }),
    []
  );
});

test('returns no hints when a per-language override disables the language', async () => {
  const resolver: CommentHintResolver = {
    resolve: async () => {
      throw new Error('resolver should not be called');
    }
  };

  assert.deepEqual(
    await buildCommentHints({
      lines: ['const status = OrderStatusPaid;'],
      range: { startLine: 0, endLineInclusive: 0 },
      languageId: 'typescript',
      documentUri: 'file:///order.ts',
      documentVersion: 1,
      config: {
        enabled: true,
        languages: ['typescript'],
        languageOverrides: {
          typescript: { enabled: false }
        },
        maxHintsPerRequest: 20,
        minIdentifierLength: 2,
        preferPropertyTail: true,
        dedupeLineHints: true,
        resolveTimeoutMs: 750
      },
      resolver
    }),
    []
  );
});

test('does not resolve candidates on lines beyond the configured length budget', async () => {
  const resolver: CommentHintResolver = {
    resolve: async () => {
      throw new Error('resolver should not be called');
    }
  };

  const hints = await buildCommentHints({
    lines: [`${'x'.repeat(60)} usefulSymbol`],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxLineLength: 40,
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints, []);
});

test('does not show a symbol own documentation on its definition line', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: '格式化状态',
        fullText: '格式化状态'
      };
    }
  };

  const hints = await buildCommentHints({
    lines: [
      '/** 格式化状态 */',
      'formatStatus = (status) => status;'
    ],
    range: { startLine: 0, endLineInclusive: 1 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints, []);
  assert.deepEqual(resolvedWords, []);
});

test('does not show own documentation on supported language definition lines', async () => {
  const cases = [
    {
      name: 'go function',
      languageId: 'go',
      lines: ['// FormatStatus formats status.', 'func FormatStatus(status OrderStatus) string {']
    },
    {
      name: 'go interface method',
      languageId: 'go',
      lines: ['// FormatStatus formats status.', 'FormatStatus(status OrderStatus) string']
    },
    {
      name: 'typescript class field arrow method',
      languageId: 'typescript',
      lines: ['/** Formats status. */', 'formatStatus = (status) => status;']
    },
    {
      name: 'javascript object method',
      languageId: 'javascript',
      lines: ['/** Formats status. */', 'formatStatus(status) {']
    },
    {
      name: 'python function',
      languageId: 'python',
      lines: ['# Formats status.', 'def format_status(status):']
    },
    {
      name: 'java method',
      languageId: 'java',
      lines: ['/** Formats status. */', 'public String formatStatus(String status) {']
    },
    {
      name: 'rust function',
      languageId: 'rust',
      lines: ['/// Formats status.', 'pub fn format_status(status: &str) -> String {']
    },
    {
      name: 'csharp method',
      languageId: 'csharp',
      lines: ['/// <summary>Formats status.</summary>', 'public string FormatStatus(string status) {']
    },
    {
      name: 'php method',
      languageId: 'php',
      lines: ['/** Formats status. */', 'public function formatStatus(string $status): string {']
    },
    {
      name: 'ruby method',
      languageId: 'ruby',
      lines: ['# Formats status.', 'def format_status(status)']
    },
    {
      name: 'kotlin function',
      languageId: 'kotlin',
      lines: ['/** Formats status. */', 'fun formatStatus(status: String): String = status']
    },
    {
      name: 'swift function',
      languageId: 'swift',
      lines: ['/// Formats status.', 'func formatStatus(_ status: String) -> String {']
    },
    {
      name: 'c function',
      languageId: 'c',
      lines: ['/// Formats status.', 'void format_status(char *status) {']
    },
    {
      name: 'cpp function',
      languageId: 'cpp',
      lines: ['/// Formats status.', 'std::string formatStatus(std::string status) {']
    }
  ];

  const leakedHintCases: string[] = [];
  const resolvedDefinitionCases: string[] = [];
  for (const { name, languageId, lines } of cases) {
    const resolvedWords: string[] = [];
    const resolver: CommentHintResolver = {
      resolve: async (candidate) => {
        resolvedWords.push(candidate.word);
        return {
          summary: `${name} documentation`,
          fullText: `${name} documentation`
        };
      }
    };

    const hints = await buildCommentHints({
      lines,
      range: { startLine: 0, endLineInclusive: 1 },
      languageId,
      documentUri: `file:///definition.${languageId}`,
      documentVersion: 1,
      config: {
        enabled: true,
        languages: [languageId],
        maxHintsPerRequest: 20,
        minIdentifierLength: 2,
        preferPropertyTail: true,
        dedupeLineHints: true,
        resolveTimeoutMs: 750
      },
      resolver
    });

    if (hints.length > 0) {
      leakedHintCases.push(name);
    }
    if (resolvedWords.length > 0) {
      resolvedDefinitionCases.push(name);
    }
  }

  assert.deepEqual(leakedHintCases, []);
  assert.deepEqual(resolvedDefinitionCases, []);
});

test('prefers the tail of property chains when configured', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`,
        location: { uri: 'file:///order.ts', line: 1, character: 1 }
      };
    }
  };

  const hints = await buildCommentHints({
    lines: ['const label = order.status.displayName;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(resolvedWords, ['displayName']);
  assert.deepEqual(hints.map((hint) => hint.label), ['// doc for displayName']);
});

test('applies max hint budget after filtering noisy candidates', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`,
        location: { uri: 'file:///order.ts', line: 1, character: 1 }
      };
    }
  };

  const hints = await buildCommentHints({
    lines: [
      'const ignoredDeclaration = order.customer.profile.displayName;',
      'const visible = usefulSymbol;'
    ],
    range: { startLine: 0, endLineInclusive: 1 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 2,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(resolvedWords, ['displayName', 'usefulSymbol']);
  assert.deepEqual(hints.map((hint) => hint.label), ['// doc for displayName', '// doc for usefulSymbol']);
});

test('deduplicates repeated candidate positions within a request', async () => {
  let resolveCalls = 0;
  const resolver: CommentHintResolver = {
    resolve: async () => {
      resolveCalls++;
      return {
        summary: 'shared documentation',
        fullText: 'shared documentation'
      };
    }
  };

  const hints = await buildCommentHints({
    lines: ['const value = repeated + repeated;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.equal(resolveCalls, 2);
  assert.deepEqual(hints.map((hint) => hint.label), ['// shared documentation']);
});

test('filters short identifiers unless resolved documentation has a location', async () => {
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => ({
      summary: `doc for ${candidate.word}`,
      fullText: `doc for ${candidate.word}`,
      location: candidate.word === 'b' ? { uri: 'file:///order.ts', line: 1, character: 1 } : undefined
    })
  };

  const hints = await buildCommentHints({
    lines: ['const a = b + total;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints.map((hint) => hint.label), ['// b: doc for b | total: doc for total']);
});

test('dedupes repeated line summaries and prefers a location-bearing hint', async () => {
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => ({
      summary: '已支付订单',
      fullText: '已支付订单',
      location: candidate.word === 'paidAgain' ? { uri: 'file:///status.ts', line: 1, character: 1 } : undefined
    })
  };

  const hints = await buildCommentHints({
    lines: ['const label = paid + paidAgain;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints, [
    {
      line: 0,
      character: 31,
      label: '// 已支付订单',
      tooltip: '已支付订单',
      location: { uri: 'file:///status.ts', line: 1, character: 1 }
    }
  ]);
});

test('keeps repeated summaries when line dedupe is disabled', async () => {
  const resolver: CommentHintResolver = {
    resolve: async () => ({
      summary: '已支付订单',
      fullText: '已支付订单'
    })
  };

  const hints = await buildCommentHints({
    lines: ['const label = paid + paidAgain;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: false,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints.map((hint) => hint.label), ['// paid: 已支付订单 | paidAgain: 已支付订单']);
});

test('skips common declaration names and jsx tag names', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`
      };
    }
  };

  const hints = await buildCommentHints({
    lines: [
      'const ReadyStatus = "ready";',
      'function StatusBadge(props: { status: string }) { return <span>{props.status}</span>; }',
      'export const view = <StatusBadge status={ReadyStatus} />;'
    ],
    range: { startLine: 0, endLineInclusive: 2 },
    languageId: 'typescriptreact',
    documentUri: 'file:///view.tsx',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescriptreact'],
      maxHintsPerRequest: 30,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.equal(resolvedWords.includes('StatusBadge'), false);
  assert.equal(resolvedWords.includes('props'), false);
  assert.equal(resolvedWords.includes('string'), false);
  assert.equal(resolvedWords.includes('ReadyStatus'), true);
  assert.equal(hints.some((hint) => hint.label === '// doc for StatusBadge'), false);
  assert.equal(hints.some((hint) => hint.label === '// doc for ReadyStatus'), true);
});

test('skips jsx attribute names', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`
      };
    }
  };

  await buildCommentHints({
    lines: ['export const view = <StatusBadge status={ReadyStatus} />;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescriptreact',
    documentUri: 'file:///view.tsx',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescriptreact'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.equal(resolvedWords.includes('status'), false);
  assert.equal(resolvedWords.includes('ReadyStatus'), true);
});

test('skips go declaration names', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`
      };
    }
  };

  await buildCommentHints({
    lines: [
      'func FormatOrderStatus(status OrderStatus) string {',
      'func (OrderPresenter) DisplayLabel(status OrderStatus) string {',
      '\tOrderStatusPaid OrderStatus = "paid"',
      '\tstatus := OrderStatusPaid'
    ],
    range: { startLine: 0, endLineInclusive: 3 },
    languageId: 'go',
    documentUri: 'file:///order.go',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['go'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.equal(resolvedWords.includes('FormatOrderStatus'), false);
  assert.equal(resolvedWords.includes('DisplayLabel'), false);
  assert.equal(resolvedWords.includes('status'), false);
  assert.equal(resolvedWords.includes('OrderStatus'), false);
  assert.equal(resolvedWords.includes('OrderStatusPaid'), true);
});

test('keeps go case label references', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`
      };
    }
  };

  const hints = await buildCommentHints({
    lines: ['case OrderStatusPaid:'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'go',
    documentUri: 'file:///order.go',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['go'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(resolvedWords, ['OrderStatusPaid']);
  assert.deepEqual(hints.map((hint) => hint.label), ['// doc for OrderStatusPaid']);
});

test('allows slower go resolver responses than the configured base timeout', async () => {
  const resolver: CommentHintResolver = {
    resolve: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        summary: 'go documentation',
        fullText: 'go documentation'
      };
    }
  };

  const hints = await buildCommentHints({
    lines: ['status := OrderStatusPaid'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'go',
    documentUri: 'file:///order.go',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['go'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 1
    },
    resolver
  });

  assert.deepEqual(hints.map((hint) => hint.label), ['// go documentation']);
});

test('limits concurrent resolver calls', async () => {
  let active = 0;
  let maxActive = 0;
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`
      };
    }
  };

  await buildCommentHints({
    lines: ['const result = one + two + three + four + five + six;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: false,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.equal(maxActive, 4);
});

test('drops resolver results that exceed the configured timeout', async () => {
  const resolver: CommentHintResolver = {
    resolve: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        summary: 'late documentation',
        fullText: 'late documentation'
      };
    }
  };

  const hints = await buildCommentHints({
    lines: ['const label = status;'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 1
    },
    resolver
  });

  assert.deepEqual(hints, []);
});

test('uses custom hint prefix and places hints at line end', async () => {
  const resolver: CommentHintResolver = {
    resolve: async (candidate) =>
      candidate.word === 'status'
        ? {
            summary: '业务状态',
            fullText: '业务状态'
          }
        : undefined
  };

  const hints = await buildCommentHints({
    lines: ['console.log(status);'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750,
      hintPrefix: ' // doc: '
    },
    resolver
  });

  assert.deepEqual(hints, [
    {
      line: 0,
      character: 20,
      label: ' // doc: 业务状态',
      tooltip: '业务状态'
    }
  ]);
});

test('groups multiple same-line hints with candidate names', async () => {
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      if (candidate.word === 'formatStatus') {
        return {
          summary: '格式化状态',
          fullText: '格式化状态\n用于订单列表展示',
          location: { uri: 'file:///order.ts', line: 1, character: 16 }
        };
      }

      if (candidate.word === 'OrderStatusPaid') {
        return {
          summary: '已支付订单状态',
          fullText: '已支付订单状态',
          location: { uri: 'file:///status.ts', line: 2, character: 13 }
        };
      }

      return undefined;
    }
  };

  const hints = await buildCommentHints({
    lines: ['render(formatStatus(status), OrderStatusPaid);'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints, [
    {
      line: 0,
      character: 46,
      label: '// formatStatus: 格式化状态 | OrderStatusPaid: 已支付订单状态',
      tooltip: 'formatStatus:\n格式化状态\n用于订单列表展示\n\nOrderStatusPaid:\n已支付订单状态'
    }
  ]);
});

test('prioritizes method and enum candidates before applying max hint budget', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`,
        location: { uri: 'file:///order.ts', line: 1, character: 1 }
      };
    }
  };

  const hints = await buildCommentHints({
    lines: ['const label = localReference + presenter.format(OrderStatus.Paid);'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 2,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(resolvedWords, ['format', 'Paid']);
  assert.deepEqual(hints.map((hint) => hint.label), ['// format: doc for format | Paid: doc for Paid']);
});

test('limits crowded same-line hints without hiding method plus enum pairs', async () => {
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => ({
      summary: `doc for ${candidate.word}`,
      fullText: `doc for ${candidate.word}`,
      location: { uri: 'file:///order.ts', line: 1, character: 1 }
    })
  };

  const hints = await buildCommentHints({
    lines: ['const label = presenter.format(OrderStatus.Paid, customer.displayName);'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      maxHintsPerLine: 2,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints.map((hint) => hint.label), ['// format: doc for format | Paid: doc for Paid']);
});
