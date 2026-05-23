<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatchProofApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_returns_ok(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJson([
                'ok' => true,
                'service' => 'patchproof-back',
            ]);
    }

    public function test_project_can_be_created_and_listed(): void
    {
        $this->postJson('/api/projects', [
            'name' => 'PatchProof CLI',
            'description' => 'Open source CLI',
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'PatchProof CLI')
            ->assertJsonPath('data.slug', 'patchproof-cli');

        $this->getJson('/api/projects')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'PatchProof CLI')
            ->assertJsonPath('data.0.scans_count', 0);
    }

    public function test_scan_can_be_created_for_project(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $this->postJson('/api/scans', [
            'project_id' => $project->id,
            'language' => 'es',
            'fail_on' => 'high',
            'format' => 'markdown',
            'status' => 'completed',
            'summary' => [
                'total' => 2,
                'critical' => 1,
            ],
            'findings' => [
                [
                    'ruleId' => 'PP001',
                    'severity' => 'critical',
                ],
            ],
            'metadata' => [
                'tool' => 'patchproof',
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.project.id', $project->id)
            ->assertJsonPath('data.language', 'es')
            ->assertJsonPath('data.summary.total', 2)
            ->assertJsonPath('data.findings.0.ruleId', 'PP001');

        $this->getJson("/api/projects/{$project->id}/scans")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
