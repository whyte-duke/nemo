"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, CheckCircle2, Tv2, CreditCard, Check, Minus, Bell, Phone, Server, Eye, EyeOff, RefreshCw, Copy, AlertCircle, Wifi, WifiOff, User, LogOut, Play } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useJellyfinLibrary } from "@/contexts/jellyfin-library-context";
import { STREAMING_SERVICES_CATALOG, ALL_SERVICE_IDS } from "@/lib/streaming-services-catalog";
import { cn } from "@/lib/utils";

export default function ParametresPage() {
  const { data: profile, isLoading, refetch: refetchProfile } = useProfile();
  const { mutate: updateProfile, isPending, isSuccess } = useUpdateProfile();
  const { syncLibrary, isSyncing, count, hasPersonalJellyfin, refreshLibrary } = useJellyfinLibrary();

  const [apiKey, setApiKey] = useState("");
  const [debridType, setDebridType] = useState<"alldebrid" | "realdebrid">("alldebrid");
  const [quality, setQuality] = useState("1080p");
  const [language, setLanguage] = useState("VF");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Préférences streaming
  // null = tous cochés ; sinon tableau des IDs sélectionnés
  const [selectedServices, setSelectedServices] = useState<string[] | null>(null);
  const [showPaid, setShowPaid] = useState(true);

  // Jellyfin personnel
  const [jellyfinUrl, setJellyfinUrl] = useState("");
  const [jellyfinApiKey, setJellyfinApiKey] = useState("");
  const [jellyfinApiKeyVisible, setJellyfinApiKeyVisible] = useState(false);
  const [jellyfinTestState, setJellyfinTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [jellyfinTestMsg, setJellyfinTestMsg] = useState("");
  const [jellyfinSyncStats, setJellyfinSyncStats] = useState<{
    movieCount: number; tvCount: number; totalSynced: number; serverName: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{ synced?: number; error?: string } | null>(null);
  const [webhookToken, setWebhookToken] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Compte utilisateur Jellyfin
  const [jellyfinUsername, setJellyfinUsername] = useState("");
  const [jellyfinPassword, setJellyfinPassword] = useState("");
  const [jellyfinPasswordVisible, setJellyfinPasswordVisible] = useState(false);
  const [jellyfinAuthState, setJellyfinAuthState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [jellyfinAuthMsg, setJellyfinAuthMsg] = useState("");
  const [jellyfinImportState, setJellyfinImportState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [jellyfinImportCount, setJellyfinImportCount] = useState(0);

  useEffect(() => {
    if (profile) {
      setApiKey(profile.debrid_api_key ?? "");
      setDebridType((profile.debrid_type as "alldebrid" | "realdebrid") ?? "alldebrid");
      setQuality(profile.preferred_quality ?? "1080p");
      setLanguage(profile.preferred_language ?? "VF");
      setSelectedServices(profile.streaming_services ?? null);
      setShowPaid(profile.show_paid_options ?? true);
      setPhoneNumber(profile.phone_number ?? "");
      setJellyfinUrl(profile.personal_jellyfin_url ?? "");
      setJellyfinApiKey(profile.personal_jellyfin_api_key ?? "");
      setWebhookToken(profile.webhook_token ?? null);
      if (profile.jellyfin_user_id) setJellyfinAuthState("ok");
    }
  }, [profile]);

  // Helper : un service est-il coché ?
  const isChecked = (id: string) =>
    selectedServices === null || selectedServices.includes(id);

  const allChecked = selectedServices === null;
  const noneChecked = selectedServices !== null && selectedServices.length === 0;
  const partialChecked = !allChecked && !noneChecked;

  const toggleService = (id: string) => {
    setSelectedServices((prev) => {
      // Si null (tout sélectionné) → on retire juste ce service
      const current = prev ?? ALL_SERVICE_IDS;
      if (current.includes(id)) {
        const next = current.filter((s) => s !== id);
        return next.length === 0 ? [] : next;
      } else {
        const next = [...current, id];
        // Si tout est coché, revenir à null (= tous)
        return next.length === ALL_SERVICE_IDS.length ? null : next;
      }
    });
  };

  const checkAll = () => setSelectedServices(null);
  const uncheckAll = () => setSelectedServices([]);

  // Accept +33768117912 or 33768117912 — strip + before storing
  const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    if (value && !PHONE_REGEX.test(value.replace(/\s/g, ""))) {
      setPhoneError("Format invalide — ex: +33768117912");
    } else {
      setPhoneError(null);
    }
  };

  const handleTestJellyfin = async () => {
    if (!jellyfinUrl || !jellyfinApiKey) return;
    setJellyfinTestState("testing");
    setJellyfinTestMsg("");
    setJellyfinSyncStats(null);
    try {
      const res = await fetch("/api/jellyfin/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jellyfinUrl, apiKey: jellyfinApiKey }),
      });
      const data = await res.json() as {
        ok: boolean;
        serverName?: string;
        movieCount?: number;
        tvCount?: number;
        totalSynced?: number;
        syncError?: string;
        error?: string;
      };
      if (data.ok) {
        setJellyfinTestState("ok");
        setJellyfinTestMsg(`Connecté à ${data.serverName ?? "Jellyfin"}`);
        if (data.totalSynced !== undefined) {
          setJellyfinSyncStats({
            serverName: data.serverName ?? "",
            movieCount: data.movieCount ?? 0,
            tvCount: data.tvCount ?? 0,
            totalSynced: data.totalSynced,
          });
        }
        // Rafraîchir le profil (webhook_token + last_library_sync_at) et le contexte
        await refetchProfile();
        await refreshLibrary();
        // Mettre à jour le webhook_token affiché si généré côté serveur
        const profileRes = await fetch("/api/profile");
        const profileData = await profileRes.json() as { profile?: { webhook_token?: string } };
        if (profileData.profile?.webhook_token) {
          setWebhookToken(profileData.profile.webhook_token);
        }
      } else {
        setJellyfinTestState("error");
        setJellyfinTestMsg(data.error ?? "Échec de la connexion");
      }
    } catch {
      setJellyfinTestState("error");
      setJellyfinTestMsg("Impossible de contacter le serveur");
    }
  };

  const triggerJellyfinHistoryImport = async () => {
    setJellyfinImportState("loading");
    try {
      const res = await fetch("/api/import/jellyfin", { method: "POST" });
      const data = await res.json() as { count?: number; error?: string };
      if (res.ok && data.count !== undefined) {
        setJellyfinImportCount(data.count);
        setJellyfinImportState("ok");
      } else {
        setJellyfinImportState("error");
      }
    } catch {
      setJellyfinImportState("error");
    }
  };

  const handleJellyfinLogin = async () => {
    if (!jellyfinUsername || !jellyfinPassword) return;
    setJellyfinAuthState("loading");
    setJellyfinAuthMsg("");
    try {
      const res = await fetch("/api/jellyfin/user/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: jellyfinUsername, password: jellyfinPassword }),
      });
      const data = await res.json() as { ok?: boolean; displayName?: string; error?: string };
      if (data.ok) {
        setJellyfinAuthState("ok");
        setJellyfinPassword("");
        await refetchProfile();
        // Import automatique de l'historique à la première connexion
        void triggerJellyfinHistoryImport();
      } else {
        setJellyfinAuthState("error");
        setJellyfinAuthMsg(data.error ?? "Échec de la connexion");
      }
    } catch {
      setJellyfinAuthState("error");
      setJellyfinAuthMsg("Impossible de contacter le serveur");
    }
  };

  const handleJellyfinLogout = async () => {
    setJellyfinAuthState("idle");
    setJellyfinAuthMsg("");
    setJellyfinUsername("");
    await fetch("/api/jellyfin/user/auth", { method: "DELETE" });
    await refetchProfile();
  };

  const handleSync = async () => {
    setSyncResult(null);
    const result = await syncLibrary();
    setSyncResult(result);
    if (result.synced !== undefined) {
      // Recharger le profil pour mettre à jour last_library_sync_at
      await refreshLibrary();
    }
  };

  const handleCopyWebhook = async () => {
    if (!webhookToken) return;
    const webhookUrl = `${window.location.origin}/api/webhooks/jellyfin?token=${webhookToken}`;
    await navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber && !PHONE_REGEX.test(phoneNumber.replace(/\s/g, ""))) {
      setPhoneError("Format invalide — ex: +33768117912");
      return;
    }
    updateProfile({
      debrid_api_key: apiKey || null,
      debrid_type: apiKey ? debridType : null,
      preferred_quality: quality,
      preferred_language: language,
      streaming_services: selectedServices,
      show_paid_options: showPaid,
      phone_number: phoneNumber || null,
      personal_jellyfin_url: jellyfinUrl || null,
      personal_jellyfin_api_key: jellyfinApiKey || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <Loader2 className="size-8 text-nemo-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#0b0d12] min-h-dvh pt-20">
      <div className="max-w-2xl mx-auto px-6 sm:px-12 py-12">
        <div className="flex items-center gap-3 mb-10">
          <Settings className="size-7 text-nemo-accent" />
          <h1 className="text-3xl font-black text-white">Paramètres</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-8">

          {/* ── Préférences de lecture ── */}
          <section className="glass rounded-2xl p-6 space-y-5">
            <h2 className="text-white font-semibold text-base mb-1">Préférences de lecture</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm mb-2">Qualité préférée</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full glass px-4 py-3 rounded-xl text-white text-sm outline-none border border-white/8 bg-transparent"
                >
                  {["4K", "1080p", "720p", "480p"].map((q) => (
                    <option key={q} value={q} className="bg-[#13161d]">{q}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/70 text-sm mb-2">Langue préférée</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full glass px-4 py-3 rounded-xl text-white text-sm outline-none border border-white/8 bg-transparent"
                >
                  {["VF", "VOSTFR", "MULTI", "VO"].map((l) => (
                    <option key={l} value={l} className="bg-[#13161d]">{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── Mes abonnements streaming ── */}
          <section className="glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Tv2 className="size-5 text-nemo-accent" />
              <h2 className="text-white font-semibold text-base">Mes abonnements streaming</h2>
            </div>
            <p className="text-white/50 text-sm">
              Sélectionnez les services auxquels vous êtes abonné. Seuls ceux-ci
              apparaîtront sur les fiches film et série.
            </p>

            {/* Contrôles tout / rien */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={checkAll}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                  allChecked
                    ? "bg-nemo-accent/15 border-nemo-accent/40 text-nemo-accent"
                    : "glass border-white/15 text-white/50 hover:text-white hover:border-white/30"
                )}
              >
                <Check className="size-3" />
                Tout cocher
              </button>
              <button
                type="button"
                onClick={uncheckAll}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                  noneChecked
                    ? "bg-white/10 border-white/30 text-white"
                    : "glass border-white/15 text-white/50 hover:text-white hover:border-white/30"
                )}
              >
                <Minus className="size-3" />
                Tout décocher
              </button>
              {partialChecked && (
                <span className="text-white/30 text-xs ml-auto">
                  {(selectedServices ?? []).length} / {ALL_SERVICE_IDS.length} sélectionnés
                </span>
              )}
            </div>

            {/* Grille des services */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STREAMING_SERVICES_CATALOG.map((service) => {
                const checked = isChecked(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                      checked
                        ? "border-opacity-50 bg-opacity-15"
                        : "glass border-white/8 text-white/40 hover:border-white/20 hover:text-white/70"
                    )}
                    style={
                      checked
                        ? {
                            borderColor: `${service.color}55`,
                            backgroundColor: `${service.color}12`,
                          }
                        : undefined
                    }
                  >
                    {/* Indicateur couleur */}
                    <span
                      className="shrink-0 size-3 rounded-full border-2 flex items-center justify-center transition-colors"
                      style={
                        checked
                          ? { borderColor: service.color, backgroundColor: service.color }
                          : { borderColor: "rgba(255,255,255,0.2)" }
                      }
                    >
                      {checked && <Check className="size-2 text-white" strokeWidth={3} />}
                    </span>

                    <span
                      className={cn(
                        "text-sm font-medium truncate transition-colors",
                        checked ? "text-white" : "text-white/40"
                      )}
                    >
                      {service.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Affichage des options payantes ── */}
          <section className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-nemo-accent" />
              <h2 className="text-white font-semibold text-base">Options de location et d&apos;achat</h2>
            </div>
            <p className="text-white/50 text-sm">
              Choisissez si vous souhaitez voir les films disponibles à la location ou à l&apos;achat
              en plus de vos abonnements.
            </p>

            <div className="flex flex-col gap-2">
              {[
                {
                  value: true,
                  label: "Tout afficher",
                  desc: "Abonnements + location + achat",
                },
                {
                  value: false,
                  label: "Abonnements uniquement",
                  desc: "Masquer les options payantes à l'unité",
                },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setShowPaid(opt.value)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                    showPaid === opt.value
                      ? "bg-nemo-accent/10 border-nemo-accent/35 text-white"
                      : "glass border-white/8 text-white/50 hover:border-white/20 hover:text-white/70"
                  )}
                >
                  <span
                    className={cn(
                      "size-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                      showPaid === opt.value
                        ? "border-nemo-accent bg-nemo-accent"
                        : "border-white/25"
                    )}
                  >
                    {showPaid === opt.value && (
                      <span className="size-1.5 rounded-full bg-black" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── Mon Jellyfin personnel ── */}
          <section className="glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Server className="size-5 text-[#00A4DC]" />
              <h2 className="text-white font-semibold text-base">Mon Jellyfin</h2>
              {hasPersonalJellyfin && (
                <span className="ml-auto text-xs text-[#00A4DC] font-medium flex items-center gap-1">
                  <Wifi className="size-3" />
                  {count} items en cache
                </span>
              )}
            </div>
            <p className="text-white/50 text-sm">
              Connectez votre serveur Jellyfin personnel pour voir quels films et séries sont
              disponibles dans votre bibliothèque, directement sur les pochettes.
            </p>

            {/* URL du serveur */}
            <div>
              <label className="block text-white/70 text-sm mb-2">URL du serveur</label>
              <input
                type="url"
                value={jellyfinUrl}
                onChange={(e) => { setJellyfinUrl(e.target.value); setJellyfinTestState("idle"); }}
                placeholder="https://jellyfin.maison.fr"
                className="w-full glass px-4 py-3 rounded-xl text-white text-sm outline-none border border-white/8 focus:border-[#00A4DC]/50 bg-transparent placeholder:text-white/20 transition-colors"
              />
            </div>

            {/* Clé API */}
            <div>
              <label className="block text-white/70 text-sm mb-2">
                Clé API
                <span className="text-white/30 font-normal ml-1.5">(Dashboard Admin Jellyfin → Clés API)</span>
              </label>
              <div className="relative">
                <input
                  type={jellyfinApiKeyVisible ? "text" : "password"}
                  value={jellyfinApiKey}
                  onChange={(e) => { setJellyfinApiKey(e.target.value); setJellyfinTestState("idle"); }}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full glass px-4 pr-12 py-3 rounded-xl text-white text-sm outline-none border border-white/8 focus:border-[#00A4DC]/50 bg-transparent placeholder:text-white/20 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setJellyfinApiKeyVisible((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {jellyfinApiKeyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Bouton tester la connexion */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleTestJellyfin}
                disabled={!jellyfinUrl || !jellyfinApiKey || jellyfinTestState === "testing"}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  jellyfinTestState === "ok"
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : jellyfinTestState === "error"
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "glass border-white/15 text-white/70 hover:text-white hover:border-white/30"
                )}
              >
                {jellyfinTestState === "testing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : jellyfinTestState === "ok" ? (
                  <CheckCircle2 className="size-4" />
                ) : jellyfinTestState === "error" ? (
                  <AlertCircle className="size-4" />
                ) : (
                  <Wifi className="size-4" />
                )}
                {jellyfinTestState === "testing" ? "Connexion et sync..." : "Tester et synchroniser"}
              </button>

              {jellyfinTestMsg && (
                <span className={cn(
                  "text-xs",
                  jellyfinTestState === "ok" ? "text-green-400" : "text-red-400"
                )}>
                  {jellyfinTestMsg}
                </span>
              )}
            </div>

            {/* Résultat de la première sync */}
            {jellyfinSyncStats && (
              <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#00A4DC]/8 border border-[#00A4DC]/20 text-sm">
                <Server className="size-4 text-[#00A4DC] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-xs">{jellyfinSyncStats.serverName}</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    <span className="text-white/80">{jellyfinSyncStats.movieCount}</span> films ·{" "}
                    <span className="text-white/80">{jellyfinSyncStats.tvCount}</span> séries synchronisés
                  </p>
                </div>
                <CheckCircle2 className="size-4 text-green-400 shrink-0" />
              </div>
            )}

            {/* Séparateur sync */}
            {hasPersonalJellyfin && (
              <>
                <div className="border-t border-white/8" />

                {/* Stats + bouton sync */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-white/80 text-sm font-medium">
                      {count > 0 ? `${count} items synchronisés` : "Bibliothèque vide"}
                    </p>
                    {profile?.last_library_sync_at && (
                      <p className="text-white/35 text-xs mt-0.5">
                        Dernière sync : {new Date(profile.last_library_sync_at).toLocaleString("fr-FR", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    )}
                    {syncResult?.synced !== undefined && (
                      <p className="text-green-400 text-xs mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        {syncResult.synced} items chargés avec succès
                      </p>
                    )}
                    {syncResult?.error && (
                      <p className="text-red-400 text-xs mt-0.5 flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {syncResult.error}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold glass border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
                    {isSyncing ? "Synchronisation..." : "Synchroniser"}
                  </button>
                </div>

                {/* Webhook */}
                <div className="border-t border-white/8 pt-4 space-y-3">
                  <p className="text-white/60 text-sm font-medium">Webhook automatique</p>
                  <p className="text-white/40 text-xs leading-relaxed">
                    Configurez cette URL dans le plugin{" "}
                    <span className="text-white/60">Jellyfin Webhook</span> pour synchroniser
                    automatiquement votre bibliothèque chaque fois qu&apos;un film est ajouté.
                  </p>
                  {webhookToken ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-black/30 border border-white/8 rounded-xl px-3 py-2 text-xs text-white/50 font-mono truncate">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/api/webhooks/jellyfin?token=${webhookToken}`
                          : `/api/webhooks/jellyfin?token=${webhookToken}`}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyWebhook}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold glass border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all"
                      >
                        <Copy className="size-3.5" />
                        {webhookCopied ? "Copié !" : "Copier"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-white/30 text-xs">
                      Sauvegardez d&apos;abord votre configuration Jellyfin pour obtenir l&apos;URL webhook.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Indicateur si pas encore configuré */}
            {!hasPersonalJellyfin && !jellyfinUrl && (
              <div className="flex items-center gap-2 text-white/30 text-xs">
                <WifiOff className="size-3.5" />
                Aucun Jellyfin configuré — les badges de disponibilité ne s&apos;afficheront pas
              </div>
            )}
          </section>

          {/* ── Compte utilisateur Jellyfin ── */}
          {hasPersonalJellyfin && (
            <section className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <User className="size-5 text-[#00A4DC]" />
                <h2 className="text-white font-semibold text-base">Compte Jellyfin</h2>
                {jellyfinAuthState === "ok" && profile?.jellyfin_display_name && (
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <CheckCircle2 className="size-3" />
                    {profile.jellyfin_display_name}
                  </span>
                )}
              </div>
              <p className="text-white/50 text-sm">
                Connectez-vous avec votre compte utilisateur Jellyfin pour accéder à votre
                historique, vos reprises et lire vos films directement sur NEMO.
              </p>

              {jellyfinAuthState === "ok" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/8 border border-green-500/20">
                    <User className="size-4 text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">
                        {profile?.jellyfin_display_name ?? "Connecté"}
                      </p>
                      <p className="text-white/40 text-xs mt-0.5">Session active</p>
                    </div>
                    <CheckCircle2 className="size-4 text-green-400 shrink-0" />
                  </div>

                  {/* Bouton synchronisation historique */}
                  <button
                    type="button"
                    onClick={() => void triggerJellyfinHistoryImport()}
                    disabled={jellyfinImportState === "loading"}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all text-sm",
                      jellyfinImportState === "ok"
                        ? "bg-green-500/8 border-green-500/20 text-green-400"
                        : jellyfinImportState === "error"
                        ? "bg-red-500/8 border-red-500/20 text-red-400"
                        : "glass border-white/10 text-white/70 hover:text-white hover:border-white/25",
                      jellyfinImportState === "loading" && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {jellyfinImportState === "loading" ? (
                      <Loader2 className="size-4 animate-spin shrink-0" />
                    ) : jellyfinImportState === "ok" ? (
                      <CheckCircle2 className="size-4 shrink-0" />
                    ) : jellyfinImportState === "error" ? (
                      <AlertCircle className="size-4 shrink-0" />
                    ) : (
                      <RefreshCw className="size-4 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {jellyfinImportState === "loading"
                          ? "Synchronisation en cours…"
                          : jellyfinImportState === "ok"
                          ? `${jellyfinImportCount} films/séries importés`
                          : jellyfinImportState === "error"
                          ? "Erreur lors de l'import"
                          : "Synchroniser l'historique"}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Importe vos films vus depuis Jellyfin dans NEMO
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3 flex-wrap">
                    <a
                      href="/hub/jellyfin"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#00A4DC]/15 border border-[#00A4DC]/30 text-[#00A4DC] hover:bg-[#00A4DC]/22 transition-all"
                    >
                      <Play className="size-4" />
                      Ma bibliothèque Jellyfin
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleJellyfinLogout()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold glass border border-white/15 text-white/50 hover:text-red-400 hover:border-red-500/30 transition-all"
                    >
                      <LogOut className="size-4" />
                      Déconnecter
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-white/70 text-sm mb-2">Nom d&apos;utilisateur</label>
                    <input
                      type="text"
                      value={jellyfinUsername}
                      onChange={(e) => { setJellyfinUsername(e.target.value); setJellyfinAuthState("idle"); }}
                      placeholder="Votre pseudo Jellyfin"
                      autoComplete="username"
                      className="w-full glass px-4 py-3 rounded-xl text-white text-sm outline-none border border-white/8 focus:border-[#00A4DC]/50 bg-transparent placeholder:text-white/20 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm mb-2">Mot de passe</label>
                    <div className="relative">
                      <input
                        type={jellyfinPasswordVisible ? "text" : "password"}
                        value={jellyfinPassword}
                        onChange={(e) => { setJellyfinPassword(e.target.value); setJellyfinAuthState("idle"); }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full glass px-4 pr-12 py-3 rounded-xl text-white text-sm outline-none border border-white/8 focus:border-[#00A4DC]/50 bg-transparent placeholder:text-white/20 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setJellyfinPasswordVisible((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {jellyfinPasswordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => void handleJellyfinLogin()}
                      disabled={!jellyfinUsername || !jellyfinPassword || jellyfinAuthState === "loading"}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                        jellyfinAuthState === "error"
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-[#00A4DC]/15 border-[#00A4DC]/30 text-[#00A4DC] hover:bg-[#00A4DC]/22"
                      )}
                    >
                      {jellyfinAuthState === "loading" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : jellyfinAuthState === "error" ? (
                        <AlertCircle className="size-4" />
                      ) : (
                        <User className="size-4" />
                      )}
                      {jellyfinAuthState === "loading" ? "Connexion…" : "Se connecter"}
                    </button>
                    {jellyfinAuthMsg && (
                      <span className="text-xs text-red-400">{jellyfinAuthMsg}</span>
                    )}
                  </div>
                  <p className="text-white/30 text-xs">
                    Votre mot de passe n&apos;est jamais stocké — seul le token de session est conservé.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ── Notifications ── */}
          <section className="glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Bell className="size-5 text-nemo-accent" />
              <h2 className="text-white font-semibold text-base">Notifications</h2>
            </div>
            <p className="text-white/50 text-sm">
              Recevez un SMS lorsqu&apos;un téléchargement est prêt ou qu&apos;un film attendu sort.
            </p>

            <div>
              <label className="block text-white/70 text-sm mb-2">
                Numéro de téléphone
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30 pointer-events-none" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+33612345678"
                  className={cn(
                    "w-full glass pl-10 pr-4 py-3 rounded-xl text-white text-sm outline-none border transition-colors bg-transparent placeholder:text-white/20",
                    phoneError
                      ? "border-red-500/60 focus:border-red-500"
                      : "border-white/8 focus:border-nemo-accent/50"
                  )}
                />
              </div>
              {phoneError && (
                <p className="text-red-400 text-xs mt-1.5">{phoneError}</p>
              )}
              {!phoneError && phoneNumber && PHONE_REGEX.test(phoneNumber.replace(/\s/g, "")) && (
                <p className="text-green-400 text-xs mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  Numéro valide
                </p>
              )}
              <p className="text-white/30 text-xs mt-2">
                Indicatif pays + numéro, le + est optionnel (ex : +33768117912 ou 33768117912).
              </p>
            </div>
          </section>

          {/* ── Submit ── */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 bg-nemo-accent hover:bg-[#f0c85a] text-black font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {isPending ? <Loader2 className="size-5 animate-spin" /> : null}
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </button>

            {isSuccess && (
              <span className="flex items-center gap-1.5 text-green-400 text-sm">
                <CheckCircle2 className="size-4" />
                Paramètres sauvegardés
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
