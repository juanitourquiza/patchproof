<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Settings\AiSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AiSettingsController extends Controller
{
    public function __construct(
        private readonly AiSettingsService $aiSettingsService
    ) {
    }

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => $this->aiSettingsService->publicSettings(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'provider' => ['sometimes', 'string', 'max:50', 'in:openai,anthropic,openai-compatible'],
            'model' => ['sometimes', 'string', 'max:120'],
            'base_url' => ['sometimes', 'nullable', 'string', 'max:255'],
            'api_key' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'clear_api_key' => ['sometimes', 'boolean'],
        ]);

        if (($validated['provider'] ?? null) === 'openai-compatible' && empty(trim((string) ($validated['base_url'] ?? '')))) {
            throw ValidationException::withMessages([
                'base_url' => 'The base URL is required for OpenAI-compatible providers.',
            ]);
        }

        return response()->json([
            'data' => $this->aiSettingsService->updateSettings($validated),
        ]);
    }
}
