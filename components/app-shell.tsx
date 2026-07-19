"use client";

import { useEffect, useState } from "react";
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
  Inbox,
  LayoutGrid,
  LogOut,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  CalendarCheck,
  Users,
  Wallet,
  Handshake,
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { SheetProvider, useSheets } from "@/components/sheets/sheet-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  const draftCount = useAppStore((state) => state.data.inbox.drafts.length);
  const sheets = useSheets();

  return (
    <header
      className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl"
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
                <Link href="/inbox">
                  <Inbox aria-hidden />
                  Inbox
                  {draftCount > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                      {draftCount}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
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
                  <CalendarCheck aria-hidden />
                  Monthly Review
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/lend-borrow">
                  <Handshake aria-hidden />
                  Lend & Borrow
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
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings aria-hidden />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => signOut()}
                className="text-destructive data-[highlighted]:text-destructive [&_svg]:text-destructive"
              >
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

function useCondenseOnScroll() {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const delta = y - lastY;
        if (Math.abs(delta) > 6) {
          setCondensed(delta > 0 && y > 64 && y < max - 16);
          lastY = y;
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return condensed;
}

function TabBar() {
  const pathname = usePathname();
  const sheets = useSheets();
  const condensed = useCondenseOnScroll();
  const [first, second, third, fourth] = TABS;

  const renderTab = ({ href, label, icon: Icon }: (typeof TABS)[number]) => {
    const active =
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-full flex-1 items-center justify-center rounded-2xl outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon
          aria-hidden
          className="size-6 transition-transform duration-200 ease-spring group-active:scale-90"
        />
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 px-4"
      style={{
        paddingBottom: "max(0.75rem, calc(env(safe-area-inset-bottom) + 0.25rem))",
      }}
    >
      <div
        className={cn(
          "mx-auto flex h-14 w-full max-w-md origin-bottom items-stretch gap-1 rounded-3xl border border-border bg-popover/80 px-2 shadow-float backdrop-blur-xl transition-transform duration-300 ease-spring",
          condensed && "scale-[0.82]",
        )}
      >
        {renderTab(first)}
        {renderTab(second)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Add"
            onClick={() => sheets.openActions()}
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft outline-none transition-transform duration-200 ease-spring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90"
          >
            <Plus aria-hidden className="size-5.5" />
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
