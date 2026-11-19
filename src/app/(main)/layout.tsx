import { BottomNav } from "@/components/nav/BottomNav";
import { SideNav } from "@/components/nav/SideNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <main className="pt-safe mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pb-32 sm:px-6 lg:px-10 lg:pb-12">
        <div className="pt-4 lg:pt-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
