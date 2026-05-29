<?php

namespace App\Services\Remediation;

use App\Models\Scan;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Arr;

class AiRemediationService
{
    public function __construct(
        private readonly FindingRemediationService $deterministic
    ) {
    }

    /**
     * @return array{source: string, provider: string, model: string, remediations: array<int, array<string, mixed>>, note?: string}
     */
    public function generateForScan(Scan $scan, ?string $apiKey = null, ?string $model = null): array
    {
        $remediations = $this->deterministic->forFindings($scan->findings ?? []);
        $provider = (string) config('patchproof.remediation_ai.provider', 'openai');
        $modelName = $model ?: (string) config('patchproof.remediation_ai.model', 'gpt-4.1-mini');
        $configured = (bool) config('patchproof.remediation_ai.enabled', false);
        $resolvedKey = trim((string) ($apiKey ?: config('patchproof.remediation_ai.api_key', '')));

        if (! $configured || $resolvedKey === '') {
            return [
                'source' => 'deterministic',
                'provider' => $provider,
                'model' => $modelName,
                'note' => 'AI enrichment not enabled or no API key provided; returning deterministic guidance.',
                'remediations' => $remediations,
            ];
        }

        $response = $this->callOpenAi($scan, $remediations, $resolvedKey, $modelName);

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
    }

    /**
     * @param array<int, array<string, mixed>> $deterministicRemediations
     * @return array<int, array<string, mixed>>|null
     */
    private function callOpenAi(Scan $scan, array $deterministicRemediations, string $apiKey, string $model): ?array
    {
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
            ->post('https://api.openai.com/v1/chat/completions', $payload);

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
}
