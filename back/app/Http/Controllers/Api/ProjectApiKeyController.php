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

    private function authorizeAdmin(Request $request): void
    {
        $expected = (string) Config::get('patchproof.admin_key', '');
        $provided = (string) $request->header('X-PatchProof-Admin-Key', '');

        abort_unless($expected !== '' && hash_equals($expected, $provided), 401, 'Unauthorized');
    }
}
