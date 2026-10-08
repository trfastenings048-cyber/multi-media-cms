import BrandLogo from "@/components/BrandLogo"
import BrandPanel from "./BrandPanel"

type AuthLayoutProps = {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

// Split layout shared by auth pages: navy brand panel on the left, glass form card on the right.
// Uses the same white → sea blue → dark blue gradient as the rest of the app.
export default function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative grid min-h-dvh bg-[linear-gradient(to_top,#0a1f5c_0%,#1d4ed8_22%,#5cc8e0_52%,#d6f4fa_78%,#ffffff_100%)] lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex items-center justify-center px-3 py-6 sm:px-8 sm:py-10 pb-safe">
        <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/85 p-5 shadow-2xl shadow-blue-950/20 backdrop-blur-xl min-[400px]:p-8 sm:p-10">
          <BrandLogo className="mb-8 lg:hidden [&_p]:text-zinc-950!" />

          <div className="mb-8 space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#012d74]">
              <span className="size-1.5 rounded-full bg-sky-500" />
              Secure sign in
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0a1f5c]">{title}</h1>
            {description ? <p className="text-sm text-slate-500">{description}</p> : null}
          </div>

          {children}

          {footer ? (
            <div className="mt-8 border-t border-slate-200/80 pt-6 text-center text-sm text-slate-500">{footer}</div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
