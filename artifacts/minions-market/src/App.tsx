import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { LangProvider } from "@/lib/i18n";
import { Layout } from "@/components/layout";
import { RadioProvider } from "@/lib/radio";
import { lazy, Suspense } from "react";
import NotFound from "@/pages/not-found";

const Home = lazy(() => import("@/pages/home"));
const Auth = lazy(() => import("@/pages/auth"));
const Catalog = lazy(() => import("@/pages/catalog"));
const GamePage = lazy(() => import("@/pages/game"));
const ProductPage = lazy(() => import("@/pages/product"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const SellPage = lazy(() => import("@/pages/sell"));
const DealsPage = lazy(() => import("@/pages/deals"));
const DealDetailPage = lazy(() => import("@/pages/deal-detail"));
const WalletPage = lazy(() => import("@/pages/wallet"));
const MessagesPage = lazy(() => import("@/pages/messages"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const FavoritesPage = lazy(() => import("@/pages/favorites"));
const AdminPage = lazy(() => import("@/pages/admin"));
const RadioPage = lazy(() => import("@/pages/radio"));
const GamesListPage = lazy(() => import("@/pages/games-list"));
const LegalPage = lazy(() => import("@/pages/legal"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/auth" component={Auth} />
          <Route path="/catalog" component={Catalog} />
          <Route path="/game/:slug" component={GamePage} />
          <Route path="/games-list/:tab" component={GamesListPage} />
          <Route path="/product/:id" component={ProductPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/profile/:id" component={ProfilePage} />
          <Route path="/sell" component={SellPage} />
          <Route path="/sell/:id" component={SellPage} />
          <Route path="/deals" component={DealsPage} />
          <Route path="/deal/:id" component={DealDetailPage} />
          <Route path="/wallet" component={WalletPage} />
          <Route path="/messages" component={MessagesPage} />
          <Route path="/messages/:userId" component={MessagesPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/favorites" component={FavoritesPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/radio" component={RadioPage} />
          <Route path="/legal" component={LegalPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <AuthProvider>
          <RadioProvider>
            <TooltipProvider>
              <WouterRouter base="">
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </RadioProvider>
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}

export default App;
