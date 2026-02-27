import { Router } from "express";

const router: Router = Router();

// ============================================================
// POST /webhooks/render-complete
// ============================================================
router.post("/render-complete", (req, res) => {
  const { jobId, status, videoUrl } = req.body;
  console.log(
    `[Webhook] Render callback: job=${jobId} status=${status} url=${videoUrl || "N/A"}`,
  );
  res.json({ received: true });
});

export default router;
