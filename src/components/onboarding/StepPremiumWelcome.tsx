"use client";

import { motion } from "motion/react";
import { ArrowRight, Clapperboard, Server, Users, Zap } from "lucide-react";
import type { UserRole } from "@/hooks/use-profile";

interface StepPremiumWelcomeProps {
  role: UserRole;
  onNext: () => void;
}

const VIP_CONFIG = {
  badge: "ACCÈS VIP",
  badgeClass: "bg-nemo-accent/20 text-nemo-accent border-nemo-accent/30",
  hero: "⭐",
  title: "Accès VIP exclusif",
  subtitle: "Tu as été invité par un admin Nemo — bienvenue !",
  features: [
    {
      icon: Clapperboard,
      title: "Tous les films du monde",
      desc: "Streaming direct, sans abonnement supplémentaire",
      color: "text-nemo-accent",
      bg: "bg-nemo-accent/10",
    },
    {
      icon: Server,
      title: "Jellyfin inclus",
      desc: "Ton serveur est déjà configuré, prêt à l'emploi",
      color: "text-nemo-accent",
      bg: "bg-nemo-accent/10",
    },
    {
      icon: Users,
      title: "Partage avec tes amis",
      desc: "Invite qui tu veux, c'est gratuit pour eux",
      color: "text-nemo-accent",
      bg: "bg-nemo-accent/10",
    },
  ],
};

const SOURCES_CONFIG = {
  badge: "ACCÈS AMIS",
  badgeClass: "bg-nemo-accent/20 text-nemo-accent border-nemo-accent/30",
  hero: "🎬",
  title: "Accès Amis exclusif",
  subtitle: "Tu as été invité par un ami Nemo — bienvenue !",
  features: [
    {
      icon: Clapperboard,
      title: "Tous les films du monde",
      desc: "Streaming direct, sans abonnement supplémentaire",
      color: "text-nemo-accent",
      bg: "bg-nemo-accent/10",
    },
    {
      icon: Zap,
      title: "Streaming 4K",
      desc: "Films en haute définition, direct depuis nos serveurs",
      color: "text-nemo-accent",
      bg: "bg-nemo-accent/10",
    },
    {
      icon: Users,
      title: "Partage avec tes amis",
      desc: "Invite qui tu veux, c'est gratuit pour eux",
      color: "text-nemo-accent",
      bg: "bg-nemo-accent/10",
    },
  ],
};

export default function StepPremiumWelcome({ role, onNext }: StepPremiumWelcomeProps) {
  const cfg = role === "vip" || role === "admin" ? VIP_CONFIG : SOURCES_CONFIG;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      {/* Hero */}
      <div className="flex flex-col items-center pt-2 pb-1 gap-3">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl select-none"
        >
          {cfg.hero}
        </motion.div>

        <span className={`px-3 py-1 rounded-full text-xs font-black tracking-widest border ${cfg.badgeClass}`}>
          {cfg.badge}
        </span>
      </div>

      {/* Titre + sous-titre */}
      <div className="text-center space-y-1.5">
        <h1 className="text-white font-black text-2xl sm:text-3xl leading-tight">
          {cfg.title}
        </h1>
        <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
          {cfg.subtitle}
        </p>
      </div>

      {/* Feature cards */}
      <div className="space-y-2.5">
        {cfg.features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.08 }}
              className="glass-tile flex items-center gap-4 p-3.5 rounded-2xl"
            >
              <div className={`shrink-0 size-10 rounded-xl flex items-center justify-center ${f.bg}`}>
                <Icon className={`size-4.5 ${f.color}`} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{f.title}</p>
                <p className="text-white/45 text-xs mt-0.5">{f.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-nemo-accent hover:bg-[#f0c85a] active:scale-95 text-black font-semibold py-4 rounded-2xl transition-all text-base"
      >
        La suite
        <ArrowRight className="size-5" />
      </motion.button>
    </motion.div>
  );
}
