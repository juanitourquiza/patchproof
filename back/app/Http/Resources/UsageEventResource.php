<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\UsageEvent
 */
class UsageEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project' => $this->whenLoaded('project', function (): array {
                return [
                    'id' => $this->project->id,
                    'name' => $this->project->name,
                    'slug' => $this->project->slug,
                ];
            }),
            'scan_id' => $this->scan_id,
            'kind' => $this->kind,
            'source' => $this->source,
            'language' => $this->language,
            'fail_on' => $this->fail_on,
            'format' => $this->format,
            'status' => $this->status,
            'findings_total' => $this->findings_total,
            'metadata' => $this->metadata,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
