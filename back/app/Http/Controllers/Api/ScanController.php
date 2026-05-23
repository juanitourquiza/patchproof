<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectApiKey;
use App\Models\Scan;
use App\Http\Resources\ScanResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'status' => ['nullable', 'in:queued,completed,failed'],
            'language' => ['nullable', 'in:en,es'],
            'source' => ['nullable', 'string', 'max:50'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $scans = Scan::query()
            ->with('project')
            ->when($validated['project_id'] ?? null, fn ($query, $projectId) => $query->where('project_id', $projectId))
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['language'] ?? null, fn ($query, $language) => $query->where('language', $language))
            ->when($validated['source'] ?? null, fn ($query, $source) => $query->where('source', $source))
            ->when($validated['from'] ?? null, fn ($query, $from) => $query->whereDate('created_at', '>=', $from))
            ->when($validated['to'] ?? null, fn ($query, $to) => $query->whereDate('created_at', '<=', $to))
            ->latest()
            ->paginate($validated['per_page'] ?? 15)
            ->withQueryString();

        return ScanResource::collection($scans)->response();
    }

    public function show(Scan $scan): JsonResponse
    {
        return response()->json([
            'data' => new ScanResource($scan->load('project')),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'source' => ['nullable', 'string', 'max:50'],
            'language' => ['nullable', 'in:en,es'],
            'fail_on' => ['nullable', 'in:critical,high,medium,low'],
            'format' => ['nullable', 'in:text,json,markdown,sarif'],
            'status' => ['nullable', 'in:queued,completed,failed'],
            'summary' => ['nullable', 'array'],
            'findings' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
            'report_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $project = Project::findOrFail($validated['project_id']);
        $this->authorizeProjectKey($request, $project);

        $scan = $project->scans()->create([
            'source' => $validated['source'] ?? 'cli',
            'language' => $validated['language'] ?? 'en',
            'fail_on' => $validated['fail_on'] ?? 'high',
            'format' => $validated['format'] ?? 'json',
            'status' => $validated['status'] ?? 'completed',
            'summary' => $validated['summary'] ?? null,
            'findings' => $validated['findings'] ?? [],
            'metadata' => $validated['metadata'] ?? [],
            'report_url' => $validated['report_url'] ?? null,
        ]);

        return response()->json([
            'data' => new ScanResource($scan->load('project')),
        ], 201);
    }

    private function authorizeProjectKey(Request $request, Project $project): void
    {
        $plainText = $this->extractToken($request);

        if ($plainText === null) {
            abort(401, 'Unauthorized');
        }

        $keyHash = hash('sha256', $plainText);

        $apiKey = ProjectApiKey::query()
            ->where('project_id', $project->id)
            ->where('key_hash', $keyHash)
            ->whereNull('revoked_at')
            ->first();

        if ($apiKey === null) {
            abort(401, 'Unauthorized');
        }

        $apiKey->forceFill(['last_used_at' => now()])->save();
    }

    private function extractToken(Request $request): ?string
    {
        $header = (string) $request->bearerToken();

        if ($header !== '') {
            return $header;
        }

        $header = trim((string) $request->header('X-PatchProof-Key', ''));

        return $header !== '' ? $header : null;
    }
}
