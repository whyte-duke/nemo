import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// ─── MODE MAINTENANCE ───────────────────────────────────────────────────────
// Mettre à `true` pour bloquer tout le site et rediriger vers /maintenance.
// Remettre à `false` et redéployer pour réactiver le site.
export const MAINTENANCE_MODE = true;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rafraîchit la session Supabase Auth et gère les redirections auth + onboarding.
 * À appeler depuis src/middleware.ts (racine du projet).
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── Maintenance gate ──────────────────────────────────────────────────────
  if (MAINTENANCE_MODE) {
    const isMaintenancePage = pathname === "/maintenance";
    const isStaticAsset =
      pathname.startsWith("/_next/") || pathname.includes(".");

    if (!isMaintenancePage && !isStaticAsset) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.redirect(url);
    }

    // On /maintenance or static asset — let it through
    return NextResponse.next({ request });
  }
  // ──────────────────────────────────────────────────────────────────────────

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Rafraîchit le token si expiré — IMPORTANT : ne pas supprimer cet appel
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    pathname.startsWith("/connexion") ||
    pathname.startsWith("/inscription");

  const isApiRoute = pathname.startsWith("/api");
  const isOnboardingPage = pathname.startsWith("/onboarding");
  const isStaticFile = pathname.includes(".");
  const isProtectedPage = pathname.startsWith("/profil");

  // Redirige vers /connexion si page protégée sans auth
  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }

  // Redirige vers / si page auth avec session active
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Vérification onboarding — uniquement pour les pages (pas API, pas fichiers statiques)
  if (user && !isApiRoute && !isAuthPage && !isOnboardingPage && !isStaticFile) {
    // Cookie de court-circuit : évite un appel DB sur chaque requête pour les utilisateurs
    // qui ont déjà terminé l'onboarding
    const onboardingDone = request.cookies.get("nemo_onboarding_done")?.value === "1";

    if (!onboardingDone) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      if (profile?.onboarding_completed) {
        // Onboarding terminé mais cookie absent → on le (re)pose
        response.cookies.set("nemo_onboarding_done", "1", {
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
        });
      } else {
        // Onboarding non terminé → rediriger
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
