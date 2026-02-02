import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { PaymentProvider, GatewayName } from './payment_provider.ts'

/**
 * Stripe Implementation
 */
export class StripeProvider implements PaymentProvider {
    private stripe: Stripe;

    constructor() {
        const key = Deno.env.get('STRIPE_SECRET_KEY');
        if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
        this.stripe = new Stripe(key, { apiVersion: '2023-10-16' });
    }

    async createCustomer(email: string, name?: string, cpfCnpj?: string, metadata?: Record<string, any>): Promise<string> {
        const customer = await this.stripe.customers.create({
            email,
            name,
            metadata: { ...metadata, cpfCnpj: cpfCnpj } // Store in metadata for Stripe
        });
        return customer.id;
    }

    async createCheckout(params: {
        customerId: string;
        priceId: string;
        successUrl: string;
        cancelUrl: string;
        metadata?: Record<string, any>;
    }): Promise<{ url: string; sessionId: string; gateway: string }> {
        const session = await this.stripe.checkout.sessions.create({
            customer: params.customerId,
            line_items: [{ price: params.priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: params.metadata,
            subscription_data: { metadata: params.metadata }
        });

        if (!session.url) throw new Error('Stripe Session URL is null');

        return {
            url: session.url,
            sessionId: session.id,
            gateway: 'stripe'
        };
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        await this.stripe.subscriptions.cancel(subscriptionId);
    }

    async getSubscriptionStatus(subscriptionId: string): Promise<any> {
        return await this.stripe.subscriptions.retrieve(subscriptionId);
    }

    async getInvoices(customerId: string): Promise<any[]> {
        const invoices = await this.stripe.invoices.list({
            customer: customerId,
            limit: 10
        });
        return invoices.data;
    }
}

/**
 * Plan Mapping for ASAAS (Translating Price IDs to ASAAS params)
 */
const ASAAS_PLAN_CONFIGS: Record<string, { name: string, value: number, cycle: string }> = {
    'price_1SqHrZJrvxBiHEjISBIjF1Xg': { name: 'Risu Mensal', value: 99.90, cycle: 'MONTHLY' },
    'price_1SqHtTJrvxBiHEIgyTx6ECr': { name: 'Risu Trimestral', value: 269.70, cycle: 'QUARTERLY' },
    'price_1SqHu6JrvxBiHEjIcFJOrE7Y': { name: 'Risu Semestral', value: 479.40, cycle: 'SEMIANNUALLY' },
    'price_1SqHuVJrvxBiHEjIUNJCWLFm': { name: 'Risu Anual', value: 838.80, cycle: 'YEARLY' },
}

/**
 * ASAAS Implementation
 */
export class ASAASProvider implements PaymentProvider {
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = Deno.env.get('ASAAS_API_KEY') || '';
        this.baseUrl = Deno.env.get('ASAAS_URL') || 'https://sandbox.asaas.com/api/v3';
        if (!this.apiKey) console.warn('ASAAS_API_KEY is not set');
    }

    private async request(method: string, path: string, body?: any) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'access_token': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('ASAAS API Error:', data);
            throw new Error(`ASAAS Error: ${data.errors?.[0]?.description || response.statusText}`);
        }
        return data;
    }

    async createCustomer(email: string, name?: string, cpfCnpj?: string, metadata?: Record<string, any>): Promise<string> {
        console.log('ASAAS: Creating customer for', email);
        const data = await this.request('POST', '/customers', {
            name,
            email,
            cpfCnpj,
            externalReference: metadata?.supabase_user_id
        });
        return data.id;
    }

    async createCheckout(params: {
        customerId: string;
        priceId: string;
        successUrl: string;
        cancelUrl: string;
        metadata?: Record<string, any>;
    }): Promise<{ url: string; sessionId: string; gateway: string }> {
        console.log('ASAAS: Creating checkout for', params.customerId);

        const config = ASAAS_PLAN_CONFIGS[params.priceId] || { name: 'Assinatura Risu', value: 99.90, cycle: 'MONTHLY' };

        // We use Payment Links for the Checkout experience
        const data = await this.request('POST', '/paymentLinks', {
            name: config.name,
            description: `Plano ${config.name} - Gestão de Aluguel`,
            billingType: 'UNDEFINED', // Allows Credit Card and Pix
            chargeType: 'RECURRENT',
            subscriptionCycle: config.cycle,
            value: config.value,
            callback: {
                successUrl: params.successUrl,
                autoRedirect: true
            }
        });

        return {
            url: data.url,
            sessionId: data.id,
            gateway: 'asaas'
        };
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        console.log('ASAAS: Canceling', subscriptionId);
        await this.request('DELETE', `/subscriptions/${subscriptionId}`);
    }

    async getSubscriptionStatus(subscriptionId: string): Promise<any> {
        const data = await this.request('GET', `/subscriptions/${subscriptionId}`);
        return {
            status: data.status === 'ACTIVE' ? 'active' : 'inactive',
            ...data
        };
    }

    async getInvoices(customerId: string): Promise<any[]> {
        const data = await this.request('GET', `/payments?customer=${customerId}&limit=10`);
        return data.data || [];
    }
}

/**
 * Factory for Payment Providers
 */
export class PaymentProviderFactory {
    static getProvider(name?: string): PaymentProvider {
        const envGateway = Deno.env.get('ACTIVE_GATEWAY');
        const activeGateway = (name || envGateway || 'stripe').toLowerCase() as GatewayName;

        console.log(`[Factory] Selected Gateway: ${activeGateway} (Source: ${name ? 'arg' : envGateway ? 'env' : 'default'})`);

        switch (activeGateway) {
            case 'stripe':
                return new StripeProvider();
            case 'asaas':
                return new ASAASProvider();
            default:
                throw new Error(`Payment gateway '${activeGateway}' is not supported.`);
        }
    }
}
