<?php

namespace App\Services\Remediation;

use App\Models\Scan;
use Illuminate\Support\Arr;
use App\Services\Settings\AiSettingsService;
use Illuminate\Support\Facades\Http;
use Throwable;

class AiReviewService
{
    public function __construct(
        private readonly FindingRemediationService $deterministic,
        private readonly AiSettingsService $aiSettingsService
    ) {
    }

    /**
     * @return array{
     *   source: string,
     *   provider: string,
     *   model: string,
     *   summary: string,
     *   confidence_average: string,
     *   suggestions: array<int, array<string, mixed>>,
     *   note?: string
     * }
     */
    public function generateForScan(Scan $scan, ?string $apiKey = null, ?string $model = null): array
    {
        try {
            $settings = $this->aiSettingsService->runtimeSettings();
            $provider = (string) ($settings['provider'] ?? 'openai');
            $modelName = $model ?: (string) ($settings['model'] ?? 'gpt-4.1-mini');
            $resolvedKey = trim((string) ($apiKey ?: ($settings['api_key'] ?? '')));
            $configured = (bool) ($settings['enabled'] ?? false);
            $baseUrl = trim((string) ($settings['base_url'] ?? 'https://api.openai.com/v1'));
            $deterministicSuggestions = $this->deterministic->forFindings($scan->findings ?? []);

            if (! $configured || $resolvedKey === '') {
                return [
                    'source' => 'deterministic',
                    'provider' => $provider,
                    'model' => $modelName,
                    'summary' => 'No AI key provided. Returning deterministic advisory fallback.',
                    'confidence_average' => $this->averageConfidence([]),
                    'note' => 'AI review mode is available, but this scan currently has no AI provider configured.',
                    'suggestions' => $this->fromDeterministicSuggestions($deterministicSuggestions),
                ];
            }

            $response = match ($provider) {
                'anthropic' => $this->callAnthropic($scan, $deterministicSuggestions, $resolvedKey, $modelName),
                'openai-compatible' => $this->callOpenAiCompatible($scan, $deterministicSuggestions, $resolvedKey, $modelName, $baseUrl),
                default => $this->callOpenAiCompatible($scan, $deterministicSuggestions, $resolvedKey, $modelName, $baseUrl),
            };

            if ($response === null) {
                return [
                    'source' => 'deterministic',
                    'provider' => $provider,
                    'model' => $modelName,
                    'summary' => 'AI review request failed. Returning advisory fallback.',
                    'confidence_average' => $this->averageConfidence([]),
                    'note' => 'AI review request failed; returning a conservative fallback.',
                    'suggestions' => $this->fallbackSuggestions($deterministicSuggestions),
                ];
            }

            return [
                'source' => 'ai',
                'provider' => $provider,
                'model' => $modelName,
                ...$response,
            ];
        } catch (Throwable $e) {
            report($e);

            $settings = $this->aiSettingsService->runtimeSettings();
            $provider = (string) ($settings['provider'] ?? 'openai');
            $modelName = $model ?: (string) ($settings['model'] ?? 'gpt-4.1-mini');
            $deterministicSuggestions = $this->deterministic->forFindings($scan->findings ?? []);

            return [
                'source' => 'deterministic',
                'provider' => $provider,
                'model' => $modelName,
                'summary' => 'AI review request failed. Returning advisory fallback.',
                'confidence_average' => $this->averageConfidence([]),
                'note' => 'AI review request failed; returning a conservative fallback.',
                'suggestions' => $this->fallbackSuggestions($deterministicSuggestions),
            ];
        }
    }

    /**
     * @param array<int, array<string, mixed>> $deterministicSuggestions
     * @return array<int, array<string, mixed>>|null
     */
    private function callOpenAiCompatible(
        Scan $scan,
        array $deterministicSuggestions,
        string $apiKey,
        string $model,
        string $baseUrl
    ): ?array
    {
        if ($baseUrl === '') {
            return null;
        }

        $schema = [
            'name' => 'patchproof_ai_review_suggestions',
            'strict' => true,
            'schema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'properties' => [
                    'summary' => ['type' => 'string'],
                    'confidence_average' => ['type' => 'string'],
                    'suggestions' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'additionalProperties' => false,
                            'properties' => [
                                'title' => ['type' => 'string'],
                                'severity' => ['type' => 'string'],
                                'confidence' => ['type' => 'string'],
                                'rationale' => ['type' => 'string'],
                                'recommendation' => ['type' => 'string'],
                                'category' => ['type' => 'string'],
                                'needs_human_review' => ['type' => 'boolean'],
                            ],
                            'required' => [
                                'title',
                                'severity',
                                'confidence',
                                'rationale',
                                'recommendation',
                                'category',
                                'needs_human_review',
                            ],
                        ],
                    ],
                ],
                'required' => ['summary', 'confidence_average', 'suggestions'],
            ],
        ];

        $payload = [
            'model' => $model,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are PatchProof AI Review Mode. Provide advisory security review notes for a scan. Do not block CI. Return only JSON matching the schema.',
                ],
                [
                    'role' => 'user',
                    'content' => json_encode([
                        'project' => $scan->project?->only(['id', 'name', 'slug']),
                        'scan' => [
                            'id' => $scan->id,
                            'source' => $scan->source,
                            'language' => $scan->language,
                            'fail_on' => $scan->fail_on,
                            'format' => $scan->format,
                            'status' => $scan->status,
                            'summary' => $scan->summary,
                            'findings_total' => count($scan->findings ?? []),
                        ],
                        'deterministic_suggestions' => $deterministicSuggestions,
                        'instructions' => [
                            'Focus on advisory review notes, not final findings.',
                            'If evidence is insufficient, return an empty suggestions array and a concise summary.',
                            'Keep recommendations practical and human-review oriented.',
                        ],
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ],
            ],
            'response_format' => [
                'type' => 'json_schema',
                'json_schema' => $schema,
            ],
            'temperature' => 0.2,
        ];

        $response = Http::acceptJson()
            ->withToken($apiKey)
            ->timeout(60)
            ->post(rtrim($baseUrl, '/').'/chat/completions', $payload);

        if (! $response->successful()) {
            return null;
        }

        $json = $response->json();
        $content = data_get($json, 'choices.0.message.content');

        if (! is_string($content) || trim($content) === '') {
            return null;
        }

        $parsed = json_decode($content, true);

        if (! is_array($parsed)) {
            return null;
        }

        $suggestions = collect($parsed['suggestions'] ?? [])
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item): array {
                $item['needs_human_review'] = (bool) Arr::get($item, 'needs_human_review', true);

                return $item;
            })
            ->values()
            ->all();

        if ($suggestions === []) {
            $suggestions = $this->fallbackSuggestions($deterministicSuggestions);
        }

        return [
            'summary' => (string) Arr::get($parsed, 'summary', 'AI review completed.'),
            'confidence_average' => (string) Arr::get($parsed, 'confidence_average', $this->averageConfidence($suggestions)),
            'suggestions' => $suggestions,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $deterministicSuggestions
     * @return array<string, mixed>|null
     */
    private function callAnthropic(Scan $scan, array $deterministicSuggestions, string $apiKey, string $model): ?array
    {
        $payload = [
            'model' => $model,
            'max_tokens' => 1200,
            'system' => 'You are PatchProof AI Review Mode. Provide advisory security review notes for a scan. Return only valid JSON with summary, confidence_average, and suggestions.',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => json_encode([
                        'project' => $scan->project?->only(['id', 'name', 'slug']),
                        'scan' => [
                            'id' => $scan->id,
                            'source' => $scan->source,
                            'language' => $scan->language,
                            'fail_on' => $scan->fail_on,
                            'format' => $scan->format,
                            'status' => $scan->status,
                            'summary' => $scan->summary,
                            'findings_total' => count($scan->findings ?? []),
                        ],
                        'deterministic_suggestions' => $deterministicSuggestions,
                        'instructions' => [
                            'Focus on advisory review notes, not final findings.',
                            'If evidence is insufficient, return an empty suggestions array and a concise summary.',
                            'Keep recommendations practical and human-review oriented.',
                        ],
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ],
            ],
        ];

        $response = Http::acceptJson()
            ->withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
            ])
            ->timeout(60)
            ->post('https://api.anthropic.com/v1/messages', $payload);

        if (! $response->successful()) {
            return null;
        }

        $json = $response->json();
        $content = collect(data_get($json, 'content', []))
            ->pluck('text')
            ->filter(fn ($text) => is_string($text) && trim($text) !== '')
            ->implode("\n");

        if (trim($content) === '') {
            return null;
        }

        $parsed = json_decode($content, true);

        if (! is_array($parsed)) {
            return null;
        }

        $suggestions = collect($parsed['suggestions'] ?? [])
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item): array {
                $item['needs_human_review'] = (bool) Arr::get($item, 'needs_human_review', true);

                return $item;
            })
            ->values()
            ->all();

        return [
            'summary' => (string) Arr::get($parsed, 'summary', 'AI review completed.'),
            'confidence_average' => (string) Arr::get($parsed, 'confidence_average', $this->averageConfidence($suggestions)),
            'suggestions' => $suggestions,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $deterministicSuggestions
     * @return array<int, array<string, mixed>>
     */
    private function fromDeterministicSuggestions(array $deterministicSuggestions): array
    {
        return collect($deterministicSuggestions)
            ->map(function (array $item): array {
                return [
                    'title' => (string) ($item['finding_title'] ?? $item['rule_title'] ?? 'Review item'),
                    'severity' => (string) ($item['severity'] ?? 'medium'),
                    'confidence' => (string) ($item['confidence'] ?? 'medium'),
                    'rationale' => (string) ($item['summary'] ?? 'Deterministic review suggestion.'),
                    'recommendation' => (string) data_get($item, 'primary_fix.description', 'Review the deterministic remediation guidance.'),
                    'category' => 'deterministic',
                    'needs_human_review' => true,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param array<int, array<string, mixed>> $deterministicSuggestions
     * @return array<int, array<string, mixed>>
     */
    private function fallbackSuggestions(array $deterministicSuggestions): array
    {
        if ($deterministicSuggestions !== []) {
            return $this->fromDeterministicSuggestions($deterministicSuggestions);
        }

        return [
            [
                'title' => 'Clean scan advisory',
                'severity' => 'low',
                'confidence' => 'medium',
                'rationale' => 'This scan returned no deterministic findings, so PatchProof is surfacing a lightweight human review note instead of an empty state.',
                'recommendation' => 'Do a quick manual pass on recent auth, input validation, and state-changing routes before merging.',
                'category' => 'clean-scan',
                'needs_human_review' => true,
            ],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $suggestions
     */
    private function averageConfidence(array $suggestions): string
    {
        $map = [
            'low' => 0.33,
            'medium' => 0.66,
            'high' => 0.9,
        ];

        $scores = collect($suggestions)
            ->map(fn (array $item) => $map[strtolower((string) ($item['confidence'] ?? 'medium'))] ?? 0.5)
            ->all();

        if ($scores === []) {
            return '0.00';
        }

        return number_format(array_sum($scores) / count($scores), 2, '.', '');
    }
}
