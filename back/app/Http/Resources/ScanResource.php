<?php

namespace App\Http\Resources;

use App\Services\Remediation\FindingRemediationService;
use App\Services\Reporting\ScanResultService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Scan
 */
class ScanResource extends JsonResource
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
            'source' => $this->source,
            'language' => $this->language,
            'fail_on' => $this->fail_on,
            'format' => $this->format,
            'status' => $this->status,
            'summary' => $this->summary,
            'findings' => $this->findings,
            'result' => app(ScanResultService::class)->forScan($this->resource),
            'remediations' => app(FindingRemediationService::class)->forFindings($this->findings ?? []),
            'metadata' => $this->metadata,
            'report_url' => $this->report_url,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
