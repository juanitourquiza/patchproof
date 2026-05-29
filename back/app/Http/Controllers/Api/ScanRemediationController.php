<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Scan;
use App\Services\Remediation\AiRemediationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScanRemediationController extends Controller
{
    public function __construct(
        private readonly AiRemediationService $aiRemediationService
    ) {
    }

    public function ai(Scan $scan, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => ['nullable', 'string', 'max:4000'],
            'model' => ['nullable', 'string', 'max:120'],
        ]);

        $result = $this->aiRemediationService->generateForScan(
            $scan->loadMissing('project'),
            $validated['api_key'] ?? $request->header('X-PatchProof-AI-Key'),
            $validated['model'] ?? null,
        );

        return response()->json([
            'data' => [
                'scan_id' => $scan->id,
                ...$result,
            ],
        ]);
    }
}
