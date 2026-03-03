export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0b0d12] flex items-center justify-center px-4">
      {/* Fond décoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -left-48 size-96 rounded-full bg-[#e8b84b]/5 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 size-96 rounded-full bg-[#e8b84b]/5 blur-3xl" />
      </div>
      {children}
    </div>
  );
}
