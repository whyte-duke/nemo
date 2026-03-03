import { Navbar } from "@/components/navigation/Navbar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#080a0f] relative">
      {/* Gradient blobs — couleurs qui "saignent" à travers les panneaux glass */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        {/* Blob ambre/or en haut gauche */}
        <div
          className="absolute rounded-full"
          style={{
            top: "-15%",
            left: "-10%",
            width: "55%",
            height: "55%",
            background: "radial-gradient(ellipse, rgba(232,184,75,0.10) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        {/* Blob indigo en haut droite */}
        <div
          className="absolute rounded-full"
          style={{
            top: "5%",
            right: "-15%",
            width: "50%",
            height: "50%",
            background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)",
            filter: "blur(100px)",
          }}
        />
        {/* Blob violet en bas centre */}
        <div
          className="absolute rounded-full"
          style={{
            bottom: "10%",
            left: "25%",
            width: "45%",
            height: "45%",
            background: "radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
        {/* Blob bleu en bas gauche */}
        <div
          className="absolute rounded-full"
          style={{
            bottom: "-5%",
            left: "-5%",
            width: "35%",
            height: "35%",
            background: "radial-gradient(ellipse, rgba(59,130,246,0.05) 0%, transparent 70%)",
            filter: "blur(70px)",
          }}
        />
      </div>

      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <main>{children}</main>
      </div>
    </div>
  );
}
