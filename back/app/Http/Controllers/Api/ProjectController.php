<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScanResource;
use App\Http\Resources\UsageEventResource;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class ProjectController extends Controller
{
    public function index(): JsonResponse
    {
        $projects = Project::query()
            ->withCount('scans')
            ->withMax('scans as latest_scan_at', 'created_at')
            ->latest()
            ->get();

        return response()->json([
            'data' => $projects,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'alpha_dash', Rule::unique('projects', 'slug')],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $validated['slug'] = $validated['slug'] ?? $this->generateUniqueSlug($validated['name']);
        $project = Project::create($validated);

        return response()->json([
            'data' => $project,
        ], 201);
    }

    public function show(Project $project): JsonResponse
    {
        return response()->json([
            'data' => $project->loadCount('scans'),
        ]);
    }

    public function destroy(Project $project, Request $request): JsonResponse
    {
        $projectName = $project->name;
        $project->delete();

        return response()->json([
            'data' => [
                'deleted' => true,
                'project' => [
                    'id' => $project->id,
                    'name' => $projectName,
                    'slug' => $project->slug,
                ],
            ],
        ]);
    }

    public function summary(Project $project, Request $request): JsonResponse
    {
        $scans = $project->scans()
            ->select(['id', 'project_id', 'source', 'language', 'status', 'summary', 'created_at', 'updated_at'])
            ->latest()
            ->get();

        $severityTotals = [
            'critical' => 0,
            'high' => 0,
            'medium' => 0,
            'low' => 0,
        ];

        foreach ($scans as $scan) {
            foreach ($severityTotals as $severity => $total) {
                $severityTotals[$severity] += (int) data_get($scan->summary, $severity, 0);
            }
        }

        $breakdown = static fn (string $field) => $scans
            ->groupBy($field)
            ->map(fn ($items, $value) => [
                $field => $value,
                'count' => $items->count(),
            ])
            ->values()
            ->all();

        $recentScans = $project->scans()
            ->with('project')
            ->latest()
            ->limit(5)
            ->get();

        $recentUsageEvents = $project->usageEvents()
            ->with('project')
            ->latest()
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'slug' => $project->slug,
                    'description' => $project->description,
                ],
                'totals' => [
                    'scans' => $scans->count(),
                    'statuses' => $scans->groupBy('status')->map->count()->all(),
                ],
                'breakdowns' => [
                    'languages' => $breakdown('language'),
                    'sources' => $breakdown('source'),
                    'severities' => array_map(
                        fn (string $severity, int $count) => [
                            'severity' => $severity,
                            'count' => $count,
                        ],
                        array_keys($severityTotals),
                        array_values($severityTotals)
                    ),
                ],
                'latest_scan_at' => $scans->first()?->created_at?->toIso8601String(),
                'recent_scans' => ScanResource::collection($recentScans)->toArray($request),
                'recent_usages' => UsageEventResource::collection($recentUsageEvents)->toArray($request),
            ],
        ]);
    }

    public function scans(Project $project, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:queued,completed,failed'],
            'language' => ['nullable', 'in:en,es'],
            'source' => ['nullable', 'string', 'max:50'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $scans = $project->scans()
            ->with('project')
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

    private function generateUniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'project';
        $slug = $base;
        $suffix = 1;

        while (Project::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

}
