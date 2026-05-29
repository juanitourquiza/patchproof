<?php

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectApiKeyController;
use App\Http\Controllers\Api\UsageEventController;
use App\Http\Controllers\Api\ScanController;
use App\Http\Controllers\Api\ScanRemediationController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::get('/projects', [ProjectController::class, 'index']);
Route::post('/projects', [ProjectController::class, 'store']);
Route::get('/projects/{project}', [ProjectController::class, 'show']);
Route::get('/projects/{project}/summary', [ProjectController::class, 'summary']);
Route::get('/projects/{project}/scans', [ProjectController::class, 'scans']);
Route::get('/projects/{project}/api-keys', [ProjectApiKeyController::class, 'index']);
Route::post('/projects/{project}/api-keys', [ProjectApiKeyController::class, 'store']);
Route::delete('/projects/{project}/api-keys/{apiKey}', [ProjectApiKeyController::class, 'destroy']);

Route::get('/scans', [ScanController::class, 'index']);
Route::get('/scans/{scan}', [ScanController::class, 'show']);
Route::post('/scans', [ScanController::class, 'store']);
Route::post('/scans/{scan}/remediations/ai', [ScanRemediationController::class, 'ai']);
Route::get('/usage-events', [UsageEventController::class, 'index']);
Route::post('/projects/{project}/usage-events', [UsageEventController::class, 'store']);
