"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CircleUserRound,
  CloudAlert,
  FileText,
  House,
  LayoutGrid,
  LogOut,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { SheetProvider, useSheets } from "@/components/sheets/sheet-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/expenses", label: "Expenses", icon: ReceiptText },
] as const;

function Header({ title }: { title: string }) {
  const session = useAppStore((state) => state.session);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const signOut = useAppStore((state) => state.signOut);
  const sheets = useSheets();

  return (
    <header
      className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-5">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          {syncStatus === "saving" && (
            <span
              role="status"
              aria-label="Saving"
              className="mr-1 size-2 animate-pulse rounded-full bg-muted-foreground"
            />
          )}
          {syncStatus === "error" && (
            <span role="status" aria-label="Sync failed" className="mr-1">
              <CloudAlert aria-hidden className="size-4.5 text-destructive" />
            </span>
          )}
          <button
            type="button"
            aria-label="Search"
            onClick={() => sheets.openSearch()}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search aria-hidden className="size-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {session?.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.avatarUrl}
                  alt=""
                  className="size-8 rounded-full border border-border"
                />
              ) : (
                <CircleUserRound
                  aria-hidden
                  className="size-7 text-muted-foreground"
                />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/spaces">
                  <LayoutGrid aria-hidden />
                  Spaces
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/accounts">
                  <Wallet aria-hidden />
                  Accounts
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/subscriptions">
                  <RefreshCw aria-hidden />
                  Subscriptions
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/reviews">
                  <Sparkles aria-hidden />
                  Monthly Review
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/groups">
                  <Users aria-hidden />
                  Groups
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/recurring">
                  <CalendarClock aria-hidden />
                  Recurring
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/reports">
                  <FileText aria-hidden />
                  Reports
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings aria-hidden />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => signOut()}>
                <LogOut aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function TabBar() {
  const pathname = usePathname();
  const sheets = useSheets();
  const [first, second, third, fourth] = TABS;

  const renderTab = ({ href, label, icon: Icon }: (typeof TABS)[number]) => {
    const active =
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon aria-hidden className="size-5.5" />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur"
    >
      <div className="mx-auto flex h-16 w-full max-w-lg items-stretch px-3 pb-[env(safe-area-inset-bottom)]">
        {renderTab(first)}
        {renderTab(second)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Add"
            onClick={() => sheets.openActions()}
            className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
          >
            <Plus aria-hidden className="size-6" />
          </button>
        </div>
        {renderTab(third)}
        {renderTab(fourth)}
      </div>
    </nav>
  );
}

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <SheetProvider>
        <Header title={title} />
        <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-28 pt-6">
          {children}
        </main>
        <TabBar />
      </SheetProvider>
    </AuthGate>
  );
}
