<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\ProjectApiKey;
use App\Models\PatchproofSetting;
use App\Models\Scan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Config;
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
        Config::set('patchproof.admin_key', 'admin-secret');

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
        Config::set('patchproof.admin_key', 'admin-secret');

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
        Config::set('patchproof.admin_key', 'admin-secret');

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

    public function test_project_can_be_deleted_locally_without_admin_key(): void
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
        ]);

        $scan = Scan::create([
            'project_id' => $project->id,
            'source' => 'cli',
            'language' => 'en',
            'fail_on' => 'high',
            'format' => 'json',
            'status' => 'completed',
            'summary' => ['total' => 0],
            'findings' => [],
            'metadata' => [],
            'report_url' => null,
        ]);

        $this->deleteJson("/api/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('data.deleted', true)
            ->assertJsonPath('data.project.id', $project->id);

        $this->assertDatabaseMissing('projects', [
            'id' => $project->id,
        ]);
        $this->assertDatabaseMissing('project_api_keys', [
            'id' => $apiKey->id,
        ]);
        $this->assertDatabaseMissing('scans', [
            'id' => $scan->id,
        ]);
    }

    public function test_ai_settings_can_be_loaded_and_saved(): void
    {
        Config::set('patchproof.remediation_ai.enabled', false);
        Config::set('patchproof.remediation_ai.provider', 'openai');
        Config::set('patchproof.remediation_ai.model', 'gpt-4.1-mini');
        Config::set('patchproof.remediation_ai.base_url', 'https://api.openai.com/v1');
        Config::set('patchproof.remediation_ai.api_key', '');

        $this->getJson('/api/settings/ai')
            ->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.provider', 'openai')
            ->assertJsonPath('data.model', 'gpt-4.1-mini')
            ->assertJsonPath('data.api_key_configured', false)
            ->assertJsonPath('data.source', 'env');

        $this->putJson('/api/settings/ai', [
            'enabled' => true,
            'provider' => 'anthropic',
            'model' => 'claude-sonnet-4-20250514',
            'base_url' => null,
            'api_key' => 'ant-key',
        ])
            ->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.provider', 'anthropic')
            ->assertJsonPath('data.model', 'claude-sonnet-4-20250514')
            ->assertJsonPath('data.api_key_configured', true)
            ->assertJsonPath('data.api_key_source', 'database')
            ->assertJsonPath('data.source', 'database');

        $this->assertDatabaseHas('patchproof_settings', [
            'key' => 'remediation_ai',
        ]);

        $this->getJson('/api/settings/ai')
            ->assertOk()
            ->assertJsonPath('data.provider', 'anthropic')
            ->assertJsonPath('data.model', 'claude-sonnet-4-20250514')
            ->assertJsonPath('data.api_key_configured', true);
    }

    public function test_scan_creation_works_without_project_api_key(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $response = $this->postJson('/api/scans', [
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
                [
                    'ruleId' => 'PP002',
                    'severity' => 'high',
                    'title' => 'Potential SQL injection',
                    'description' => 'The added line builds a SQL statement with string concatenation.',
                    'evidence' => '$query->orderByRaw("CASE WHEN report.status = " . KReport::STATUS_PENDING . " THEN 0 ELSE 1 END");',
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
            ->assertJsonPath('data.findings.0.ruleId', 'PP001')
            ->assertJsonPath('data.result.score', 45)
            ->assertJsonPath('data.result.label', 'Needs review')
            ->assertJsonPath('data.remediations.1.rule_id', 'PP002')
            ->assertJsonPath('data.remediations.1.primary_fix.title', 'Use bound parameters')
            ->assertJsonPath('data.remediations.1.source', 'deterministic');

        $scanId = $response->json('data.id');

        $this->assertDatabaseHas('usage_events', [
            'project_id' => $project->id,
            'scan_id' => $scanId,
            'kind' => 'scan',
            'source' => 'cli',
            'language' => 'es',
            'fail_on' => 'high',
            'format' => 'markdown',
            'status' => 'completed',
            'findings_total' => 2,
        ]);

        $this->getJson("/api/projects/{$project->id}/scans")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/usage-events?project_id='.$project->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.project.id', $project->id)
            ->assertJsonPath('data.0.scan_id', $scanId)
            ->assertJsonPath('data.0.kind', 'scan');
    }

    public function test_scan_creation_works_even_if_other_project_has_key(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $otherProject = Project::create([
            'name' => 'Other Project',
            'slug' => 'other-project',
            'description' => 'Should not affect the local scan flow',
        ]);

        ProjectApiKey::create([
            'project_id' => $otherProject->id,
            'name' => 'Wrong Project Key',
            'key_prefix' => 'wrongkey',
            'key_hash' => hash('sha256', 'plain-project-key'),
        ]);

        $this->postJson('/api/scans', [
            'project_id' => $project->id,
        ])
            ->assertCreated();
    }

    public function test_revoked_key_does_not_block_scan_submission(): void
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

        $this->postJson('/api/scans', [
            'project_id' => $project->id,
        ])
            ->assertCreated();

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

    public function test_project_summary_includes_rollups_and_recent_scans(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'CLI',
            'key_prefix' => 'patchproof',
            'key_hash' => hash('sha256', 'project-key'),
        ]);

        $this->withHeader('X-PatchProof-Key', 'project-key')
            ->postJson('/api/scans', [
                'project_id' => $project->id,
                'status' => 'completed',
                'language' => 'en',
                'source' => 'cli',
                'summary' => [
                    'critical' => 1,
                    'high' => 2,
                    'medium' => 0,
                    'low' => 0,
                ],
            ])
            ->assertCreated();

        $this->withHeader('X-PatchProof-Key', 'project-key')
            ->postJson('/api/scans', [
                'project_id' => $project->id,
                'status' => 'failed',
                'language' => 'es',
                'source' => 'github-action',
                'summary' => [
                    'critical' => 0,
                    'high' => 0,
                    'medium' => 3,
                    'low' => 1,
                ],
            ])
            ->assertCreated();

        $this->getJson("/api/projects/{$project->id}/summary")
            ->assertOk()
            ->assertJsonPath('data.project.id', $project->id)
            ->assertJsonPath('data.totals.scans', 2)
            ->assertJsonPath('data.totals.statuses.completed', 1)
            ->assertJsonPath('data.totals.statuses.failed', 1)
            ->assertJsonPath('data.breakdowns.languages.0.language', 'en')
            ->assertJsonPath('data.breakdowns.languages.0.count', 1)
            ->assertJsonPath('data.breakdowns.sources.1.source', 'github-action')
            ->assertJsonPath('data.breakdowns.severities.0.severity', 'critical')
            ->assertJsonPath('data.breakdowns.severities.0.count', 1)
            ->assertJsonCount(2, 'data.recent_scans')
            ->assertJsonCount(2, 'data.recent_usages');
    }

    public function test_ai_remediation_endpoint_returns_ai_enrichment_when_key_is_present(): void
    {
        config()->set('patchproof.remediation_ai.enabled', true);
        config()->set('patchproof.remediation_ai.api_key', 'service-key');

        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'CLI',
            'key_prefix' => 'patchproof',
            'key_hash' => hash('sha256', 'project-key'),
        ]);

        $scan = $this->withHeader('X-PatchProof-Key', 'project-key')
            ->postJson('/api/scans', [
                'project_id' => $project->id,
                'status' => 'completed',
                'language' => 'en',
                'source' => 'cli',
                'findings' => [
                    [
                        'ruleId' => 'PP002',
                        'title' => 'Potential SQL injection',
                        'description' => 'SQL is being built with concatenation.',
                        'evidence' => '$query->orderByRaw("CASE WHEN report.status = " . KReport::STATUS_PENDING . " THEN 0 ELSE 1 END");',
                    ],
                ],
            ])
            ->assertCreated()
            ->json('data.id');

        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => json_encode([
                                'remediations' => [
                                    [
                                        'rule_id' => 'PP002',
                                        'rule_title' => 'Potential SQL injection',
                                        'finding_title' => 'Potential SQL injection',
                                        'summary' => 'Use parameterized queries.',
                                        'source' => 'ai',
                                        'primary_fix' => [
                                            'title' => 'Use bound parameters',
                                            'description' => 'Move raw values into placeholders.',
                                        ],
                                        'alternatives' => [
                                            [
                                                'title' => 'Use query builder',
                                                'description' => 'Prefer builder methods.',
                                            ],
                                        ],
                                        'ai_prompt' => 'Rule: PP002 ...',
                                        'confidence' => 'high',
                                    ],
                                ],
                            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        ],
                    ],
                ],
            ], 200),
        ]);

        $this->postJson("/api/scans/{$scan}/remediations/ai", [
            'api_key' => 'service-key',
        ])
            ->assertOk()
            ->assertJsonPath('data.scan_id', $scan)
            ->assertJsonPath('data.source', 'ai')
            ->assertJsonPath('data.provider', 'openai')
            ->assertJsonPath('data.remediations.0.rule_id', 'PP002')
            ->assertJsonPath('data.remediations.0.primary_fix.title', 'Use bound parameters');
    }

    public function test_ai_review_endpoint_returns_advisory_suggestions_when_key_is_present(): void
    {
        Config::set('patchproof.remediation_ai.enabled', true);
        Config::set('patchproof.remediation_ai.api_key', 'service-key');

        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'CLI',
            'key_prefix' => 'patchproof',
            'key_hash' => hash('sha256', 'project-key'),
        ]);

        $scan = $this->withHeader('X-PatchProof-Key', 'project-key')
            ->postJson('/api/scans', [
                'project_id' => $project->id,
                'status' => 'completed',
                'language' => 'en',
                'source' => 'cli',
                'summary' => [
                    'critical' => 0,
                    'high' => 0,
                    'medium' => 0,
                    'low' => 0,
                    'total' => 0,
                ],
                'findings' => [],
                'metadata' => [
                    'repo' => 'patchproof-cli',
                ],
            ])
            ->assertCreated()
            ->json('data.id');

        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => json_encode([
                                'summary' => 'Advisory review complete.',
                                'confidence_average' => '0.78',
                                'suggestions' => [
                                    [
                                        'title' => 'Possible auth bypass',
                                        'severity' => 'high',
                                        'confidence' => 'high',
                                        'rationale' => 'Review route guards around sensitive endpoints.',
                                        'recommendation' => 'Confirm authorization checks before state-changing operations.',
                                        'category' => 'authorization',
                                        'needs_human_review' => true,
                                    ],
                                ],
                            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        ],
                    ],
                ],
            ], 200),
        ]);

        $this->postJson("/api/scans/{$scan}/review/ai", [
            'api_key' => 'service-key',
        ])
            ->assertOk()
            ->assertJsonPath('data.scan_id', $scan)
            ->assertJsonPath('data.source', 'ai')
            ->assertJsonPath('data.provider', 'openai')
            ->assertJsonPath('data.summary', 'Advisory review complete.')
            ->assertJsonPath('data.confidence_average', '0.78')
            ->assertJsonPath('data.suggestions.0.title', 'Possible auth bypass')
            ->assertJsonPath('data.suggestions.0.needs_human_review', true);
    }

    public function test_ai_review_endpoint_synthesizes_a_clean_scan_note_when_the_model_returns_no_suggestions(): void
    {
        Config::set('patchproof.remediation_ai.enabled', true);
        Config::set('patchproof.remediation_ai.api_key', 'service-key');

        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        ProjectApiKey::create([
            'project_id' => $project->id,
            'name' => 'CLI',
            'key_prefix' => 'patchproof',
            'key_hash' => hash('sha256', 'project-key'),
        ]);

        $scan = $this->withHeader('X-PatchProof-Key', 'project-key')
            ->postJson('/api/scans', [
                'project_id' => $project->id,
                'status' => 'completed',
                'language' => 'en',
                'source' => 'cli',
                'summary' => [
                    'critical' => 0,
                    'high' => 0,
                    'medium' => 0,
                    'low' => 0,
                    'total' => 0,
                ],
                'findings' => [],
                'metadata' => [
                    'repo' => 'patchproof-cli',
                ],
            ])
            ->assertCreated()
            ->json('data.id');

        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => json_encode([
                                'summary' => 'The scan completed cleanly.',
                                'confidence_average' => '0.52',
                                'suggestions' => [],
                            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        ],
                    ],
                ],
            ], 200),
        ]);

        $this->postJson("/api/scans/{$scan}/review/ai", [
            'api_key' => 'service-key',
        ])
            ->assertOk()
            ->assertJsonPath('data.scan_id', $scan)
            ->assertJsonPath('data.source', 'ai')
            ->assertJsonPath('data.suggestions.0.title', 'Clean scan advisory')
            ->assertJsonPath('data.suggestions.0.category', 'clean-scan')
            ->assertJsonPath('data.suggestions.0.needs_human_review', true);
    }

    public function test_clean_scans_still_expose_a_result_summary(): void
    {
        $project = Project::create([
            'name' => 'PatchProof CLI',
            'slug' => 'patchproof-cli',
            'description' => 'Open source CLI',
        ]);

        $this->postJson('/api/scans', [
            'project_id' => $project->id,
            'status' => 'completed',
            'language' => 'en',
            'source' => 'cli',
            'summary' => [
                'critical' => 0,
                'high' => 0,
                'medium' => 0,
                'low' => 0,
                'total' => 0,
            ],
            'findings' => [],
            'metadata' => [
                'repo' => 'patchproof-cli',
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.result.score', 100)
            ->assertJsonPath('data.result.verdict', 'clean')
            ->assertJsonPath('data.result.label', 'Clean result')
            ->assertJsonPath('data.result.finding_total', 0);
    }
}
