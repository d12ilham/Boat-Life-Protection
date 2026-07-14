import Stripe from "stripe";
import db from "../config/db.js";
import { triggerAllAutomations } from "../services/integrationService.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy");

/**
 * @swagger
 * /api/create-payment-intent:
 *   post:
 *     summary: Create Stripe Payment Intent
 *     description: Initializes a payment via Stripe embedded form for the specific contract amount.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contract_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Client secret for Stripe transaction
 */
export const createPaymentIntent = async (req, res) => {
  const { contract_id } = req.body;

  try {
    const contractResult = await db.query(
      "SELECT amount, customer_id FROM contracts WHERE id = $1",
      [contract_id],
    );
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ message: "Contract not found" });
    }

    const { amount, customer_id } = contractResult.rows[0];

    const customerResult = await db.query(
      "SELECT name, email FROM customers WHERE id = $1",
      [customer_id],
    );
    const { email } = customerResult.rows[0];

    // Determine the payment amount. Charge $1 (100 cents) in development, and the real amount in production.
    const isDev = (process.env.NODE_ENV || "development").toLowerCase() === "development";
    const chargeAmount = isDev ? 100 : Math.round(amount * 100);

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmount,
      currency: "usd",
      metadata: { contract_id, customer_id, customer_email: email },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Stripe Webhook (not typically documented via Swagger as it's a callback)
 */
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_dummy";

  console.log("Payment webhook received");

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;

    // Payment approved -> Update contract status to Paid
    // Fire all Integrations Process
    const { contract_id, customer_id } = paymentIntent.metadata;

    try {
      await db.query(
        "UPDATE contracts SET status = 'paid', stripe_payment_id = $1 WHERE id = $2",
        [paymentIntent.id, contract_id],
      );

      // Auto-trigger full integration process
      // Fire and forget integration processes
      triggerAllAutomations(contract_id, customer_id, paymentIntent).catch(
        console.error,
      );
    } catch (dbError) {
      console.error("Error updating DB post-payment:", dbError);
    }
  }

  res.json({ received: true });
};
