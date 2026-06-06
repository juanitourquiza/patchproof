<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'key',
    'value',
])]
class PatchproofSetting extends Model
{
    use HasFactory;

    protected $table = 'patchproof_settings';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'key',
        'value',
    ];
}
