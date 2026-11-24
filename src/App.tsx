import { useCallback, useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { RouteView, ToolItem } from './types/tools';
import { HomePage } from './pages/HomePage';
import { PdfToolsPage } from './pages/PdfToolsPage';
import { PdfToolWorkspace } from './pages/PdfToolWorkspace';
import { ImageToolsPage } from './pages/ImageToolsPage';
import { PhotoSignaturePage } from './pages/PhotoSignaturePage';
import { PassportPhotoPage } from './pages/PassportPhotoPage';
import { DocumentMakerPage } from './pages/DocumentMakerPage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { ContactPage } from './pages/ContactPage';
import { CardCropHubPage } from './pages/CardCropHubPage';
import { CardCropPage } from './pages/CardCropPage';
import { CARD_TYPES_CONFIG, CardTypeId } from './config/cardTypesConfig';
import {
  clearFavoriteTools,
  clearRecentTools,
  getFavoriteToolIds,
  getRecentToolIds,
  recordRecentToolId,
  toggleFavoriteToolId,
} from './utils/toolStorage';

function routeToHash(route: RouteView): string {
  switch (route.page) {
    case 'home':
      return route.anchor ? `#${route.anchor}` : '#home';
    case 'pdf':
      return '#pdf';
    case 'pdf-tool':
      return `#pdf/${route.toolId}`;
    case 'card-crop': {
      if (!route.cardTypeId) return '#card-crop';
      const found = CARD_TYPES_CONFIG.find((c) => c.id === route.cardTypeId);
      return found ? `#${found.hashSlug}` : '#card-crop';
    }
    case 'image-tools':
      return route.mode ? `#image-tools/${route.mode}` : '#image-tools';
    case 'photo-signature':
      return '#photo-signature';
    case 'passport-photo':
      return '#passport-photo';
    case 'doc-maker':
      return `#doc/${route.docType}`;
    case 'blog':
      return '#blog';
    case 'blog-post':
      return `#blog/${route.postId}`;
    case 'contact':
      return '#contact';
  }
}

function hashToRoute(hash: string): RouteView {
  const clean = hash.replace(/^#/, '').trim();
  if (!clean || clean === 'home') return { page: 'home' };
  if (clean === 'premium' || clean === 'free') return { page: 'home', anchor: clean };
  if (clean === 'pdf') return { page: 'pdf' };
  if (clean.startsWith('pdf/')) {
    return { page: 'pdf-tool', toolId: clean.slice(4) || 'split-pdf' };
  }
  if (clean === 'card-crop') return { page: 'card-crop' };
  const matchedCardType = CARD_TYPES_CONFIG.find((c) => c.hashSlug === clean);
  if (matchedCardType) return { page: 'card-crop', cardTypeId: matchedCardType.id };
  if (clean === 'image-tools') return { page: 'image-tools', mode: 'resize' };
  if (clean.startsWith('image-tools/')) {
    return {
      page: 'image-tools',
      mode: (clean.slice('image-tools/'.length) || 'resize') as NonNullable<
        Extract<RouteView, { page: 'image-tools' }>['mode']
      >,
    };
  }
  if (clean === 'photo-signature') return { page: 'photo-signature' };
  if (clean === 'passport-photo') return { page: 'passport-photo' };
  if (clean.startsWith('doc/')) {
    return {
      page: 'doc-maker',
      docType: (clean.slice(4) || 'invoice') as Extract<
        RouteView,
        { page: 'doc-maker' }
      >['docType'],
    };
  }
  if (clean === 'blog') return { page: 'blog' };
  if (clean.startsWith('blog/')) {
    return { page: 'blog-post', postId: clean.slice(5) };
  }
  if (clean === 'contact') return { page: 'contact' };
  return { page: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<RouteView>(() => hashToRoute(window.location.hash));
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentToolIds());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteToolIds());

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kaajer-theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {
      // ignore
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('kaajer-theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    const onHashChange = () => {
      const next = hashToRoute(window.location.hash);
      setRoute(next);
      if (next.page === 'home' && next.anchor) {
        setTimeout(() => {
          document.getElementById(next.anchor!)?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((nextRoute: RouteView) => {
    const nextHash = routeToHash(nextRoute);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setRoute(nextRoute);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const handleSelectTool = useCallback(
    (tool: ToolItem) => {
      setRecentIds(recordRecentToolId(tool.id));
      navigate(tool.route);
    },
    [navigate]
  );

  const handleToggleFavorite = useCallback((toolId: string) => {
    setFavoriteIds(toggleFavoriteToolId(toolId));
  }, []);

  return (
    <Layout
      currentRoute={route}
      onNavigate={navigate}
      isDark={isDark}
      onToggleTheme={() => setIsDark((d) => !d)}
    >
      {route.page === 'home' && (
        <HomePage
          onNavigate={navigate}
          onSelectTool={handleSelectTool}
          recentIds={recentIds}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          onClearRecent={() => setRecentIds(clearRecentTools())}
          onClearFavorites={() => setFavoriteIds(clearFavoriteTools())}
        />
      )}

      {route.page === 'pdf' && (
        <PdfToolsPage
          onSelectTool={handleSelectTool}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {route.page === 'pdf-tool' && (
        <PdfToolWorkspace
          toolId={route.toolId}
          onBack={() => navigate({ page: 'pdf' })}
        />
      )}

      {route.page === 'card-crop' && !route.cardTypeId && (
        <CardCropHubPage
          onSelectCardType={(ct) =>
            navigate({ page: 'card-crop', cardTypeId: ct.id })
          }
        />
      )}

      {route.page === 'card-crop' && route.cardTypeId && (
        <CardCropPage
          cardTypeId={route.cardTypeId as CardTypeId}
          onBackToHub={() => navigate({ page: 'card-crop' })}
          onSelectCardType={(ct) =>
            navigate({ page: 'card-crop', cardTypeId: ct.id })
          }
        />
      )}

      {route.page === 'image-tools' && (
        <ImageToolsPage
          initialMode={route.mode}
          onBack={() => navigate({ page: 'home' })}
        />
      )}

      {route.page === 'photo-signature' && (
        <PhotoSignaturePage onBack={() => navigate({ page: 'home' })} />
      )}

      {route.page === 'passport-photo' && (
        <PassportPhotoPage onBack={() => navigate({ page: 'home' })} />
      )}

      {route.page === 'doc-maker' && (
        <DocumentMakerPage
          docType={route.docType}
          onBack={() => navigate({ page: 'home' })}
          onSwitchDocType={(docType) => navigate({ page: 'doc-maker', docType })}
        />
      )}

      {route.page === 'blog' && (
        <BlogPage onSelectPost={(postId) => navigate({ page: 'blog-post', postId })} />
      )}

      {route.page === 'blog-post' && (
        <BlogPostPage
          postId={route.postId}
          onBack={() => navigate({ page: 'blog' })}
          onSelectPost={(postId) => navigate({ page: 'blog-post', postId })}
        />
      )}

      {route.page === 'contact' && <ContactPage />}
    </Layout>
  );
}
