import axios, { Method } from 'axios';

interface ProxyRequest {
    method: Method;
    url: string;
    headers?: Record<string, string>;
    body?: any;
}

export class ProxyService {
    async forwardRequest({ method, url, headers, body }: ProxyRequest): Promise<{
        status: number;
        statusText: string;
        headers: Record<string, any>;
        data: any;
        duration: number;
        size: number;
    }> {
        try {
            const start = Date.now();

            // Filter out restricted headers if necessary
            const safeHeaders = { ...headers };
            delete safeHeaders['host'];
            delete safeHeaders['content-length'];

            const response = await axios({
                method,
                url,
                headers: safeHeaders,
                data: body,
                validateStatus: () => true // Don't throw on 4xx/5xx
            });

            const duration = Date.now() - start;

            return {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data,
                duration,
                size: JSON.stringify(response.data).length // Approx size
            };
        } catch (error: any) {
            return {
                status: 0,
                statusText: 'Error',
                headers: {},
                data: { error: error.message },
                duration: 0,
                size: 0
            };
        }
    }
}

export const proxyService = new ProxyService();
