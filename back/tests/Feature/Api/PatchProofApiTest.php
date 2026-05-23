<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\ProjectApiKey;
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

    public function test_project_api_key_can_be_created_by_admin(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $this->withHeader('X-PatchProof-Admin-Key', 'admin-secret')
            ->postJson("/api/projects/{$project->id}/api-keys", [
                'name' => 'GitHub Action',
            ])
            ->assertCreated()
            ->assertJsonPath('data.project.id', $project->id)
            ->assertJsonPath('data.name', 'GitHub Action')
            ->assertJsonPath('data.token', fn (string $token) => strlen($token) >= 40);

        $this->assertDatabaseHas('project_api_keys', [
            'project_id' => $project->id,
            'name' => 'GitHub Action',
        ]);
    }

    public function test_scan_requires_a_valid_project_api_key(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $this->postJson('/api/scans', [
            'project_id' => $project->id,
            'language' => 'es',
        ])
            ->assertUnauthorized();

        $apiKey = ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'CLI',
            'key_prefix' => 'patchproof',
            'key_hash' => hash('sha256', 'plain-project-key'),
        ]);

        $this->withHeader('X-PatchProof-Key', 'plain-project-key')
            ->postJson('/api/scans', [
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

        $this->assertDatabaseHas('project_api_keys', [
            'id' => $apiKey->id,
            'last_used_at' => now()->toDateTimeString(),
        ]);

        $this->getJson("/api/projects/{$project->id}/scans")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_scan_creation_rejects_key_for_other_project(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $otherProject = Project::create([
            'name' => 'Other Project',
            'slug' => 'other-project',
            'description' => 'Should not accept the token',
        ]);

        ProjectApiKey::create([
            'project_id' => $otherProject->id,
            'name' => 'Wrong Project Key',
            'key_prefix' => 'wrongkey',
            'key_hash' => hash('sha256', 'plain-project-key'),
        ]);

        $this->withHeader('X-PatchProof-Key', 'plain-project-key')
            ->postJson('/api/scans', [
                'project_id' => $project->id,
            ])
            ->assertUnauthorized();
    }
}
