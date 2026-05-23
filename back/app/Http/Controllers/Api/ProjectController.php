<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScanResource;
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
