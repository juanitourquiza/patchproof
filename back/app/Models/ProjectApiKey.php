<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['project_id', 'name', 'key_prefix', 'key_hash', 'last_used_at'])]
class ProjectApiKey extends Model
{
    use HasFactory;

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'last_used_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return array{0: self, 1: string}
     */
    public static function issueForProject(Project $project, ?string $name = null): array
    {
        $plainText = Str::random(48);

        $apiKey = $project->apiKeys()->create([
            'name' => $name,
            'key_prefix' => substr($plainText, 0, 12),
            'key_hash' => hash('sha256', $plainText),
        ]);

        return [$apiKey, $plainText];
    }
}
