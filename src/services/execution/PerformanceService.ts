import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { Service } from 'typedi';

export interface PerformanceResult {
    url: string;
    device: 'mobile' | 'desktop';
    scores: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
    };
    metrics: {
        lcp: string;
        cls: string;
        tbt: string;
        si: string;
    };
    audits: any[];
}

@Service()
export class PerformanceService {

    async analyzeUrl(url: string, device: 'mobile' | 'desktop' = 'mobile'): Promise<PerformanceResult> {
        let chrome;
        try {
            // 1. Launch Chrome
            chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

            // 2. Configure Options
            const options = {
                logLevel: 'info',
                output: 'json',
                onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
                port: chrome.port,
                formFactor: device,
                screenEmulation: device === 'mobile' ? undefined : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
            };

            // 3. Run Lighthouse
            // @ts-ignore - Lighthouse types can be finicky
            const runnerResult = await lighthouse(url, options);

            if (!runnerResult || !runnerResult.report) {
                throw new Error('Lighthouse failed to generate a report');
            }

            const reportJson = Array.isArray(runnerResult.report) ? runnerResult.report[0] : runnerResult.report;
            const report = JSON.parse(reportJson);

            // 4. Parse Results
            const categories = report.categories;
            const audits = report.audits;

            return {
                url,
                device,
                scores: {
                    performance: Math.round(categories.performance.score * 100),
                    accessibility: Math.round(categories.accessibility.score * 100),
                    bestPractices: Math.round(categories['best-practices'].score * 100),
                    seo: Math.round(categories.seo.score * 100),
                },
                metrics: {
                    lcp: audits['largest-contentful-paint'].displayValue,
                    cls: audits['cumulative-layout-shift'].displayValue,
                    tbt: audits['total-blocking-time'].displayValue,
                    si: audits['speed-index'].displayValue,
                },
                audits: this.extractKeyAudits(audits)
            };

        } catch (error) {
            console.error('[PerformanceService] Analysis failed:', error);
            throw error; // Re-throw the actual error to be handled by the controller
        } finally {
            if (chrome) await chrome.kill();
        }
    }

    private extractKeyAudits(audits: any) {
        // Extract high-impact failed audits
        return Object.values(audits)
            .filter((a: any) => a.score !== 1 && a.scoreDisplayMode !== 'notApplicable' && a.details?.type === 'table')
            .map((a: any) => ({
                id: a.id,
                title: a.title,
                description: a.description,
                score: a.score
            }))
            .slice(0, 5); // Top 5 issues
    }
}
