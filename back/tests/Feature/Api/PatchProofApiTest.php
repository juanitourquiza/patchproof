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

    public function test_project_api_keys_can_be_listed_by_admin(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'GitHub Action',
            'key_prefix' => 'patchproof-a1',
            'key_hash' => hash('sha256', 'first-key'),
        ]);

        ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'Local CLI',
            'key_prefix' => 'patchproof-b2',
            'key_hash' => hash('sha256', 'second-key'),
        ]);

        $this->withHeader('X-PatchProof-Admin-Key', 'admin-secret')
            ->getJson("/api/projects/{$project->id}/api-keys")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'GitHub Action')
            ->assertJsonPath('data.1.name', 'Local CLI');
    }

    public function test_project_api_key_can_be_revoked_by_admin(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $apiKey = ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'GitHub Action',
            'key_prefix' => 'patchproof-a1',
            'key_hash' => hash('sha256', 'first-key'),
        ]);

        $this->withHeader('X-PatchProof-Admin-Key', 'admin-secret')
            ->deleteJson("/api/projects/{$project->id}/api-keys/{$apiKey->id}")
            ->assertNoContent();

        $this->assertDatabaseHas('project_api_keys', [
            'id' => $apiKey->id,
        ]);
        $this->assertNotNull(ProjectApiKey::find($apiKey->id)?->revoked_at);
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

    public function test_revoked_key_cannot_be_used_to_submit_scans(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $apiKey = ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'CLI',
            'key_prefix' => 'patchproof',
            'key_hash' => hash('sha256', 'plain-project-key'),
            'revoked_at' => now(),
        ]);

        $this->withHeader('X-PatchProof-Key', 'plain-project-key')
            ->postJson('/api/scans', [
                'project_id' => $project->id,
            ])
            ->assertUnauthorized();

        $this->assertNotNull(ProjectApiKey::find($apiKey->id)?->revoked_at);
    }

    public function test_scan_history_can_be_filtered_globally_and_by_project(): void
    {
        $projectA = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $projectB = Project::create([
            'name' => 'PatchProof UI',
            'slug' => 'patchproof-ui',
            'description' => 'Angular dashboard',
        ]);

        ProjectApiKey::create([
            'project_id' => $projectA->id,
            'name' => 'CLI',
            'key_prefix' => 'patchproof-a1',
            'key_hash' => hash('sha256', 'project-a-key'),
        ]);

        ProjectApiKey::create([
            'project_id' => $projectB->id,
            'name' => 'UI',
            'key_prefix' => 'patchproof-b2',
            'key_hash' => hash('sha256', 'project-b-key'),
        ]);

        $this->withHeader('X-PatchProof-Key', 'project-a-key')
            ->postJson('/api/scans', [
                'project_id' => $projectA->id,
                'status' => 'completed',
                'language' => 'es',
                'source' => 'cli',
            ])
            ->assertCreated();

        $this->withHeader('X-PatchProof-Key', 'project-b-key')
            ->postJson('/api/scans', [
                'project_id' => $projectB->id,
                'status' => 'failed',
                'language' => 'en',
                'source' => 'github-action',
            ])
            ->assertCreated();

        $this->withHeader('X-PatchProof-Key', 'project-a-key')
            ->postJson('/api/scans', [
                'project_id' => $projectA->id,
                'status' => 'failed',
                'language' => 'en',
                'source' => 'cli',
            ])
            ->assertCreated();

        $this->getJson('/api/scans?status=completed&project_id='.$projectA->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.project.id', $projectA->id)
            ->assertJsonPath('data.0.status', 'completed');

        $this->getJson("/api/projects/{$projectA->id}/scans?language=es")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.language', 'es')
            ->assertJsonPath('data.0.project.id', $projectA->id);
    }
}
