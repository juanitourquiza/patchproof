<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('source', 50)->default('cli');
            $table->string('language', 5)->default('en');
            $table->string('fail_on', 20)->default('high');
            $table->string('format', 20)->default('json');
            $table->string('status', 20)->default('completed');
            $table->json('summary')->nullable();
            $table->json('findings')->nullable();
            $table->json('metadata')->nullable();
            $table->string('report_url', 2048)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scans');
    }
};
