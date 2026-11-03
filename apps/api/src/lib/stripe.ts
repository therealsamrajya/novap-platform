import Stripe from "stripe";

// One client per request, like getDb. On Workers the SDK's "workerd" build
// uses fetch for HTTP and WebCrypto for webhook signatures, so no extra config.
export const getStripe = (env: Env) => new Stripe(env.STRIPE_SECRET_KEY);
