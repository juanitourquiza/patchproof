<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usage_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('scan_id')->nullable()->constrained('scans')->nullOnDelete();
            $table->string('kind', 50)->index();
            $table->string('source', 50)->index();
            $table->string('language', 10)->nullable()->index();
            $table->string('fail_on', 20)->nullable()->index();
            $table->string('format', 20)->nullable()->index();
            $table->string('status', 20)->nullable()->index();
            $table->unsignedInteger('findings_total')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_events');
    }
};
