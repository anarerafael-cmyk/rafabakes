# rafa sourdough & cookies — rafabakes.com

Preorder site for weekly bake drops: menu with live "left" counts, checkout by
card/Apple Pay (Stripe), Venmo or Zelle, and an order page that doubles as a receipt.

## Setup (one time)

1. **Supabase**: new project → SQL Editor → paste `supabase/schema.sql` → Run.
   Then edit and run `supabase/first-drop.sql` to open your first drop.
2. **Vercel**: Add New → Project → import this GitHub repo → Deploy.
3. **Environment variables** (Vercel → Settings → Environment Variables): every name
   in `.env.example`. Redeploy after adding them.
4. **Stripe webhook**: Stripe → Developers → Webhooks → Add endpoint
   `https://rafabakes.com/api/stripe/webhook`, events `checkout.session.completed`
   and `checkout.session.expired`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. **Domain**: Vercel → Settings → Domains → add `rafabakes.com`.

Use Stripe test keys first (card `4242 4242 4242 4242`, any future date, any CVC),
then swap in live keys.

## Coming next
Baker view (orders, Mark paid, bake list) · menu & drop setup · reviews · text reminders.
