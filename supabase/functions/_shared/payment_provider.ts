export interface PaymentProvider {
    /**
     * Creates or retrieves a customer in the gateway.
     */
    createCustomer(email: string, name?: string, cpfCnpj?: string, metadata?: Record<string, any>): Promise<string>;

    /**
     * Creates a checkout session or returns an payment URL/Pix code.
     */
    createCheckout(params: {
        customerId: string;
        priceId: string;
        successUrl: string;
        cancelUrl: string;
        customAmount?: number;
        metadata?: Record<string, any>;
    }): Promise<{ url: string; sessionId: string; gateway: string }>;

    /**
     * Cancels an active subscription.
     */
    cancelSubscription(subscriptionId: string): Promise<void>;

    /**
     * Gets billing/subscription info.
     */
    getSubscriptionStatus(subscriptionId: string): Promise<any>;

    /**
     * Lists recent invoices.
     */
    getInvoices(customerId: string): Promise<any[]>;
}

export type GatewayName = 'stripe' | 'asaas' | 'mercadopago';
