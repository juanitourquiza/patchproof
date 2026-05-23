<?php

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ScanController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::get('/projects', [ProjectController::class, 'index']);
Route::post('/projects', [ProjectController::class, 'store']);
Route::get('/projects/{project}', [ProjectController::class, 'show']);
Route::get('/projects/{project}/scans', [ProjectController::class, 'scans']);

Route::get('/scans/{scan}', [ScanController::class, 'show']);
Route::post('/scans', [ScanController::class, 'store']);
