<?php

namespace App\Services\Reporting;

use App\Models\Scan;

class ScanResultService
{
    /**
     * @return array{
     *   score: int,
     *   verdict: string,
     *   label: string,
     *   summary: string,
     *   recommendation: string,
     *   finding_total: int,
     *   severity: string
     * }
     */
    public function forScan(Scan $scan): array
    {
        $counts = $this->collectSeverityCounts($scan);
        $findingTotal = max(
            array_sum($counts),
            (int) data_get($scan->summary ?? [], 'total', 0),
            count($scan->findings ?? [])
        );
        $score = $this->calculateScore($counts, $findingTotal);
        $verdict = $this->verdictForScore($score, $findingTotal);
        $severity = $this->worstSeverity($counts);

        return [
            'score' => $score,
            'verdict' => $verdict,
            'label' => $this->labelForVerdict($verdict),
            'summary' => $this->summaryFor($findingTotal, $severity, $counts),
            'recommendation' => $this->recommendationFor($verdict, $findingTotal),
            'finding_total' => $findingTotal,
            'severity' => $severity,
        ];
    }

    /**
     * @return array{critical:int, high:int, medium:int, low:int}
     */
    private function collectSeverityCounts(Scan $scan): array
    {
        $summary = $scan->summary ?? [];
        $counts = [
            'critical' => 0,
            'high' => 0,
            'medium' => 0,
            'low' => 0,
        ];

        if (!empty($scan->findings)) {
            foreach ($scan->findings as $finding) {
                $severity = strtolower((string) data_get($finding, 'severity', data_get($finding, 'level', '')));

                if (array_key_exists($severity, $counts)) {
                    $counts[$severity]++;
                }
            }
        } else {
            foreach (array_keys($counts) as $severity) {
                $counts[$severity] = (int) data_get($summary, $severity, 0);
            }
        }

        return $counts;
    }

    /**
     * @param array{critical:int, high:int, medium:int, low:int} $counts
     */
    private function calculateScore(array $counts, int $findingTotal): int
    {
        if ($findingTotal <= 0) {
            return 100;
        }

        $score = 100
            - ($counts['critical'] * 35)
            - ($counts['high'] * 20)
            - ($counts['medium'] * 10)
            - ($counts['low'] * 5);

        return max(0, min(100, $score));
    }

    private function verdictForScore(int $score, int $findingTotal): string
    {
        if ($findingTotal === 0) {
            return 'clean';
        }

        if ($score >= 90) {
            return 'clean';
        }

        if ($score >= 70) {
            return 'low-risk';
        }

        if ($score >= 40) {
            return 'moderate';
        }

        return 'high-risk';
    }

    private function labelForVerdict(string $verdict): string
    {
        return match ($verdict) {
            'clean' => 'Clean result',
            'low-risk' => 'Low-risk result',
            'moderate' => 'Needs review',
            'high-risk' => 'High-risk result',
            default => 'Security result',
        };
    }

    /**
     * @param array{critical:int, high:int, medium:int, low:int} $counts
     */
    private function summaryFor(int $findingTotal, string $severity, array $counts): string
    {
        if ($findingTotal <= 0) {
            return 'No findings were recorded. Keep the clean baseline for future comparisons.';
        }

        $parts = [
            $findingTotal.' finding'.($findingTotal === 1 ? '' : 's'),
        ];

        foreach (['critical', 'high', 'medium', 'low'] as $bucket) {
            if ($counts[$bucket] > 0) {
                $parts[] = $counts[$bucket].' '.$bucket;
            }
        }

        return sprintf(
            'Detected %s with a worst severity of %s.',
            implode(' · ', $parts),
            $severity === 'none' ? 'none' : $severity
        );
    }

    private function recommendationFor(string $verdict, int $findingTotal): string
    {
        if ($findingTotal <= 0) {
            return 'No immediate issues were found. Keep the clean result as a baseline and scan again after the next change.';
        }

        return match ($verdict) {
            'clean' => 'Treat this as a clean-ish result and review the report history after the next change.',
            'low-risk' => 'Review the highlighted items and rerun the scan after the fixes land.',
            'moderate' => 'Prioritize the findings and verify the risky code paths before shipping.',
            'high-risk' => 'Address the findings before release and rerun the scan until the score improves.',
            default => 'Review the scan and compare it against the previous baseline.',
        };
    }

    /**
     * @param array{critical:int, high:int, medium:int, low:int} $counts
     */
    private function worstSeverity(array $counts): string
    {
        foreach (['critical', 'high', 'medium', 'low'] as $bucket) {
            if ($counts[$bucket] > 0) {
                return $bucket;
            }
        }

        return 'none';
    }
}
