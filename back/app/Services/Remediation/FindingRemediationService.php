<?php

namespace App\Services\Remediation;

use Illuminate\Support\Arr;

class FindingRemediationService
{
    /**
     * @param array<int, array<string, mixed>> $findings
     * @return array<int, array<string, mixed>>
     */
    public function forFindings(array $findings): array
    {
        return collect($findings)
            ->map(fn (array $finding) => $this->forFinding($finding))
            ->values()
            ->all();
    }

    /**
     * @param array<string, mixed> $finding
     * @return array<string, mixed>
     */
    public function forFinding(array $finding): array
    {
        $ruleId = strtoupper((string) Arr::get($finding, 'ruleId', Arr::get($finding, 'rule_id', '')));
        $ruleData = $this->ruleData($ruleId);
        $title = trim((string) Arr::get($finding, 'title', Arr::get($finding, 'message', '')));
        $description = trim((string) Arr::get($finding, 'description', ''));
        $evidence = trim((string) Arr::get($finding, 'evidence', Arr::get($finding, 'snippet', '')));

        return [
            'rule_id' => $ruleId ?: null,
            'rule_title' => $ruleData['rule_title'],
            'finding_title' => $title !== '' ? $title : $ruleData['rule_title'],
            'summary' => $description !== '' ? $description : $ruleData['summary'],
            'source' => 'deterministic',
            'confidence' => 'medium',
            'primary_fix' => $ruleData['primary_fix'],
            'alternatives' => $ruleData['alternatives'],
            'ai_prompt' => $this->buildAiPrompt($ruleId, $title, $description, $evidence, $ruleData['prompt_hint']),
        ];
    }

    /**
     * @return array{rule_title: string, summary: string, primary_fix: array<string, string>, alternatives: array<int, array<string, string>>, prompt_hint: string}
     */
    private function ruleData(string $ruleId): array
    {
        $data = [
            'rule_title' => 'Finding',
            'summary' => 'PatchProof detected a risky pattern that should be reviewed manually.',
            'primary_fix' => [
                'title' => 'Review the pattern',
                'description' => 'Apply a safe framework-native fix or refine the detection with more context.',
            ],
            'alternatives' => [
                [
                    'title' => 'Add an allowlist only if intentional',
                    'description' => 'If the pattern is required by design, document the exception and constrain it tightly.',
                ],
            ],
            'prompt_hint' => 'Explain the safest remediation options for this finding.',
        ];

        switch ($ruleId) {
            case 'PP002':
                $data = [
                    'rule_title' => 'Potential SQL injection',
                    'summary' => 'SQL is being built with concatenation or interpolation instead of safer bindings.',
                    'primary_fix' => [
                        'title' => 'Use bound parameters',
                        'description' => 'Move raw values into placeholders and bindings, or use the query builder / prepared statements.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Use the framework query builder',
                            'description' => 'Compose the query with builder methods instead of raw SQL fragments.',
                        ],
                        [
                            'title' => 'Whitelist sort/filter inputs',
                            'description' => 'If the raw SQL is only for column or direction selection, restrict values to a strict allowlist.',
                        ],
                    ],
                    'prompt_hint' => 'Focus on parameterized queries, bound values, and Laravel-safe query builder replacements.',
                ];
                break;
            case 'PP006':
                $data = [
                    'rule_title' => 'Sensitive public route',
                    'summary' => 'A route appears to expose an operational or privileged action without obvious auth protection.',
                    'primary_fix' => [
                        'title' => 'Protect the route',
                        'description' => 'Add auth / authorization middleware, signed URLs, or move the action behind a scheduler or queue.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Require role-based access',
                            'description' => 'Restrict the route to a trusted admin or service role.',
                        ],
                        [
                            'title' => 'Move to an internal job',
                            'description' => 'If this is maintenance, trigger it from an internal queue worker instead of a public endpoint.',
                        ],
                    ],
                    'prompt_hint' => 'Explain how to protect a public route in Laravel without breaking the intended maintenance workflow.',
                ];
                break;
            case 'PP007':
                $data = [
                    'rule_title' => 'Object-level authorization bypass risk',
                    'summary' => 'A state-changing route uses object IDs but does not show an obvious ownership or authorization check.',
                    'primary_fix' => [
                        'title' => 'Check ownership explicitly',
                        'description' => 'Authorize the current user against the referenced object before mutating it.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Use policy / gate checks',
                            'description' => 'Move object authorization into Laravel policies for consistency.',
                        ],
                        [
                            'title' => 'Scope the query by tenant',
                            'description' => 'Resolve the object through the current account or tenant instead of a raw ID lookup.',
                        ],
                    ],
                    'prompt_hint' => 'Suggest Laravel policy, gate, or tenant-scoped query fixes for object-level access control.',
                ];
                break;
            case 'PP013':
                $data = [
                    'rule_title' => 'Auth endpoint without throttle',
                    'summary' => 'An authentication endpoint lacks obvious rate limiting or brute-force protection.',
                    'primary_fix' => [
                        'title' => 'Add throttle middleware',
                        'description' => 'Apply route throttling or lockout rules to login and token endpoints.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Add per-account lockout',
                            'description' => 'Lock accounts or increase delays after repeated failed attempts.',
                        ],
                        [
                            'title' => 'Protect with step-up auth',
                            'description' => 'Use MFA or email/OTP verification for sensitive auth flows.',
                        ],
                    ],
                    'prompt_hint' => 'Recommend rate limiting and brute-force protection patterns for Laravel authentication endpoints.',
                ];
                break;
            case 'PP014':
                $data = [
                    'rule_title' => 'Weak or empty password value',
                    'summary' => 'The code adds an empty or obvious default password value in app code.',
                    'primary_fix' => [
                        'title' => 'Require a real password or one-time flow',
                        'description' => 'Stop assigning default passwords; force a user-chosen password or a verification link / reset flow.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Generate a random temporary secret',
                            'description' => 'If you must seed access, generate a one-time password and require rotation on first login.',
                        ],
                        [
                            'title' => 'Use passwordless onboarding',
                            'description' => 'Replace the default password step with email verification or invite-based activation.',
                        ],
                    ],
                    'prompt_hint' => 'Offer safe Laravel onboarding alternatives instead of default or empty password values.',
                ];
                break;
            case 'PP015':
                $data = [
                    'rule_title' => 'OTP/code validation without throttle',
                    'summary' => 'Code validation routes appear to lack attempt limits or rate limiting.',
                    'primary_fix' => [
                        'title' => 'Throttle validation attempts',
                        'description' => 'Rate-limit OTP or code validation endpoints and expire codes quickly.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Track failed attempts',
                            'description' => 'Store failed validation counts per account, code, or device fingerprint.',
                        ],
                        [
                            'title' => 'Shorten code lifetime',
                            'description' => 'Make codes single-use and short-lived so brute force has little value.',
                        ],
                    ],
                    'prompt_hint' => 'Describe brute-force protection options for Laravel OTP/code validation endpoints.',
                ];
                break;
            case 'PP016':
                $data = [
                    'rule_title' => 'Password change without confirmation',
                    'summary' => 'The password change flow does not show a confirmation step like current-password validation.',
                    'primary_fix' => [
                        'title' => 'Require password confirmation',
                        'description' => 'Require current-password verification or Laravel password confirmation middleware before updating credentials.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Re-authenticate for sensitive changes',
                            'description' => 'Ask the user to re-enter credentials or complete MFA before password updates.',
                        ],
                        [
                            'title' => 'Add a confirmation timer',
                            'description' => 'Use a short-lived confirmation window for sensitive account changes.',
                        ],
                    ],
                    'prompt_hint' => 'Suggest secure password-change patterns for Laravel accounts.',
                ];
                break;
            case 'PP017':
                $data = [
                    'rule_title' => 'OTP/code issuance without throttle',
                    'summary' => 'Code issuance routes can be abused to spam or brute-force verification flows.',
                    'primary_fix' => [
                        'title' => 'Rate-limit code issuance',
                        'description' => 'Throttle OTP generation and add resend cooldowns.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Add resend cooldowns',
                            'description' => 'Prevent code flooding by enforcing a short wait between requests.',
                        ],
                        [
                            'title' => 'Link issuance to verified channels',
                            'description' => 'Only issue codes through already-verified emails or phone numbers.',
                        ],
                    ],
                    'prompt_hint' => 'Explain abuse-resistant OTP issuance patterns in Laravel.',
                ];
                break;
            case 'PP022':
                $data = [
                    'rule_title' => 'Dangerous business action',
                    'summary' => 'The diff adds a high-impact action without a visible confirmation, review, or dry-run step.',
                    'primary_fix' => [
                        'title' => 'Add an explicit safety step',
                        'description' => 'Require confirmation, approval, preview, or dry-run before executing the action.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Use review-before-execute',
                            'description' => 'Route the operation through a review queue or approval workflow.',
                        ],
                        [
                            'title' => 'Split planning from execution',
                            'description' => 'Let the user preview the effect, then perform the change only after confirmation.',
                        ],
                    ],
                    'prompt_hint' => 'Describe safer patterns for destructive or high-impact business actions.',
                ];
                break;
            case 'PP023':
                $data = [
                    'rule_title' => 'Swallowed exception without logging',
                    'summary' => 'The code catches an exception but does not log or rethrow it.',
                    'primary_fix' => [
                        'title' => 'Log the exception',
                        'description' => 'Record the error with context and rethrow it when the failure should not be silent.',
                    ],
                    'alternatives' => [
                        [
                            'title' => 'Report to monitoring',
                            'description' => 'Send the exception to your error tracker or observability stack.',
                        ],
                        [
                            'title' => 'Handle only expected failures',
                            'description' => 'If the catch is intentional, narrow it to the exact error you expect and log the rest.',
                        ],
                    ],
                    'prompt_hint' => 'Suggest observability-friendly exception handling patterns for PHP / Laravel.',
                ];
                break;
        }

        return $data;
    }

    private function buildAiPrompt(string $ruleId, string $title, string $description, string $evidence, string $promptHint): string
    {
        $parts = array_filter([
            $ruleId !== '' ? "Rule: {$ruleId}" : null,
            $title !== '' ? "Finding: {$title}" : null,
            $description !== '' ? "Details: {$description}" : null,
            $evidence !== '' ? "Evidence: {$evidence}" : null,
            'Goal: suggest one primary fix and two alternatives for Laravel/PHP.',
            $promptHint,
            'Avoid unsafe code; keep the answer brief and actionable.',
        ]);

        return implode(' ', $parts);
    }
}
