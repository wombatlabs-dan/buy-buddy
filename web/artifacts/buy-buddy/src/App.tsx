import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Haystack from '@/pages/haystack';
import ListingPage from '@/pages/listing';
import ChallengePage from '@/pages/challenge';
import DecisionPage from '@/pages/decision';
import RecordPage from '@/pages/record';
import { HowPage, PricingPage } from '@/pages/info';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/"><Home /></Route>
        <Route path="/start"><Home focusStart /></Route>
        <Route path="/hunt" component={Haystack} />
        <Route path="/listing/:id" component={ListingPage} />
        <Route path="/listing/:id/challenge" component={ChallengePage} />
        <Route path="/listing/:id/decision" component={DecisionPage} />
        <Route path="/record" component={RecordPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/how-it-works" component={HowPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
