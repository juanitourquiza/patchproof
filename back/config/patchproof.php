<?php

return [
    'admin_key' => env('PATCHPROOF_ADMIN_KEY', ''),
    'remediation_ai' => [
        'enabled' => (bool) env('PATCHPROOF_REMEDIATION_AI_ENABLED', false),
        'provider' => env('PATCHPROOF_REMEDIATION_AI_PROVIDER', 'openai'),
        'model' => env('PATCHPROOF_REMEDIATION_AI_MODEL', 'gpt-4.1-mini'),
        'base_url' => env('PATCHPROOF_REMEDIATION_AI_BASE_URL', 'https://api.openai.com/v1'),
        'api_key' => env('PATCHPROOF_REMEDIATION_AI_API_KEY', ''),
    ],
];
