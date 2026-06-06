<?php

declare(strict_types=1);

use App\Models\Project;
use App\Models\ProjectApiKey;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;

require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(ConsoleKernel::class)->bootstrap();

$options = getopt('', ['name::', 'slug::', 'description::', 'key-name::']);
$name = $options['name'] ?? 'PatchProof Demo';
$slug = $options['slug'] ?? preg_replace('/[^a-z0-9]+/i', '-', strtolower($name));
$slug = trim((string) preg_replace('/-+/', '-', $slug), '-');
$description = $options['description'] ?? 'Hosted PatchProof project';
$keyName = $options['key-name'] ?? 'CLI';

$project = Project::create([
    'name' => $name,
    'slug' => $slug ?: 'patchproof-demo',
    'description' => $description,
]);

[$apiKey, $plainText] = ProjectApiKey::issueForProject($project, $keyName);

echo json_encode([
    'project' => [
        'id' => $project->id,
        'name' => $project->name,
        'slug' => $project->slug,
        'description' => $project->description,
    ],
    'key' => [
        'id' => $apiKey->id,
        'name' => $apiKey->name,
        'key_prefix' => $apiKey->key_prefix,
        'token' => $plainText,
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL;
