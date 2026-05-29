<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UsageEventResource;
use App\Models\Project;
use App\Models\UsageEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UsageEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'kind' => ['nullable', 'string', 'max:50'],
            'source' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:20'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $events = UsageEvent::query()
            ->with('project')
            ->when($validated['project_id'] ?? null, fn ($query, $projectId) => $query->where('project_id', $projectId))
            ->when($validated['kind'] ?? null, fn ($query, $kind) => $query->where('kind', $kind))
            ->when($validated['source'] ?? null, fn ($query, $source) => $query->where('source', $source))
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate($validated['per_page'] ?? 20)
            ->withQueryString();

        return UsageEventResource::collection($events)->response();
    }

    public function store(Project $project, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'scan_id' => ['nullable', 'integer', 'exists:scans,id'],
            'kind' => ['required', 'string', 'max:50'],
            'source' => ['required', 'string', 'max:50'],
            'language' => ['nullable', 'string', 'max:10'],
            'fail_on' => ['nullable', 'string', 'max:20'],
            'format' => ['nullable', 'string', 'max:20'],
            'status' => ['nullable', 'string', 'max:20'],
            'findings_total' => ['nullable', 'integer', 'min:0'],
            'metadata' => ['nullable', 'array'],
        ]);

        $event = $project->usageEvents()->create([
            'scan_id' => $validated['scan_id'] ?? null,
            'kind' => $validated['kind'],
            'source' => $validated['source'],
            'language' => $validated['language'] ?? null,
            'fail_on' => $validated['fail_on'] ?? null,
            'format' => $validated['format'] ?? null,
            'status' => $validated['status'] ?? null,
            'findings_total' => $validated['findings_total'] ?? 0,
            'metadata' => $validated['metadata'] ?? [],
        ]);

        return response()->json([
            'data' => new UsageEventResource($event->load('project')),
        ], 201);
    }
}
