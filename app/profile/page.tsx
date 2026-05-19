"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ArrowUpRight } from "lucide-react";

interface ProfileData {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    creditBalance: number;
  };
  subscription: { plan: string; status: string } | null;
  purchases: { amount: number; createdAt: string }[];
  recentProjects: {
    id: string;
    name: string | null;
    status: string;
    updatedAt: string;
  }[];
}

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "border-rule-strong text-muted",
  GENERATING: "border-ink text-ink",
  READY: "border-ink bg-ink text-ink-inverse",
};

export default function ProfilePage() {
  useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setProfile(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />

      <main className="mx-auto max-w-[1400px] px-6 pt-32 pb-20">
        <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
          <span className="mono-label rounded-sm border border-ink px-2 py-1">
            SCENE · PROFILE · TAKE 01
          </span>
          <span className="mono-tick">ACCOUNT</span>
          <span className="text-rule-strong">·</span>
          <span className="mono-tick">CREDITS · HISTORY · PROJECTS</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border border-rule border-t-ink" />
          </div>
        ) : !profile ? (
          <p className="py-24 text-center text-muted">Failed to load profile.</p>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Left: identity */}
            <section className="lg:col-span-4">
              <div className="border border-ink p-8">
                <div className="flex items-center gap-4">
                  {profile.user.image ? (
                    <img
                      src={profile.user.image}
                      alt={profile.user.name || "User"}
                      className="h-16 w-16 rounded-full border border-rule-strong"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rule-strong bg-paper-2 text-2xl font-medium text-ink">
                      {profile.user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <div>
                    <p className="mono-tick">USER</p>
                    <h1 className="font-serif-italic text-3xl text-ink">
                      {profile.user.name || "User"}
                    </h1>
                    <p className="text-sm text-muted">{profile.user.email}</p>
                  </div>
                </div>
              </div>

              {/* Credits + Sub */}
              <div className="mt-px grid grid-cols-1 gap-px bg-rule">
                <div className="bg-paper p-8">
                  <p className="mono-tick">CREDIT BALANCE</p>
                  <p className="mt-3 font-serif-italic text-6xl text-ink">
                    {profile.user.creditBalance}
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-ink-inverse"
                  >
                    Buy credits
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="bg-paper p-8">
                  <p className="mono-tick">SUBSCRIPTION</p>
                  {profile.subscription ? (
                    <>
                      <p className="mt-3 text-2xl font-medium capitalize">
                        {profile.subscription.plan}
                      </p>
                      <p className="mono-tick mt-1">
                        {profile.subscription.status.toUpperCase()}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-muted">No active plan.</p>
                  )}
                </div>
              </div>
            </section>

            {/* Right: history + projects */}
            <section className="lg:col-span-8 space-y-12">
              <div>
                <div className="flex items-end justify-between border-b border-rule pb-3">
                  <h2 className="mono-label">PURCHASE HISTORY</h2>
                  <span className="mono-tick">
                    {profile.purchases.length} TX
                  </span>
                </div>
                {profile.purchases.length === 0 ? (
                  <p className="py-8 text-sm text-muted">No purchases yet.</p>
                ) : (
                  <div className="divide-y divide-rule">
                    {profile.purchases.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-4"
                      >
                        <span className="font-serif-italic text-xl text-ink">
                          +{p.amount}{" "}
                          <span className="font-sans not-italic text-sm text-muted">
                            credits
                          </span>
                        </span>
                        <span className="mono-tick">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-end justify-between border-b border-rule pb-3">
                  <h2 className="mono-label">RECENT PROJECTS</h2>
                  <Link
                    href="/projects"
                    className="mono-tick hover:text-ink"
                  >
                    SEE ALL →
                  </Link>
                </div>
                {profile.recentProjects.length === 0 ? (
                  <p className="py-8 text-sm text-muted">No projects yet.</p>
                ) : (
                  <div className="divide-y divide-rule">
                    {profile.recentProjects.map((proj) => (
                      <Link
                        key={proj.id}
                        href={`/projects/${proj.id}/jitter`}
                        className="flex items-center justify-between py-4 transition-colors hover:bg-paper-2"
                      >
                        <span className="truncate text-base text-ink">
                          {proj.name || "Untitled"}
                        </span>
                        <div className="flex items-center gap-3">
                          <span
                            className={`mono-label rounded-sm border px-2 py-0.5 ${
                              STATUS_CHIP[proj.status] ||
                              "border-rule-strong text-muted"
                            }`}
                          >
                            {proj.status}
                          </span>
                          <span className="mono-tick">
                            {new Date(proj.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
