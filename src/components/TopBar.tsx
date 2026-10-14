"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SessionPayload } from "@/lib/auth";

export default function TopBar({ session }: { session: SessionPayload | null }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  const initials = session
    ? session.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          <span className="brand-dot" />
          learnai
          <em className="brand-beta">beta</em>
          <span className="brand-sub">part of learn · social graph learning</span>
        </Link>
        <div className="spacer" />
        <Link href="/" className="navlink">The List</Link>
        <Link href="/map" className="navlink">The Map</Link>
        <Link href="/#sources" className="navlink hide-sm">Sources</Link>
        {session?.role === "ADMIN" && (
          <Link href="/admin" className="navlink">Admin</Link>
        )}
        {session ? (
          <div className="who">
            <Link href="/settings" className="avatar" title="Settings">{initials}</Link>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </div>
        ) : (
          <div className="who">
            <Link href="/login" className="navlink">Sign in</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Create account</Link>
          </div>
        )}
      </div>
    </header>
  );
}
