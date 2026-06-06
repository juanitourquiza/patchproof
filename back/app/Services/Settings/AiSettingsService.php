<?php

namespace App\Services\Settings;

use App\Models\PatchproofSetting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class AiSettingsService
{
    public const SETTINGS_KEY = 'remediation_ai';

    /**
     * @return array<string, mixed>
     */
    public function publicSettings(): array
    {
        $resolved = $this->resolveSettings();

        unset($resolved['api_key']);

        $resolved['api_key_configured'] = $resolved['api_key_source'] !== 'none';
        $resolved['configured'] = $resolved['enabled'] && $resolved['api_key_configured'];
        $resolved['available_providers'] = $this->availableProviders();

        return $resolved;
    }

    /**
     * @return array<string, mixed>
     */
    public function resolveSettings(): array
    {
        $defaults = $this->envDefaults();
        $stored = $this->storedSettings();

        if ($stored === null) {
            return [
                ...$defaults,
                'source' => 'env',
                'api_key_source' => filled($defaults['api_key']) ? 'env' : 'none',
            ];
        }

        $resolved = [
            'enabled' => array_key_exists('enabled', $stored) ? (bool) $stored['enabled'] : $defaults['enabled'],
            'provider' => $this->normalizeProvider(
                (string) ($stored['provider'] ?? $defaults['provider'])
            ),
            'model' => trim((string) ($stored['model'] ?? $defaults['model'])) ?: $defaults['model'],
            'base_url' => trim((string) ($stored['base_url'] ?? $defaults['base_url'])),
            'api_key' => trim((string) ($stored['api_key'] ?? '')) ?: $defaults['api_key'],
            'source' => 'database',
        ];

        if ($resolved['base_url'] === '') {
            $resolved['base_url'] = $defaults['base_url'];
        }

        $resolved['api_key_source'] = filled((string) ($stored['api_key'] ?? ''))
            ? 'database'
            : (filled($defaults['api_key']) ? 'env' : 'none');

        return $resolved;
    }

    /**
     * @return array<string, mixed>
     */
    public function updateSettings(array $input): array
    {
        $stored = $this->storedSettings();
        $defaults = $this->envDefaults();

        $next = [
            'enabled' => array_key_exists('enabled', $input)
                ? (bool) $input['enabled']
                : (bool) ($stored['enabled'] ?? $defaults['enabled']),
            'provider' => $this->normalizeProvider(
                (string) ($input['provider'] ?? $stored['provider'] ?? $defaults['provider'])
            ),
            'model' => trim((string) ($input['model'] ?? $stored['model'] ?? $defaults['model']))
                ?: $defaults['model'],
            'base_url' => trim((string) ($input['base_url'] ?? $stored['base_url'] ?? $defaults['base_url'])),
            'api_key' => array_key_exists('api_key', $input)
                ? trim((string) $input['api_key'])
                : (string) ($stored['api_key'] ?? ''),
        ];

        if (($input['clear_api_key'] ?? false) === true) {
            $next['api_key'] = '';
        }

        if ($next['base_url'] === '') {
            $next['base_url'] = $defaults['base_url'];
        }

        PatchproofSetting::updateOrCreate(
            ['key' => self::SETTINGS_KEY],
            ['value' => $this->encryptValue($next)]
        );

        return $this->publicSettings();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function availableProviders(): array
    {
        return [
            [
                'value' => 'openai',
                'label' => 'OpenAI',
                'description' => 'OpenAI chat completions with structured JSON output.',
                'needs_base_url' => false,
            ],
            [
                'value' => 'anthropic',
                'label' => 'Anthropic',
                'description' => 'Claude via the Anthropic Messages API.',
                'needs_base_url' => false,
            ],
            [
                'value' => 'openai-compatible',
                'label' => 'OpenAI-compatible / local',
                'description' => 'Ollama, local gateways, or any OpenAI-compatible endpoint.',
                'needs_base_url' => true,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function runtimeSettings(): array
    {
        return $this->resolveSettings();
    }

    /**
     * @return array<string, mixed>
     */
    private function envDefaults(): array
    {
        return [
            'enabled' => (bool) Config::get('patchproof.remediation_ai.enabled', false),
            'provider' => $this->normalizeProvider((string) Config::get('patchproof.remediation_ai.provider', 'openai')),
            'model' => (string) Config::get('patchproof.remediation_ai.model', 'gpt-4.1-mini'),
            'base_url' => trim((string) Config::get('patchproof.remediation_ai.base_url', 'https://api.openai.com/v1')),
            'api_key' => trim((string) Config::get('patchproof.remediation_ai.api_key', '')),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function storedSettings(): ?array
    {
        $record = PatchproofSetting::query()
            ->where('key', self::SETTINGS_KEY)
            ->first();

        if ($record === null) {
            return null;
        }

        try {
            $payload = json_decode(Crypt::decryptString((string) $record->value), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($payload)) {
            return null;
        }

        return [
            'enabled' => (bool) ($payload['enabled'] ?? false),
            'provider' => (string) ($payload['provider'] ?? 'openai'),
            'model' => (string) ($payload['model'] ?? 'gpt-4.1-mini'),
            'base_url' => (string) ($payload['base_url'] ?? ''),
            'api_key' => (string) ($payload['api_key'] ?? ''),
        ];
    }

    /**
     * @param array<string, mixed> $value
     */
    private function encryptValue(array $value): string
    {
        return Crypt::encryptString(json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function normalizeProvider(string $provider): string
    {
        $provider = Str::lower(trim($provider));

        return match ($provider) {
            'anthropic' => 'anthropic',
            'openai-compatible', 'openai_compatible', 'openai compatible', 'compatible' => 'openai-compatible',
            default => 'openai',
        };
    }
}
