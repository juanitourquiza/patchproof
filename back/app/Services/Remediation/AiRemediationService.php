<?php

namespace App\Services\Remediation;

use App\Models\Scan;
use App\Services\Settings\AiSettingsService;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Throwable;

class AiRemediationService
{
    public function __construct(
        private readonly FindingRemediationService $deterministic,
        private readonly AiSettingsService $aiSettingsService
    ) {
    }

    /**
     * @return array{source: string, provider: string, model: string, remediations: array<int, array<string, mixed>>, note?: string}
     */
    public function generateForScan(Scan $scan, ?string $apiKey = null, ?string $model = null): array
    {
        try {
            $remediations = $this->deterministic->forFindings($scan->findings ?? []);
            $settings = $this->aiSettingsService->runtimeSettings();
            $provider = (string) ($settings['provider'] ?? 'openai');
            $modelName = $model ?: (string) ($settings['model'] ?? 'gpt-4.1-mini');
            $configured = (bool) ($settings['enabled'] ?? false);
            $resolvedKey = trim((string) ($apiKey ?: ($settings['api_key'] ?? '')));
            $baseUrl = trim((string) ($settings['base_url'] ?? 'https://api.openai.com/v1'));

            if (! $configured || $resolvedKey === '') {
                return [
                    'source' => 'deterministic',
                    'provider' => $provider,
                    'model' => $modelName,
                    'note' => 'AI enrichment is not configured, so PatchProof is returning deterministic guidance.',
                    'remediations' => $remediations,
                ];
            }

            $response = match ($provider) {
                'anthropic' => $this->callAnthropic($scan, $remediations, $resolvedKey, $modelName),
                'openai-compatible' => $this->callOpenAiCompatible($scan, $remediations, $resolvedKey, $modelName, $baseUrl),
                default => $this->callOpenAiCompatible($scan, $remediations, $resolvedKey, $modelName, $baseUrl),
            };

            if ($response === null) {
                return [
                    'source' => 'deterministic',
                    'provider' => $provider,
                    'model' => $modelName,
                    'note' => 'AI request failed; returning deterministic guidance.',
                    'remediations' => $remediations,
                ];
            }

            return [
                'source' => 'ai',
                'provider' => $provider,
                'model' => $modelName,
                'remediations' => $response,
            ];
        } catch (Throwable $e) {
            report($e);

            $settings = $this->aiSettingsService->runtimeSettings();
            $provider = (string) ($settings['provider'] ?? 'openai');
            $modelName = $model ?: (string) ($settings['model'] ?? 'gpt-4.1-mini');
            $remediations = $this->deterministic->forFindings($scan->findings ?? []);

            return [
                'source' => 'deterministic',
                'provider' => $provider,
                'model' => $modelName,
                'note' => 'AI request failed; returning deterministic guidance.',
                'remediations' => $remediations,
            ];
        }
    }

    /**
     * @param array<int, array<string, mixed>> $deterministicRemediations
     * @return array<int, array<string, mixed>>|null
     */
    private function callOpenAiCompatible(
        Scan $scan,
        array $deterministicRemediations,
        string $apiKey,
        string $model,
        string $baseUrl
    ): ?array
    {
        if ($baseUrl === '') {
            return null;
        }

        $schema = [
            'name' => 'patchproof_remediation_suggestions',
            'strict' => true,
            'schema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'properties' => [
                    'remediations' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'additionalProperties' => false,
                            'properties' => [
                                'rule_id' => ['type' => 'string'],
                                'rule_title' => ['type' => 'string'],
                                'finding_title' => ['type' => 'string'],
                                'summary' => ['type' => 'string'],
                                'source' => ['type' => 'string'],
                                'primary_fix' => [
                                    'type' => 'object',
                                    'additionalProperties' => false,
                                    'properties' => [
                                        'title' => ['type' => 'string'],
                                        'description' => ['type' => 'string'],
                                    ],
                                    'required' => ['title', 'description'],
                                ],
                                'alternatives' => [
                                    'type' => 'array',
                                    'items' => [
                                        'type' => 'object',
                                        'additionalProperties' => false,
                                        'properties' => [
                                            'title' => ['type' => 'string'],
                                            'description' => ['type' => 'string'],
                                        ],
                                        'required' => ['title', 'description'],
                                    ],
                                ],
                                'ai_prompt' => ['type' => 'string'],
                                'confidence' => ['type' => 'string'],
                            ],
                            'required' => [
                                'rule_id',
                                'rule_title',
                                'finding_title',
                                'summary',
                                'source',
                                'primary_fix',
                                'alternatives',
                                'ai_prompt',
                                'confidence',
                            ],
                        ],
                    ],
                ],
                'required' => ['remediations'],
            ],
        ];

        $payload = [
            'model' => $model,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are PatchProof, a security assistant. Improve deterministic remediation guidance for code scan findings. Return only JSON that matches the schema.',
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
                        ],
                        'deterministic_remediations' => $deterministicRemediations,
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

        if (! is_array($parsed) || ! isset($parsed['remediations']) || ! is_array($parsed['remediations'])) {
            return null;
        }

        return collect($parsed['remediations'])
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item): array {
                $item['source'] = 'ai';
                $item['confidence'] = Arr::get($item, 'confidence', 'medium');

                return $item;
            })
            ->values()
            ->all();
    }

    /**
     * @param array<int, array<string, mixed>> $deterministicRemediations
     * @return array<int, array<string, mixed>>|null
     */
    private function callAnthropic(Scan $scan, array $deterministicRemediations, string $apiKey, string $model): ?array
    {
        $schema = [
            'summary' => 'string',
            'remediations' => 'array',
        ];

        $payload = [
            'model' => $model,
            'max_tokens' => 1200,
            'system' => 'You are PatchProof, a security assistant. Improve deterministic remediation guidance for code scan findings. Return only valid JSON with keys summary and remediations.',
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
                        ],
                        'deterministic_remediations' => $deterministicRemediations,
                        'output_schema_hint' => $schema,
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

        if (! is_array($parsed) || ! isset($parsed['remediations']) || ! is_array($parsed['remediations'])) {
            return null;
        }

        return collect($parsed['remediations'])
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item): array {
                $item['source'] = 'ai';
                $item['confidence'] = Arr::get($item, 'confidence', 'medium');

                return $item;
            })
            ->values()
            ->all();
    }
}
