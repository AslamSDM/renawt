# Environment variables (append yours)

## apps/web
AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_URL, AUTH_TRUST_HOST
DATABASE_URL, DIRECT_DATABASE_URL
DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_ENVIRONMENT, DODO_PAYMENTS_WEBHOOK_SIGNING_KEY, DODO_PAYMENTS_RETURN_URL, NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT
RESEND_API_KEY
ENGINE_URL (e.g. http://localhost:3001), API_KEY (shared bearer with engine)
R2_* (ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET_NAME, ENDPOINT, PUBLIC_URL)

## apps/engine
PORT=3001, API_KEY, CORS_ORIGIN, APP_URL
DATABASE_URL, DIRECT_DATABASE_URL, MASTRA_DATABASE_URL (same Neon, schema=mastra)
ANTHROPIC_API_KEY, DEEPSEEK_API_KEY
INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY (dev: inngest dev server, no keys)
ELEVENLABS_API_KEY
GOOGLE_AI_API_KEY (Nano Banana images), RECRAFT_API_KEY (optional), PEXELS_API_KEY, PIXABAY_API_KEY
R2_* (as above)
RENDER_PROVIDER=lambda|local, RENDER_QUEUE_URL, AWS_REGION, HF_RENDER_SERVICE_URL (local render-service fallback)
PUBLISHER_PROVIDER=dryrun|postforme|uploadpost, POSTFORME_API_KEY, UPLOADPOST_API_KEY
YOUTUBE_API_KEY (radar), REDDIT_CLIENT_ID/SECRET, DATAFORSEO_LOGIN/PASSWORD, EXA_API_KEY, APIFY_TOKEN (optional)

## apps/web — billing (db-billing)
Dodo product ids (one per plan × billing, plus add-on packs). Missing id → checkout returns 503 for that product.
DODO_PRODUCT_STARTER_MONTHLY, DODO_PRODUCT_STARTER_ANNUAL
DODO_PRODUCT_CREATOR_MONTHLY, DODO_PRODUCT_CREATOR_ANNUAL
DODO_PRODUCT_PRO_MONTHLY, DODO_PRODUCT_PRO_ANNUAL
DODO_PRODUCT_AGENCY_MONTHLY, DODO_PRODUCT_AGENCY_ANNUAL
DODO_PRODUCT_ADDON_AI_VIDEO_CLIPS_10, DODO_PRODUCT_ADDON_CUSTOM_MUSIC_10
API_KEY also guards POST /api/billing/reset (engine cron: `Authorization: Bearer ${API_KEY}`).
PRISMA_LOG_QUERIES=true (optional, any app using @remawt/db) enables query logging.

## packages/radar (runs inside apps/engine)
YOUTUBE_API_KEY — YouTube Data API v3 (mostPopular + search.list breakout; quota budgeted: 10k/day pool, search 100/day, 10% reserve)
REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET — optional; app-only OAuth (else public JSON with User-Agent)
DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD — optional; Google Trends rising queries (weekly)
EXA_API_KEY — optional; "this week in <niche>" news evidence (weekly)
APIFY_TOKEN — optional; TikTok hashtag actor. Only used when RADAR_ENABLE_SCRAPERS=1 (ToS risk, off by default)
RADAR_ENABLE_SCRAPERS — "1" to enable scraper sources (Apify TikTok)
APIFY_TIKTOK_ACTOR — optional actor override (default clockworks~tiktok-scraper)

## packages/publisher (read by apps/engine via `createPublisher(process.env)`)
PUBLISHER_PROVIDER=dryrun|postforme|uploadpost|youtube_direct (unset → postforme/uploadpost if their key exists, else dryrun)
POSTFORME_API_KEY, POSTFORME_BASE_URL (optional, default https://api.postforme.dev)
UPLOADPOST_API_KEY, UPLOADPOST_BASE_URL (optional, default https://api.upload-post.com/api), UPLOADPOST_CONNECT_LOGO_URL, UPLOADPOST_CONNECT_TITLE (optional white-label connect page)
YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI (youtube_direct, experimental; engine also supplies a tokenStore)
PUBLISHER_CAPS (optional, e.g. "TIKTOK=10,INSTAGRAM=50" overrides default daily caps)
DRYRUN_PLATFORMS (optional, e.g. "TIKTOK,YOUTUBE,INSTAGRAM"; platforms the dryrun adapter reports as connected)
