<?php

return [
    'paths' => ['api/*', 'up'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', env(
            'CORS_ALLOWED_ORIGINS',
            'http://localhost:4210,http://127.0.0.1:4210,http://[::1]:4210,http://localhost:4202,http://127.0.0.1:4202,http://[::1]:4202,http://localhost:4200,http://127.0.0.1:4200,http://[::1]:4200'
        ))
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
