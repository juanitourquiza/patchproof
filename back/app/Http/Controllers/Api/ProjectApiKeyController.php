<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectApiKey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

class ProjectApiKeyController extends Controller
{
    public function index(Project $project, Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $keys = $project->apiKeys()
            ->latest()
            ->get()
            ->map(fn (ProjectApiKey $apiKey) => [
                'id' => $apiKey->id,
                'name' => $apiKey->name,
                'key_prefix' => $apiKey->key_prefix,
                'last_used_at' => optional($apiKey->last_used_at)->toIso8601String(),
                'revoked_at' => optional($apiKey->revoked_at)->toIso8601String(),
                'created_at' => $apiKey->created_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'data' => $keys,
        ]);
    }

    public function store(Project $project, Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
        ]);

        [$apiKey, $plainText] = ProjectApiKey::issueForProject($project, $validated['name'] ?? null);

        return response()->json([
            'data' => [
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'slug' => $project->slug,
                ],
                'id' => $apiKey->id,
                'name' => $apiKey->name,
                'key_prefix' => $apiKey->key_prefix,
                'token' => $plainText,
            ],
        ], 201);
    }

    public function destroy(Project $project, ProjectApiKey $apiKey, Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        abort_unless($apiKey->project_id === $project->id, 404);

        $apiKey->forceFill(['revoked_at' => now()])->save();

        return response()->json([], 204);
    }

    private function authorizeAdmin(Request $request): void
    {
        $expected = (string) Config::get('patchproof.admin_key', '');
        $provided = (string) $request->header('X-PatchProof-Admin-Key', '');

        abort_unless($expected !== '' && hash_equals($expected, $provided), 401, 'Unauthorized');
    }
}
