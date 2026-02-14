"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";

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
  recentProjects: { id: string; name: string | null; status: string; updatedAt: string }[];
}

export default function ProfilePage() {
  const { data: session } = useSession();
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

  const statusColor: Record<string, string> = {
    DRAFT: "bg-gray-500/20 text-gray-300",
    GENERATING: "bg-yellow-500/20 text-yellow-300",
    READY: "bg-green-500/20 text-green-300",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : !profile ? (
          <p className="text-center text-gray-400 py-20">Failed to load profile.</p>
        ) : (
          <div className="space-y-8">
            {/* User Info */}
            <section className="flex items-center gap-6">
              {profile.user.image ? (
                <img
                  src={profile.user.image}
                  alt={profile.user.name || "User"}
                  className="w-20 h-20 rounded-full border-2 border-white/10"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-2xl font-medium">
                  {profile.user.name?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold">{profile.user.name || "User"}</h1>
                <p className="text-gray-400">{profile.user.email}</p>
              </div>
            </section>

            {/* Credits & Subscription */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-white/10 rounded-lg p-6">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Credit Balance</p>
                <p className="text-4xl font-bold">{profile.user.creditBalance}</p>
                <Link
                  href="/pricing"
                  className="inline-block mt-4 px-4 py-2 border border-white text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                >
                  Buy Credits
                </Link>
              </div>

              <div className="border border-white/10 rounded-lg p-6">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Subscription</p>
                {profile.subscription ? (
                  <>
                    <p className="text-xl font-semibold capitalize">{profile.subscription.plan}</p>
                    <p className="text-sm text-gray-400 capitalize">{profile.subscription.status}</p>
                  </>
                ) : (
                  <p className="text-gray-500 mt-1">No active subscription</p>
                )}
              </div>
            </section>

            {/* Purchase History */}
            <section>
              <h2 className="text-lg font-semibold mb-4 uppercase tracking-wider">Purchase History</h2>
              {profile.purchases.length === 0 ? (
                <p className="text-gray-500 text-sm">No purchases yet.</p>
              ) : (
                <div className="border border-white/10 rounded-lg divide-y divide-white/10">
                  {profile.purchases.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm">+{p.amount} credits</span>
                      <span className="text-xs text-gray-400">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Projects */}
            <section>
              <h2 className="text-lg font-semibold mb-4 uppercase tracking-wider">Recent Projects</h2>
              {profile.recentProjects.length === 0 ? (
                <p className="text-gray-500 text-sm">No projects yet.</p>
              ) : (
                <div className="border border-white/10 rounded-lg divide-y divide-white/10">
                  {profile.recentProjects.map((proj) => (
                    <Link
                      key={proj.id}
                      href={`/projects/${proj.id}/creative`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm truncate">{proj.name || "Untitled"}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[proj.status] || "bg-gray-500/20 text-gray-300"}`}>
                          {proj.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(proj.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
