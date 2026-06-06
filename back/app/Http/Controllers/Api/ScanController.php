<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Scan;
use App\Http\Resources\ScanResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class ScanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'project_name' => ['nullable', 'string', 'max:120'],
            'project_slug' => ['nullable', 'string', 'max:120', 'alpha_dash'],
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
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'project_name' => ['nullable', 'string', 'max:120'],
            'project_slug' => ['nullable', 'string', 'max:120', 'alpha_dash', Rule::unique('projects', 'slug')],
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

        $project = $this->resolveProject($validated);

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

        $project->usageEvents()->create([
            'scan_id' => $scan->id,
            'kind' => 'scan',
            'source' => $scan->source,
            'language' => $scan->language,
            'fail_on' => $scan->fail_on,
            'format' => $scan->format,
            'status' => $scan->status,
            'findings_total' => (int) data_get($validated, 'summary.total', count($validated['findings'] ?? [])),
            'metadata' => array_merge($validated['metadata'] ?? [], [
                'report_url' => $scan->report_url,
            ]),
        ]);

        return response()->json([
            'data' => new ScanResource($scan->load('project')),
        ], 201);
    }

    private function resolveProject(array $validated): Project
    {
        if (!empty($validated['project_id'])) {
            return Project::findOrFail($validated['project_id']);
        }

        $name = trim((string) ($validated['project_name'] ?? ''));
        $slug = trim((string) ($validated['project_slug'] ?? ''));

        if ($slug !== '') {
            $project = Project::where('slug', $slug)->first();

            if ($project !== null) {
                if ($name !== '' && $project->name !== $name) {
                    $project->forceFill(['name' => $name])->save();
                }

                return $project;
            }

            return Project::create([
                'name' => $name !== '' ? $name : Str::headline(str_replace('-', ' ', $slug)),
                'slug' => $slug,
                'description' => null,
            ]);
        }

        if ($name !== '') {
            $generatedSlug = $this->generateUniqueSlug($name);

            return Project::create([
                'name' => $name,
                'slug' => $generatedSlug,
                'description' => null,
            ]);
        }

        abort(422, 'project_id or project_name/project_slug is required');
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
