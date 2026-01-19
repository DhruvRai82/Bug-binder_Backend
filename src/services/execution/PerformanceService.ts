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
            const path = require('path');
            const dataDir = path.join(__dirname, '../../../data/chrome_temp');

            // 1. Launch Chrome with custom user data dir
            chrome = await chromeLauncher.launch({
                chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox'],
                userDataDir: dataDir
            });

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

    async saveReport(projectId: string, report: PerformanceResult): Promise<void> {
        const fs = require('fs');
        const path = require('path');
        const DATA_FILE = path.join(__dirname, '../../../data/performance.json');

        let data: any[] = [];
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        const newEntry = {
            id: Date.now().toString(),
            projectId,
            timestamp: new Date().toISOString(),
            ...report
        };

        data.push(newEntry);
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }

    async getHistory(projectId: string): Promise<any[]> {
        const fs = require('fs');
        const path = require('path');
        const DATA_FILE = path.join(__dirname, '../../../data/performance.json');

        if (!fs.existsSync(DATA_FILE)) return [];

        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        return data.filter((item: any) => item.projectId === projectId).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    async deleteRun(id: string): Promise<void> {
        const fs = require('fs');
        const path = require('path');
        const DATA_FILE = path.join(__dirname, '../../../data/performance.json');

        if (!fs.existsSync(DATA_FILE)) return;

        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        data = data.filter((item: any) => item.id !== id);

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }
}
