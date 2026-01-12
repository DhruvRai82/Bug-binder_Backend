import axios from 'axios';

export class ProxyService {
    async forwardRequest(req: any): Promise<{ status: number, headers: any, data: any }> {
        const { method, url, headers, body } = req;

        try {
            const response = await axios({
                method,
                url,
                headers,
                data: body,
                validateStatus: () => true // Resolve promise for all status codes
            });

            return {
                status: response.status,
                headers: response.headers as any,
                data: response.data
            };
        } catch (error: any) {
            console.error('[ProxyService] Request failed:', error.message);
            throw new Error(`Proxy request failed: ${error.message}`);
        }
    }
}

export const proxyService = new ProxyService();
