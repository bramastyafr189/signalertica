"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, useRef, type MouseEvent } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Bell,
  BellOff,
  Settings,
  Sun,
  Moon,
  Plus,
  X,
  Check,
  Clock,
  Trash2,
  ChevronRight,
  Hash,
  Search,
  Globe,
  Zap,
  LayoutGrid,
  RefreshCcw,
  Volume2,
  Home as HomeIcon,
  ChevronDown,
  Radio,
  Satellite,
  Terminal,
  Activity,
  Cpu,
  Radar,
  Rocket,
  Shield,
  Target,
  Wifi,
  Edit2,
  MoreVertical,
  Download,
  User
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchNews, NewsArticle } from "@/lib/news";

interface AppNotification {
  id: string;
  title: string;
  body: string;
  channel: string;
  timestamp: string;
  articles?: NewsArticle[];
}

type ActiveTab = 'home' | 'explore' | 'account' | 'monitor';
type PushNotificationOptions = NotificationOptions & {
  badge?: string;
  renotify?: boolean;
  vibrate?: number[];
};
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
type NotificationDiagnostics = {
  supported: boolean;
  serviceWorkerSupported: boolean;
  pushSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  serviceWorkerReady: boolean;
  pushSubscribed: boolean;
};

const isActiveTab = (value: string | null): value is ActiveTab => {
  return value === 'home' || value === 'explore' || value === 'account' || value === 'monitor';
};

const isIosDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

async function getServiceWorkerReady(timeoutMs = 8000) {
  if (!("serviceWorker" in navigator)) {
    throw new Error('Service workers are not supported by this browser');
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration('/');
  if (!existingRegistration) {
    await navigator.serviceWorker.register('/sw.js');
  }

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Service worker was not ready in time')), timeoutMs);
    }),
  ]);
}

// Helper for professional time formatting
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  // Format to local HH:MM
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffInHours < 1) {
    const mins = Math.max(1, Math.floor(diffInHours * 60));
    return `${mins}M AGO • ${timeStr}`;
  }

  if (date.toDateString() === now.toDateString()) {
    return `TODAY • ${timeStr}`;
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `YESTERDAY • ${timeStr}`;
  }

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()} • ${timeStr}`;
};

const triggerNotification = async (title: string, body: string) => {
  if (!("Notification" in window)) {
    throw new Error("Notifications are not supported by this browser");
  }

  if (Notification.permission !== "granted") {
    throw new Error("Notification permission is not granted");
  }

  const options: PushNotificationOptions = {
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    tag: 'intelligence-report',
    renotify: true
  };

  try {
    const registration = await getServiceWorkerReady();
    await registration.showNotification(title, options);
  } catch (e) {
    console.error("SW notification failed, falling back", e);
    new Notification(title, { body, icon: '/icon-192x192.png' });
  }
};

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  // Format to local HH:MM
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffInMins < 60) {
    return `${Math.max(1, diffInMins)}M AGO • ${timeStr}`;
  }
  if (diffInHours < 24) {
    return `${diffInHours}H AGO • ${timeStr}`;
  }
  return `${diffInDays}D AGO • ${timeStr}`;
};

interface InterestGroup {
  id: number;
  name: string;
  language?: string | null;
  country?: string | null;
  refreshInterval: number; // minutes
  notificationsEnabled: boolean;
  lastScanAt?: string | null;
  keywords: { id: number; word: string }[];
}

const CHANNEL_ICONS = [Hash, Globe, Activity, Cpu, Radar, Shield, Rocket, Target, Wifi, Radio, Satellite, Terminal];

const getChannelIcon = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHANNEL_ICONS[Math.abs(hash) % CHANNEL_ICONS.length];
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const LANGUAGES = [
  { code: 'any', name: 'Global (All)', flag: '🌐' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
];

const INTERVAL_OPTIONS = [
  { value: 0, label: 'Manual' },
  { value: 15, label: '15 Min' },
  { value: 30, label: '30 Min' },
  { value: 60, label: '1 Hour' },
  { value: 360, label: '6 Hours' },
  { value: 720, label: '12 Hours' },
];

const DEMO_GROUPS: InterestGroup[] = [
  {
    id: -1,
    name: 'Bitcoin & Crypto',
    language: 'en',
    country: null,
    refreshInterval: 15,
    notificationsEnabled: true,
    lastScanAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    keywords: [
      { id: 1, word: 'Bitcoin ETF' },
      { id: 2, word: 'Ethereum' },
      { id: 3, word: 'Crypto regulation' },
      { id: 4, word: 'Binance' },
    ],
  },
  {
    id: -2,
    name: 'Global Politics',
    language: 'en',
    country: null,
    refreshInterval: 30,
    notificationsEnabled: true,
    lastScanAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    keywords: [
      { id: 5, word: 'US election' },
      { id: 6, word: 'China policy' },
      { id: 7, word: 'European Union' },
      { id: 8, word: 'United Nations' },
    ],
  },
  {
    id: -3,
    name: 'War Watch',
    language: 'en',
    country: null,
    refreshInterval: 15,
    notificationsEnabled: true,
    lastScanAt: new Date(Date.now() - 36 * 60 * 1000).toISOString(),
    keywords: [
      { id: 9, word: 'Ukraine war' },
      { id: 10, word: 'Middle East conflict' },
      { id: 11, word: 'Ceasefire' },
      { id: 12, word: 'NATO' },
    ],
  },
  {
    id: -4,
    name: 'AI Frontier',
    language: 'en',
    country: null,
    refreshInterval: 60,
    notificationsEnabled: true,
    lastScanAt: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
    keywords: [
      { id: 13, word: 'OpenAI' },
      { id: 14, word: 'AI regulation' },
      { id: 15, word: 'Nvidia' },
      { id: 16, word: 'Artificial intelligence' },
    ],
  },
  {
    id: -5,
    name: 'Market Pulse',
    language: 'en',
    country: null,
    refreshInterval: 30,
    notificationsEnabled: true,
    lastScanAt: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
    keywords: [
      { id: 17, word: 'Federal Reserve' },
      { id: 18, word: 'Inflation' },
      { id: 19, word: 'Oil prices' },
      { id: 20, word: 'Stock market' },
    ],
  },
];

const DEMO_NEWS: NewsArticle[] = [
  {
    id: 'demo-1',
    title: 'Demo signal: Bitcoin ETF flows drive renewed market attention',
    description: 'Signalertica groups matching stories by keyword, source, and publish time so important movement is easier to scan.',
    url: '#demo',
    image: null,
    source: 'Demo Wire',
    publishedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-2',
    title: 'Demo signal: global policy and conflict updates detected across sources',
    description: 'Create private channels for crypto, politics, war, AI, or markets, then let the pipeline collect new signals on schedule.',
    url: '#demo',
    image: null,
    source: 'Signal Desk',
    publishedAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
  },
];

const makeDemoArticle = (id: string, title: string, source: string, minutesAgo: number): NewsArticle => ({
  id,
  title,
  description: 'Demo item showing how Signalertica summarizes matching signals by channel, keyword, source, and publish time.',
  url: '#demo',
  image: null,
  source,
  publishedAt: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
});

const DEMO_ARTICLES_BY_CHANNEL: Record<string, NewsArticle[]> = {
  'Bitcoin & Crypto': [
    makeDemoArticle('demo-crypto-1', 'Bitcoin ETF flows show renewed institutional demand', 'Crypto Desk', 11),
    makeDemoArticle('demo-crypto-2', 'Ethereum developers outline next scaling milestone', 'Chain Monitor', 24),
    makeDemoArticle('demo-crypto-3', 'Crypto regulation debate intensifies across major markets', 'Policy Wire', 37),
    makeDemoArticle('demo-crypto-4', 'Stablecoin liquidity rises as traders reposition risk', 'Market Signal', 49),
    makeDemoArticle('demo-crypto-5', 'Exchange reserves shift after weekend volatility', 'Onchain Brief', 64),
  ],
  'Global Politics': [
    makeDemoArticle('demo-politics-1', 'Election polling narratives shift after latest policy remarks', 'Global Brief', 15),
    makeDemoArticle('demo-politics-2', 'China policy discussions draw attention from trade analysts', 'Diplomacy Watch', 31),
    makeDemoArticle('demo-politics-3', 'European Union leaders weigh new economic coordination plan', 'Policy Wire', 52),
    makeDemoArticle('demo-politics-4', 'United Nations agenda highlights security and climate priorities', 'World Desk', 73),
  ],
  'War Watch': [
    makeDemoArticle('demo-war-1', 'Ceasefire talks monitored as regional tensions remain elevated', 'Conflict Desk', 18),
    makeDemoArticle('demo-war-2', 'NATO members review defense posture after border incidents', 'Security Wire', 43),
    makeDemoArticle('demo-war-3', 'Middle East conflict updates trigger renewed diplomatic focus', 'Geopolitical Monitor', 82),
  ],
  'AI Frontier': [
    makeDemoArticle('demo-ai-1', 'AI regulation proposals put frontier model safety back in focus', 'Tech Policy', 21),
    makeDemoArticle('demo-ai-2', 'Nvidia demand signals remain central to AI infrastructure outlook', 'AI Market Desk', 57),
  ],
  'Market Pulse': [
    makeDemoArticle('demo-market-1', 'Federal Reserve commentary keeps inflation expectations in focus', 'Macro Desk', 28),
  ],
};

const DEMO_LOGS: AppNotification[] = [
  ...DEMO_GROUPS.map((group, index) => {
    const articles = DEMO_ARTICLES_BY_CHANNEL[group.name] || [];
    return {
      id: `demo-log-${group.id}`,
      title: `+${articles.length}`,
      body: `Demo sync complete for "${group.name}" pipeline.`,
      channel: group.name,
      timestamp: new Date(Date.now() - (18 + index * 14) * 60 * 1000).toISOString(),
      articles,
    };
  }),
];

function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  }, []);

  const onMouseLeave = useCallback(() => setIsDragging(false), []);
  const onMouseUp = useCallback(() => setIsDragging(false), []);
  const onMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2;
    ref.current.scrollLeft = scrollLeft - walk;
  }, [isDragging, scrollLeft, startX]);

  return [
    ref,
    `overflow-x-auto scrollbar-hide ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`,
    { onMouseDown, onMouseLeave, onMouseUp, onMouseMove },
  ] as const;
}

export default function Home() {
  const { data: session, status } = useSession();
  const isDemoMode = status !== "loading" && !session;
  const [groups, setGroups] = useState<InterestGroup[]>(DEMO_GROUPS);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(DEMO_GROUPS[0]?.id ?? null);
  const [channelScrollRef, channelScrollClassName, channelScrollHandlers] = useDragScroll();
  const [filterScrollRef, filterScrollClassName, filterScrollHandlers] = useDragScroll();
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupLang, setNewGroupLang] = useState("any");
  const [newKeyword, setNewKeyword] = useState("");
  const [news, setNews] = useState<NewsArticle[]>(DEMO_NEWS);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [historyLogs, setHistoryLogs] = useState<AppNotification[]>(DEMO_LOGS);
  const [tickerTime, setTickerTime] = useState(0);
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  });
  const [showClearLogsModal, setShowClearLogsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLogoutTrigger, setShowLogoutTrigger] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [logChannelFilter, setLogChannelFilter] = useState<string>("all");
  const [customIntervalGroupId, setCustomIntervalGroupId] = useState<number | null>(null);
  const [isRenamingGroupId, setIsRenamingGroupId] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [notificationDiagnostics, setNotificationDiagnostics] = useState<NotificationDiagnostics>({
    supported: false,
    serviceWorkerSupported: false,
    pushSupported: false,
    permission: 'unsupported',
    serviceWorkerReady: false,
    pushSubscribed: false,
  });
  const [isNotificationBusy, setIsNotificationBusy] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('signalertica-theme') === 'light' ? 'light' : 'dark';
  });
  const [loading, setLoading] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null);
  const [keywordToDelete, setKeywordToDelete] = useState<{ id: number; word: string } | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isGlobalSyncEnabled, setIsGlobalSyncEnabled] = useState(true);
  const [canManageGlobalSync, setCanManageGlobalSync] = useState(false);
  const [isScanningAtId, setIsScanningAtId] = useState<number | null>(null);
  const isScanning = isScanningAtId !== null;
  const [selectedLog, setSelectedLog] = useState<AppNotification | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const groupsRef = useRef<InterestGroup[]>([]);
  const modalHistoryRef = useRef(false);
  const liveSessionInitializedRef = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const requireAuth = useCallback(() => {
    if (!session) {
      setShowAuthModal(true);
      return false;
    }
    return true;
  }, [session]);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', themeMode === 'light');
    window.localStorage.setItem('signalertica-theme', themeMode);
  }, [themeMode]);

  const refreshNotificationDiagnostics = useCallback(async () => {
    const supported = "Notification" in window;
    const serviceWorkerSupported = "serviceWorker" in navigator;
    const pushSupported = serviceWorkerSupported && "PushManager" in window;
    const diagnostics: NotificationDiagnostics = {
      supported,
      serviceWorkerSupported,
      pushSupported,
      permission: supported ? Notification.permission : 'unsupported',
      serviceWorkerReady: false,
      pushSubscribed: false,
    };

    if (serviceWorkerSupported) {
      try {
        const registration = await getServiceWorkerReady(4000);
        diagnostics.serviceWorkerReady = Boolean(registration.active);
        if (pushSupported) {
          diagnostics.pushSubscribed = Boolean(await registration.pushManager.getSubscription());
        }
      } catch {
        diagnostics.serviceWorkerReady = false;
      }
    }

    setNotificationDiagnostics(diagnostics);
    return diagnostics;
  }, []);

  const subscribeToPushNotifications = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

      const registration = await getServiceWorkerReady();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) return false;

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      console.log('Push subscription established successfully.');
      await refreshNotificationDiagnostics();
      return true;
    } catch (error) {
      console.error('Push registration error:', error);
      await refreshNotificationDiagnostics();
      return false;
    }
  }, [refreshNotificationDiagnostics]);

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const updateStandaloneState = () => {
      setIsStandaloneApp(standaloneQuery.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsStandaloneApp(true);
      void refreshNotificationDiagnostics();
      showToast("App installed", "success");
    };

    updateStandaloneState();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneQuery.addEventListener('change', updateStandaloneState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery.removeEventListener('change', updateStandaloneState);
    };
  }, [refreshNotificationDiagnostics, showToast]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDir = () => {
      const scrollY = window.scrollY;
      if (Math.abs(scrollY - lastScrollY) < 10) {
        ticking = false;
        return;
      }
      setIsNavVisible(scrollY < lastScrollY || scrollY < 50);
      lastScrollY = scrollY > 0 ? scrollY : 0;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDir);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Initialize logs & channels from DB once after login.
  useEffect(() => {
    if (!session) return;
    const init = async () => {
      // 1. Load Logs
      try {
        const res = await fetch('/api/logs');
        if (res.ok) {
          const data = await res.json();
          setHistoryLogs(data);
        }
      } catch (e) {
        console.error("Failed to load global logs", e);
      }

      // 2. Load Interests (Channels) initially
      try {
        const res = await fetch('/api/interests');
        if (res.ok) {
          const data = await res.json();
          setGroups(data);
        }
      } catch (e) {
        console.error("Failed to load interests", e);
      }

      // 3. Re-register Push if permission is already handled
      if ("Notification" in window && Notification.permission === 'granted') {
        void subscribeToPushNotifications();
      }
    };
    init();
  }, [session, subscribeToPushNotifications]);

  // Lightweight UI sync only while the app is visible. Alerts still come from server cron + Web Push.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const refreshInterests = async () => {
      if (cancelled || !isPageVisible) return;
      try {
        const res = await fetch('/api/interests');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setGroups(data);
        }
      } catch {
        // Best-effort UI state sync.
      }
    };

    const refreshLogs = async () => {
      if (cancelled || !isPageVisible) return;
      try {
        const res = await fetch('/api/logs');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setHistoryLogs(data);
        }
      } catch {
        // Best-effort log refresh.
      }
    };

    const refreshCurrentTab = () => {
      if (activeTab === 'account') {
        void refreshLogs();
      } else if (activeTab === 'explore' || activeTab === 'home') {
        void refreshInterests();
      }
    };

    if (!isPageVisible) {
      return () => {
        cancelled = true;
      };
    }

    refreshCurrentTab();

    const intervalMs = activeTab === 'explore'
      ? 60_000
      : activeTab === 'home'
        ? 120_000
        : null;

    const syncInterval = intervalMs ? window.setInterval(refreshInterests, intervalMs) : null;

    return () => {
      cancelled = true;
      if (syncInterval) window.clearInterval(syncInterval);
    };
  }, [activeTab, isPageVisible, session]);

  // Handle Deep Linking from Notifications
  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      const targetTab = params.get('tab');
      const logId = params.get('logId');

      if (isActiveTab(targetTab)) {
        setActiveTab(targetTab);

        // If we have a logId and we are in the account tab, try to find and open the log
        if (targetTab === 'account' && logId && historyLogs.length > 0) {
          const log = historyLogs.find(l => l.id === logId);
          if (log) {
            setSelectedLog(log);
            // Clean up URL to keep it pretty
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (!logId) {
          // Just tab change, clean up
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    });
  }, [historyLogs]); // Re-run when logs are loaded to handle the logId deep link

  // Real-time ticker for countdown precision only while Monitor is visible.
  useEffect(() => {
    if (activeTab !== 'explore' || !isPageVisible) return;

    const timer = window.setInterval(() => {
      setTickerTime(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTab, isPageVisible]);

  const isAnyModalOpen = !!(
    selectedLog ||
    showSettings ||
    isCreatingGroup ||
    showClearLogsModal ||
    showLogoutModal ||
    showAuthModal ||
    isRenamingGroupId ||
    groupToDelete ||
    keywordToDelete
  );

  // Sync modal state with browser history for "back-to-close" behavior
  useEffect(() => {
    if (isAnyModalOpen && !modalHistoryRef.current) {
      window.history.pushState({ modalOpen: true }, "");
      modalHistoryRef.current = true;
    } else if (!isAnyModalOpen && modalHistoryRef.current) {
      // Manual close - remove the dummy history entry
      modalHistoryRef.current = false;
      if (window.history.state?.modalOpen) {
        window.history.back();
      }
    }
  }, [isAnyModalOpen]);

  // Global popstate listener to catch the hardware/browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (modalHistoryRef.current) {
        modalHistoryRef.current = false;
        setSelectedLog(null);
        setShowSettings(false);
        setIsCreatingGroup(false);
        setShowClearLogsModal(false);
        setShowAuthModal(false);
        setIsRenamingGroupId(null);
        setGroupToDelete(null);
        setKeywordToDelete(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update ref whenever groups change so polling has latest config
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    if (!isDemoMode) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setGroups(DEMO_GROUPS);
      setActiveGroupId(DEMO_GROUPS[0]?.id ?? null);
      setNews(DEMO_NEWS);
      setHistoryLogs(DEMO_LOGS);
      setSourceFilter("all");
      setLogChannelFilter("all");
      setCanManageGlobalSync(false);
      setIsGlobalSyncEnabled(true);
      liveSessionInitializedRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  useEffect(() => {
    if (!session || liveSessionInitializedRef.current) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      liveSessionInitializedRef.current = true;
      setGroups([]);
      setActiveGroupId(null);
      setNews([]);
      setHistoryLogs([]);
      setSourceFilter("all");
      setLogChannelFilter("all");
      setSelectedLog(null);
      setShowAuthModal(false);
    });

    return () => {
      cancelled = true;
    };
  }, [session]);

  // Load Groups, Keywords, and Global Settings
  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      // 1. Fetch Interests
      const resp = await fetch('/api/interests');
      const data = await resp.json();
      if (Array.isArray(data)) {
        setGroups(data);
        setNews([]);
        setSourceFilter("all");
        if (data.length > 0 && (activeGroupId === null || !data.some((group: InterestGroup) => group.id === activeGroupId))) {
          setActiveGroupId(data[0].id);
        } else if (data.length === 0) {
          setActiveGroupId(null);
          setNews([]);
        }
      }

      // 2. Fetch Global Settings
      const setResp = await fetch('/api/settings');
      if (setResp.status === 403) {
        setCanManageGlobalSync(false);
        return;
      }

      if (!setResp.ok) {
        throw new Error(`Settings fetch failed: ${setResp.status}`);
      }

      const setData = await setResp.json();
      if (typeof setData.isSyncEnabled === 'boolean') {
        setCanManageGlobalSync(true);
        setIsGlobalSyncEnabled(setData.isSyncEnabled);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }, [activeGroupId, session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      void loadData();
      void refreshNotificationDiagnostics();
    });

    return () => {
      cancelled = true;
    };
  }, [loadData, refreshNotificationDiagnostics, session]);

  const toggleGlobalSync = async (enabled: boolean) => {
    if (!requireAuth()) return;

    if (!canManageGlobalSync) {
      showToast("Admin access required for pipeline sync", "info");
      return;
    }

    setIsGlobalSyncEnabled(enabled);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSyncEnabled: enabled })
      });
      if (!response.ok) {
        throw new Error(`Settings update failed: ${response.status}`);
      }
      showToast(enabled ? "Global monitoring activated" : "Global monitoring suspended", enabled ? "success" : "info");
    } catch {
      showToast("Failed to sync system status", "error");
      setIsGlobalSyncEnabled(!enabled); // Rollback
    }
  };

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const isCustomMode = activeGroup
    ? customIntervalGroupId === activeGroup.id || !INTERVAL_OPTIONS.some(option => option.value === activeGroup.refreshInterval)
    : false;
  const uniqueSources = Array.from(new Set(news.map(n => n.source))).filter(Boolean).sort();
  const filteredNews = sourceFilter === "all" ? news : news.filter(n => n.source === sourceFilter);
  const notificationHealthy = notificationDiagnostics.supported
    && notificationDiagnostics.serviceWorkerSupported
    && notificationDiagnostics.serviceWorkerReady
    && notificationDiagnostics.permission === "granted";
  const notificationStatusLabel = !notificationDiagnostics.supported
    ? "Unsupported"
    : notificationDiagnostics.permission === "denied"
      ? "Blocked"
      : notificationHealthy
        ? "Ready"
        : notificationDiagnostics.permission === "default"
          ? "Setup Required"
          : "Check Device";
  const notificationChecks = [
    { label: "Browser", ok: notificationDiagnostics.supported },
    { label: "Service Worker", ok: notificationDiagnostics.serviceWorkerSupported && notificationDiagnostics.serviceWorkerReady },
    { label: "Permission", ok: notificationDiagnostics.permission === "granted" },
    { label: "Push", ok: notificationDiagnostics.pushSupported && notificationDiagnostics.pushSubscribed },
  ];
  const demoNotice = isDemoMode ? (
    <div className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4 text-center shadow-inner">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/35 leading-relaxed">
        You are viewing demo mode. Login to create private channels, scan live signals, and receive alerts.
      </p>
      <button
        onClick={() => setShowAuthModal(true)}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-accent hover:bg-accent hover:text-white transition-all"
      >
        <User size={13} strokeWidth={2.5} />
        Login
      </button>
    </div>
  ) : null;

  const requestNotificationPermission = async () => {
    if (!requireAuth()) return false;

    if (!("Notification" in window)) {
      showToast("Notifications are not supported on this browser", "error");
      await refreshNotificationDiagnostics();
      return false;
    }

    setIsNotificationBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast(permission === 'denied' ? "Notifications are blocked in browser settings" : "Notification permission was not enabled", "error");
        await refreshNotificationDiagnostics();
        return false;
      }

      const subscribed = await subscribeToPushNotifications();
      showToast(subscribed ? "Alerts enabled" : "Notifications enabled, push sync pending", subscribed ? "success" : "info");
      await refreshNotificationDiagnostics();
      return true;
    } finally {
      setIsNotificationBusy(false);
    }
  };

  const testNotification = async () => {
    if (!("Notification" in window)) {
      showToast("Notifications are not supported on this browser", "error");
      await refreshNotificationDiagnostics();
      return false;
    }

    if (Notification.permission !== "granted") {
      showToast("Enable notifications first", "info");
      await refreshNotificationDiagnostics();
      return false;
    }

    setIsNotificationBusy(true);
    try {
      await triggerNotification(
        "Intelligence Report: Target Acquired",
        "Encrypted signal established. Real-time surveillance protocols are active."
      );
      showToast("Test notification sent", "success");
      await refreshNotificationDiagnostics();
      return true;
    } catch (error) {
      console.error("Test notification failed:", error);
      showToast("Notification test failed. Check device notification settings.", "error");
      await refreshNotificationDiagnostics();
      return false;
    } finally {
      setIsNotificationBusy(false);
    }
  };

  const setupAndTestNotifications = async () => {
    if (isNotificationBusy) return;

    if (!("Notification" in window)) {
      showToast("Notifications are not supported on this browser", "error");
      await refreshNotificationDiagnostics();
      return;
    }

    if (Notification.permission !== "granted") {
      const enabled = await requestNotificationPermission();
      if (!enabled) return;
    } else {
      await subscribeToPushNotifications();
    }

    await testNotification();
  };

  const installApp = async () => {
    if (!requireAuth()) return;

    if (isStandaloneApp) {
      showToast("App already installed", "info");
      return;
    }

    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      showToast(choice.outcome === 'accepted' ? "Install started" : "Install dismissed", choice.outcome === 'accepted' ? "success" : "info");
      return;
    }

    showToast(isIosDevice() ? "Use Share, then Add to Home Screen" : "Install prompt not available yet", "info");
  };

  const handleFetch = async (keywords: string[], lang?: string | null, country?: string | null, groupId?: number) => {
    if (groupId === activeGroupId) setLoading(true);
    try {
      const data = await fetchNews(keywords, lang, country);

      const targetGroup = groups.find(g => g.id === groupId);
      const lastScan = targetGroup?.lastScanAt ? new Date(targetGroup.lastScanAt) : new Date(0);
      const newArticles = data.filter(a => new Date(a.publishedAt) > lastScan);

      if (groupId === activeGroupId) {
        setNews(data);
        setSourceFilter("all");
      }

      // Update lastScanAt in DB
      if (groupId) {
        const now = new Date().toISOString();
        await fetch(`/api/interests?id=${groupId}`, {
          method: 'PATCH',
          body: JSON.stringify({ lastScanAt: now })
        });
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, lastScanAt: now } : g));

        // Create log entry for intelligence persistence
        if (newArticles.length > 0) {
          const newLog = {
            id: crypto.randomUUID(),
            title: `+${newArticles.length}`,
            body: `Sync complete for "${targetGroup?.name || 'Channel'}" pipeline.`,
            channel: targetGroup?.name || 'Unknown',
            timestamp: now,
            articles: newArticles
          };

          try {
            await fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newLog)
            });
            // Update local state after successful POST
            setHistoryLogs(prev => [newLog, ...prev].slice(0, 100));
          } catch (e) {
            console.error("Failed to sync log to database", e);
          }
        }
      }

      return data;
    } catch (error) {
      console.error("Failed to fetch news", error);
      return [];
    } finally {
      if (groupId === activeGroupId) setLoading(false);
    }
  };

  const saveRename = async (id: number) => {
    if (!editGroupName.trim()) {
      setIsRenamingGroupId(null);
      return;
    }
    await updateGroupSetting(id, { name: editGroupName.trim() });
    setIsRenamingGroupId(null);
  };

  const triggerManualFetch = () => {
    if (!requireAuth()) return;

    if (activeGroup && activeGroup.keywords.length > 0) {
      handleFetch(
        activeGroup.keywords.map(k => k.word),
        activeGroup.language,
        activeGroup.country,
        activeGroup.id
      );
    }
  };

  // Background Polling Logic removed in favor of Server-Side Cron Scanning
  // This ensures better battery life and background reliability on mobile.

  const createGroup = async () => {
    if (!requireAuth()) return;

    if (!newGroupName.trim()) return;
    try {
      const resp = await fetch('/api/interests', {
        method: 'POST',
        body: JSON.stringify({
          name: newGroupName.trim(),
          language: newGroupLang === 'any' ? null : newGroupLang
        })
      });
      const newGroup = await resp.json();
      setGroups([...groups, { ...newGroup, keywords: [] }]);
      setActiveGroupId(newGroup.id);
      setNewGroupName("");
      setNewGroupLang("any");
      setIsCreatingGroup(false);
      showToast(`Intelligence channel "${newGroup.name}" established`);
    } catch (e) {
      console.error(e);
      showToast("Security breach: Failed to initialize channel", "error");
    }
  };

  const updateGroupSetting = async (id: number, settings: Partial<InterestGroup>) => {
    if (!requireAuth()) return;

    try {
      await fetch(`/api/interests?id=${id}`, {
        method: 'PATCH',
        body: JSON.stringify(settings)
      });
      const targetGroup = groups.find(g => g.id === id);
      setGroups(prev => prev.map(g => g.id === id ? { ...g, ...settings } : g));

      const gName = targetGroup?.name || "Channel";
      if ('notificationsEnabled' in settings) {
        showToast(settings.notificationsEnabled ? `"${gName}" monitoring activated` : `"${gName}" monitoring suspended`, "success");
      } else if ('refreshInterval' in settings) {
        showToast(`Tracking frequency for "${gName}" set to ${settings.refreshInterval} min`, "info");
      } else if ('language' in settings) {
        const langName = LANGUAGES.find(l => l.code === (settings.language || 'any'))?.name || "Global";
        showToast(`Intelligence source for "${gName}" updated to ${langName}`, "success");
      } else {
        showToast(`Configuration protocols for "${gName}" updated`);
      }
    } catch (e) {
      console.error(e);
      showToast("Critical Error: Update sequence failed", "error");
    }
  };

  const toggleAllNotifications = async (enabled: boolean) => {
    if (!requireAuth()) return;

    try {
      // Parallel update for all groups
      await Promise.all(groups.map(g =>
        fetch(`/api/interests?id=${g.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ notificationsEnabled: enabled })
        })
      ));
      setGroups(prev => prev.map(g => ({ ...g, notificationsEnabled: enabled })));
      showToast(enabled ? "Bulk monitoring activated" : "Bulk monitoring suspended", enabled ? "success" : "info");
    } catch (e) {
      console.error(e);
      showToast("Critical Error: Bulk update sequence aborted", "error");
    }
  };

  const deleteGroup = async () => {
    if (!requireAuth()) return;

    if (!groupToDelete) return;
    const id = groupToDelete;
    try {
      await fetch(`/api/interests?id=${id}`, { method: 'DELETE' });
      const newGroups = groups.filter(g => g.id !== id);
      setGroups(newGroups);
      if (activeGroupId === id) {
        setActiveGroupId(newGroups.length > 0 ? newGroups[0].id : null);
      }
      const deletedName = groups.find(g => g.id === id)?.name || "Channel";
      setGroupToDelete(null);
      showToast(`Intelligence channel "${deletedName}" decommissioned`, "info");
    } catch (e) {
      console.error(e);
      showToast("Security Breach: Decommissioning sequence failed", "error");
    }
  };

  const addKeyword = async () => {
    if (!requireAuth()) return;

    if (!activeGroupId || !newKeyword.trim()) return;
    try {
      const resp = await fetch('/api/keywords', {
        method: 'POST',
        body: JSON.stringify({ interestId: activeGroupId, word: newKeyword.trim() })
      });
      const savedKeyword = await resp.json();

      setGroups(groups.map(g => {
        if (g.id === activeGroupId) {
          return { ...g, keywords: [...g.keywords, savedKeyword] };
        }
        return g;
      }));
      setNewKeyword("");
      showToast(`Entity "${savedKeyword.word.toUpperCase()}" integrated into "${activeGroup?.name}" surveillance`);
    } catch (e) {
      console.error(e);
      showToast("Security Breach: Failed to integrate mission target", "error");
    }
  };

  const removeKeyword = (id: number, word: string) => {
    if (!requireAuth()) return;
    setKeywordToDelete({ id, word });
  };

  const confirmRemoveKeyword = async () => {
    if (!requireAuth()) return;

    if (!keywordToDelete) return;
    const { id, word } = keywordToDelete;
    try {
      await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' });
      setGroups(groups.map(g => {
        if (g.id === activeGroupId) {
          return { ...g, keywords: g.keywords.filter(k => k.id !== id) };
        }
        return g;
      }));
      setKeywordToDelete(null);
      showToast(`Entity "${word.toUpperCase()}" decoupled from "${activeGroup?.name}" monitoring`, "info");
    } catch (e) {
      console.error(e);
      showToast("Security Breach: Failed to decouple target", "error");
    }
  };

  if (status === "loading") {
    return (
      <main className="app-shell theme-loading-screen relative z-0 min-h-screen flex flex-col items-center justify-center gap-4 text-center">
        <div className="bg-blob-1" />
        <div className="bg-blob-2" />
        <div className="relative">
          <div className="theme-loading-ring w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
          <Zap size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" />
        </div>
        <p className="theme-loading-text text-xs font-black text-white/40 tracking-[0.2em] uppercase">Decrypting Credentials...</p>
      </main>
    );
  }

  return (
    <main className="app-shell relative z-0 pb-28">
      <div className="bg-blob-1" />
      <div className="bg-blob-2" />
      {/* Premium Navigation */}
      <motion.nav
        initial={{ y: 0 }}
        animate={{ y: isNavVisible ? 0 : "-100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="glass phone-fixed fixed top-0 z-50 px-3 py-2"
      >
        <div className="nav-container mx-auto">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex min-w-0 items-center gap-2.5"
          >
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-accent/20 rounded-xl blur-md group-hover:bg-accent/30 transition-all animate-pulse-slow" />
              <div className="relative w-9 h-9 shrink-0 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 glass-light">
                <img src="/icon-192x192.png" alt="Signalertica Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex min-w-0 flex-col">
              <h1 className="whitespace-nowrap text-[18px] font-black tracking-tighter leading-none bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">SIGNALERTICA</h1>
              <span className="brand-tagline whitespace-nowrap text-[8px] font-black text-accent tracking-[.16em] uppercase opacity-80">Smart Signal Tracker</span>
            </div>
          </motion.div>

          <div className="flex shrink-0 items-center gap-2">
            {isDemoMode && (
              <span className="animate-demo-breath shrink-0 rounded-full border border-white/70 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-black">
                Demo
              </span>
            )}
            <button
              onClick={() => {
                if (!requireAuth()) return;
                setShowSettings(!showSettings);
              }}
              className="aspect-square w-9 shrink-0 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 hover:bg-white/10 transition-all active:scale-95"
            >
              <LayoutGrid size={18} className="text-white/70" />
            </button>
            {session ? (
              <div className="flex shrink-0 items-center gap-2 pl-2 border-l border-white/10">
                <button
                  onClick={() => setShowLogoutTrigger((visible) => !visible)}
                  className="aspect-square w-8 shrink-0 rounded-xl transition-all active:scale-95"
                  title="Account menu"
                >
                  {session.user?.image && failedAvatarUrl !== session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="h-full w-full rounded-xl border border-white/10 object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setFailedAvatarUrl(session.user?.image || null)}
                    />
                  ) : (
                    <div className="h-full w-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/60 uppercase">
                      {(session.user?.name || session.user?.email || "US").slice(0, 2)}
                    </div>
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {showLogoutTrigger && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8, x: -6 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: -6 }}
                      onClick={() => {
                        setShowLogoutTrigger(false);
                        setShowLogoutModal(true);
                      }}
                      className="aspect-square w-8 shrink-0 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 hover:bg-white/10 hover:text-white hover:border-white/15 transition-all active:scale-95 text-white/50"
                      title="Deauthorize session"
                    >
                      <X size={16} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="aspect-square w-9 shrink-0 rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-[0_0_14px_var(--accent-glow)] flex items-center justify-center hover:bg-accent hover:text-white transition-all active:scale-95"
                  title="Authorize access"
                >
                  <User size={17} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Main Content Areas */}
      {activeTab === 'home' && (
        <div className="pt-20 px-4 w-full max-w-[430px] mx-auto flex flex-col gap-4 fade-in">

          {/* Horizontal Channel Bar */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Intelligence Hub</h2>
              <button
                onClick={() => {
                  if (!requireAuth()) return;
                  setIsCreatingGroup(!isCreatingGroup);
                }}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all shadow-lg shadow-black/5"
              >
                <Plus size={20} />
              </button>
            </div>

            <div
              className={`flex gap-3 pb-2 -mx-1 px-1 ${channelScrollClassName}`}
              ref={channelScrollRef}
              {...channelScrollHandlers}
            >
              {groups.map(group => (
                <motion.button
                  key={group.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setActiveGroupId(group.id);
                    setNews([]);
                  }}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 group relative`}
                >
                  <div className={`theme-channel-tile w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 border-2 ${activeGroupId === group.id
                      ? 'is-active bg-accent border-accent shadow-xl shadow-accent/30'
                      : 'is-muted bg-white/5 border-transparent hover:border-white/10'
                    }`}>
                    {(() => {
                      const IconObj = getChannelIcon(group.name);
                      return <IconObj size={24} className={`theme-channel-icon ${activeGroupId === group.id ? 'is-active text-white' : 'is-muted text-white/20 group-hover:text-white/40'}`} />;
                    })()}
                  </div>
                  {group.notificationsEnabled && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-accent-secondary rounded-full border-2 border-background animate-pulse" />
                  )}
                  <span className={`theme-channel-label text-[11px] font-bold truncate max-w-[70px] ${activeGroupId === group.id ? 'is-active text-white' : 'is-muted text-white/40'}`}>
                    {group.name}
                  </span>
                </motion.button>
              ))}
            </div>

            <AnimatePresence>
              {isCreatingGroup && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  className="card-rich p-4 border-white/10"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="badge bg-white/10 text-white/60 border border-white/5">
                        New Channel
                      </div>
                      <button
                        onClick={() => setIsCreatingGroup(false)}
                        className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5 text-white/35 hover:bg-white/10 hover:text-white transition-all"
                        aria-label="Close new channel"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        autoFocus
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="E.g. Middle East War, Crypto..."
                        className="input-field compact-field h-12 px-4"
                      />
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(150px,0.72fr)] items-stretch gap-2">
                        <div className="relative w-full">
                          <select
                            value={newGroupLang}
                            onChange={(e) => setNewGroupLang(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-[11px] font-black text-white outline-none cursor-pointer hover:border-accent transition-all w-full shadow-inner appearance-none"
                          >
                            {LANGUAGES.map(l => (
                              <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                        </div>
                        <button onClick={createGroup} className="button-primary flex items-center justify-center gap-4 py-3 px-4 shadow-2xl">
                          <span className="text-[11px] uppercase tracking-[0.2em] font-black italic">Initialize</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Active Channel Dashboard */}
          {activeGroup && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              <div className="card-rich p-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  {(() => {
                    const IconObj = getChannelIcon(activeGroup.name);
                    return <IconObj size={140} strokeWidth={4} />;
                  })()}
                </div>

                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="badge bg-accent text-white shadow-lg shadow-accent/20">Active Channel</div>
                        <div className="badge bg-white/10 text-white/60 border border-white/5 flex items-center gap-1.5 backdrop-blur-sm">
                          <span>{LANGUAGES.find(l => l.code === (activeGroup.language || 'any'))?.flag}</span>
                          <span>{LANGUAGES.find(l => l.code === (activeGroup.language || 'any'))?.name}</span>
                        </div>
                      </div>
                      <h3 className="text-xl font-black uppercase tracking-tighter italic break-words leading-tight">{activeGroup.name}</h3>
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setShowActionMenu(!showActionMenu)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border border-white/5 shadow-xl ${showActionMenu ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        <MoreVertical size={20} />
                      </button>

                      <AnimatePresence>
                        {showActionMenu && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setShowActionMenu(false)}
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: -10, x: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: -10, x: 10 }}
                              className="absolute right-0 top-14 w-48 bg-[#1a1b26]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden flex flex-col p-2"
                            >
                              <button
                                onClick={() => {
                                  if (!requireAuth()) return;
                                  setShowActionMenu(false);
                                  setEditGroupName(activeGroup.name);
                                  setIsRenamingGroupId(activeGroup.id);
                                }}
                                className="flex items-center gap-3 px-3 py-3 rounded-none text-xs font-bold text-white/70 hover:text-white transition-all text-left"
                              >
                                <Edit2 size={16} className="text-white/55" />
                                <span>Rename Channel</span>
                              </button>
                              <div className="h-px bg-white/10 mx-3 my-1" />
                              <button
                                onClick={() => {
                                  if (!requireAuth()) return;
                                  setShowActionMenu(false);
                                  setGroupToDelete(activeGroup.id);
                                }}
                                className="flex items-center gap-3 px-3 py-3 rounded-none text-xs font-bold text-white/50 hover:text-white transition-all text-left"
                              >
                                <Trash2 size={16} className="text-white/45" />
                                <span>Delete Channel</span>
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Per-Channel Automation Settings */}
                  <div className="grid grid-cols-1 gap-4 bg-white/5 p-4 rounded-[28px] border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Auto Alerts</span>
                        <span className="text-[11px] font-bold text-white uppercase">{activeGroup.notificationsEnabled ? 'Active' : 'Muted'}</span>
                      </div>
                      <button
                        onClick={() => updateGroupSetting(activeGroup.id, { notificationsEnabled: !activeGroup.notificationsEnabled })}
                        className={`w-14 h-8 rounded-full relative transition-all duration-300 ${activeGroup.notificationsEnabled ? 'bg-accent-secondary' : 'bg-white/10'}`}
                      >
                        <motion.div
                          animate={{ x: activeGroup.notificationsEnabled ? 24 : 4 }}
                          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 shrink-0 bg-white rounded-full shadow-lg"
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between ">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Interval</span>
                        <span className="text-[11px] font-bold text-white uppercase">
                          {INTERVAL_OPTIONS.find(o => o.value === activeGroup.refreshInterval)?.label || `${activeGroup.refreshInterval} Mins`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            value={INTERVAL_OPTIONS.some(o => o.value === activeGroup.refreshInterval) ? activeGroup.refreshInterval : "custom"}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "custom") {
                                setCustomIntervalGroupId(activeGroup.id);
                              } else {
                                setCustomIntervalGroupId(currentId => currentId === activeGroup.id ? null : currentId);
                                updateGroupSetting(activeGroup.id, { refreshInterval: parseInt(val) });
                              }
                            }}
                            className="bg-black/40 border border-white/10 rounded-xl pl-3 pr-10 h-8 text-[9px] font-black text-white outline-none cursor-pointer appearance-none hover:border-white/20 transition-all flex items-center"
                          >
                            {INTERVAL_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value} className="bg-[#121214]">{opt.label}</option>
                            ))}
                            <option value="custom" className="bg-[#121214]">Custom...</option>
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                        </div>
                        {isCustomMode && (
                          <input
                            type="number"
                            min="1"
                            autoFocus
                            placeholder="Mins"
                            value={activeGroup.refreshInterval === 0 ? '' : activeGroup.refreshInterval}
                            onChange={(e) => updateGroupSetting(activeGroup.id, { refreshInterval: parseInt(e.target.value) || 0 })}
                            className="w-16 h-8 bg-black/40 border border-white/10 rounded-xl px-2 text-[9px] font-black text-white outline-none focus:border-accent"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {activeGroup.notificationsEnabled && activeGroup.refreshInterval === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-accent/5 border border-accent/20 p-4 rounded-2xl flex items-start gap-3 -mt-4"
                    >
                      <Settings size={16} className="text-accent mt-0.5" />
                      <p className="text-[9px] font-bold text-accent/80 leading-relaxed uppercase tracking-wider">
                        Note: Alerts are enabled but Interval is Manual. Signalertica will only notify you when you trigger a manual scan.
                      </p>
                    </motion.div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                        placeholder="E.g. Iran, Gold, Nvidia..."
                        className="input-field compact-field h-12 flex-1 bg-black/40 border-white/5 px-4"
                      />
                      <button onClick={addKeyword} className="w-12 h-12 rounded-2xl bg-white/10 flex-shrink-0 flex items-center justify-center hover:bg-white/20 transition-all border border-white/5">
                        <Plus size={24} />
                      </button>
                    </div>

                    {activeGroup.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-2.5">
                        {activeGroup.keywords.map(kw => (
                          <motion.div
                            layout
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            key={kw.id}
                            className="bg-white/5 border border-white/20 rounded-2xl px-4 py-2 flex items-center gap-2.5 transition-colors hover:border-white/30"
                          >
                            <span className="text-[11px] font-black text-white/80 tracking-tight break-all">{kw.word.toUpperCase()}</span>
                            <X size={14} className="text-white/45 cursor-pointer hover:text-white flex-shrink-0" onClick={() => removeKeyword(kw.id, kw.word)} />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-col items-stretch justify-between border-t border-white/5 gap-4 ${activeGroup.keywords.length > 0 ? 'pt-5 mt-0' : 'pt-4 mt-0'
                    }`}>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Source Localization</span>
                        <div className="relative">
                          <select
                            value={activeGroup.language || 'any'}
                            onChange={(e) => updateGroupSetting(activeGroup.id, { language: e.target.value === 'any' ? null : e.target.value })}
                            className="bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-[11px] font-black text-white outline-none cursor-pointer hover:border-accent transition-all min-w-[180px] shadow-inner appearance-none"
                          >
                            {LANGUAGES.map(l => (
                              <option key={l.code} value={l.code} className="bg-[#121214]">{l.flag} {l.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    {activeGroup.keywords.length > 0 && (
                      <button
                        onClick={triggerManualFetch}
                        className="button-primary flex items-center gap-4 group/btn py-3 px-6 shadow-2xl"
                      >
                        <Search size={20} className="group-hover/btn:rotate-12 transition-transform" />
                        <span className="text-[11px] uppercase tracking-[0.2em] font-black italic">Scan Pipeline</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* News Feed Gallery */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40">
                Intelligence Feed
              </h2>
              {news.length > 0 && (
                <span className="text-[10px] font-black text-accent bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
                  {news.length} SIGNALS DETECTED
                </span>
              )}
            </div>

            {!activeGroup ? (
              <div className="py-10 px-6 flex flex-col items-center gap-4 text-center bg-white/5 rounded-[32px] border border-dashed border-white/10">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                  <Radar size={32} strokeWidth={1.4} className="text-white/15" />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[16px] font-black uppercase italic tracking-tighter">No channel selected</p>
                  <p className="text-[11px] text-white/35 max-w-[260px] leading-relaxed font-bold uppercase tracking-widest">
                    Select or create a channel to begin scanning data.
                  </p>
                </div>
              </div>
            ) : loading ? (
              <div className="py-20 flex flex-col items-center gap-8 text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                  <Zap size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-white uppercase tracking-widest">Injecting Keywords...</p>
                  <div className="flex items-center gap-1 justify-center">
                    {activeGroup.keywords.slice(0, 3).map((k, i) => (
                      <span key={i} className="text-[10px] text-white/20">#{k.word}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : news.length > 0 ? (
              <div className="flex flex-col gap-6">
                {uniqueSources.length > 1 && (
                  <div
                    className={`flex items-center gap-3 pb-2 -mx-1 px-1 ${filterScrollClassName}`}
                    ref={filterScrollRef}
                    {...filterScrollHandlers}
                  >
                    <button
                      onClick={() => setSourceFilter("all")}
                      className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${sourceFilter === 'all' ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10 hover:text-white/80'}`}
                    >
                      ALL SOURCES
                    </button>
                    {uniqueSources.map(source => (
                      <button
                        key={source}
                        onClick={() => setSourceFilter(source)}
                        className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${sourceFilter === source ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10 hover:text-white/80'}`}
                      >
                        {source}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {filteredNews.map((article, i) => (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, scale: 0.98, x: -10 }}
                      whileInView={{ opacity: 1, scale: 1, x: 0 }}
                      viewport={{ once: true, margin: "-20px" }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(i * 0.03, 0.3),
                        ease: "easeOut"
                      }}
                      className="card-rich group cursor-pointer p-4 flex gap-4 items-start relative overflow-hidden pr-8"
                      onClick={() => {
                        if (isDemoMode) {
                          setShowAuthModal(true);
                          return;
                        }
                        window.open(article.url, '_blank');
                      }}
                    >
                      <div className="flex-1 flex flex-col gap-1.5 min-w-0 z-10">
                        <div className="flex items-center flex-wrap gap-2 text-[8px] font-bold text-white/40 uppercase tracking-widest leading-none">
                          <Clock size={10} className="text-accent/60 flex-shrink-0" />
                          <span>{formatTime(article.publishedAt)}</span>
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <span className="text-white/80">{article.source}</span>
                        </div>
                        <h3 className="text-[14px] font-black leading-[1.18] tracking-tight group-hover:text-accent transition-colors">{article.title}</h3>
                        {article.description && (
                          <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">{article.description}</p>
                        )}
                      </div>

                      {article.image && (
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 z-10 hidden">
                          <img
                            src={article.image}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            alt=""
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Subtle right chevron indicating it's a clickable link */}
                      <ChevronRight size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/5 group-hover:text-accent transform group-hover:translate-x-1 transition-all" />
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 px-6 flex flex-col items-center gap-5 text-center bg-white/5 rounded-[36px] border border-dashed border-white/10">
                <Radar size={44} strokeWidth={1.2} className="text-white/12" />
                <div className="flex flex-col gap-3 max-w-[280px]">
                  <p className="text-[16px] font-black tracking-tight uppercase italic">{activeGroup.keywords.length > 0 ? 'Ready to Scan' : 'Pipeline Empty'}</p>
                  <p className="text-[11px] text-white/40 leading-relaxed font-bold">
                    {activeGroup.keywords.length > 0
                      ? `Manual scan previews keyword results. Auto alerts follow the interval configured above.`
                      : 'Add keywords to this channel to begin scanning for signal updates.'}
                  </p>
                  {activeGroup.keywords.length > 0 && (
                    <button
                      onClick={triggerManualFetch}
                      className="button-primary mt-3 py-3.5 px-6 text-[12px]"
                    >
                      Start Intelligence Scan
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
          {demoNotice}
        </div>
      )}

      {activeTab === 'explore' && (
        <div className="pt-20 px-4 w-full max-w-[430px] mx-auto flex flex-col gap-4 fade-in pb-20">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Intelligence Monitor</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[9px] font-bold text-accent/60 uppercase tracking-widest">
                  System Pulse: {!isGlobalSyncEnabled ? 'SYSTEM PAUSED' : (() => {
                    const lastPulses = groups.map(g => g.lastScanAt ? new Date(g.lastScanAt).getTime() : 0);
                    const lastPulse = Math.max(...lastPulses, 0);
                    return lastPulse > 0 ? new Date(lastPulse).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Waiting...';
                  })()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isGlobalSyncEnabled ? 'bg-accent animate-pulse shadow-[0_0_10px_var(--accent)]' : 'bg-white/10'}`} />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">{isGlobalSyncEnabled ? 'Live Monitor' : 'Offline'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {(() => {
              const activeTrackers = groups.filter(g => g.notificationsEnabled);

              if (activeTrackers.length === 0) {
                return (
                  <div className="py-10 px-6 flex flex-col items-center gap-4 text-center bg-white/5 rounded-[32px] border border-dashed border-white/10">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                      <Radar size={32} strokeWidth={1.4} className="text-white/15" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-[16px] font-black uppercase italic tracking-tighter">No active signals</p>
                      <p className="text-[11px] text-white/35 max-w-[260px] font-bold uppercase tracking-widest leading-relaxed">
                        Enable Auto-Alerts on a channel to begin monitoring.
                      </p>
                    </div>
                  </div>
                );
              }

              return activeTrackers.map(group => {
                const lastScan = group.lastScanAt ? new Date(group.lastScanAt) : new Date(0);
                const nextScan = new Date(lastScan.getTime() + group.refreshInterval * 60000);
                const msRemaining = nextScan.getTime() - tickerTime;
                const isImminent = msRemaining > 0 && msRemaining < 60000;
                const isOverdue = msRemaining <= 0 && group.refreshInterval > 0 && isGlobalSyncEnabled;

                return (
                  <motion.div
                    layout
                    key={group.id}
                    className="card-rich p-4 flex items-center justify-between relative overflow-hidden group/mcard"
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 ${isOverdue ? 'bg-accent/10 border-accent/30 text-accent animate-pulse' :
                          isImminent ? 'bg-accent/20 border-accent/40 text-accent animate-pulse' :
                            'bg-white/5 border-white/10 text-white/20'
                        }`}>
                        {(() => {
                          const Icon = getChannelIcon(group.name);
                          return <Icon size={18} className={isImminent || isOverdue ? 'animate-bounce' : ''} />;
                        })()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black tracking-tight uppercase italic leading-none">{group.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black text-accent bg-accent/10 px-1.5 py-0.5 rounded-md border border-accent/20 uppercase tracking-tighter">
                            {group.refreshInterval}M PULSE
                          </span>
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest leading-none">
                            {group.keywords.length} TARGETS • {group.language?.toUpperCase() || 'ALL'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 relative z-10">
                      <div className="flex flex-col items-end gap-0.5">
                        {group.refreshInterval > 0 ? (
                          <>
                            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Next Scan</span>
                            <span className={`text-xs font-black tabular-nums tracking-tighter italic leading-none ${isOverdue ? 'text-accent animate-pulse' :
                                isImminent ? 'text-accent animate-pulse' : 'text-white'
                              }`}>
                              {msRemaining > 0 ? (() => {
                                const totalSecs = Math.floor(msRemaining / 1000);
                                const h = Math.floor(totalSecs / 3600);
                                const m = Math.floor((totalSecs % 3600) / 60);
                                const s = totalSecs % 60;
                                if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                              })() : (isGlobalSyncEnabled ? 'SYNCING...' : 'PAUSED')}
                            </span>
                          </>
                        ) : (
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Manual Mode</span>
                        )}
                      </div>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!requireAuth()) return;
                          setIsScanningAtId(group.id);
                          await handleFetch(group.keywords.map(k => k.word), group.language, group.country, group.id);
                          setTimeout(() => setIsScanningAtId(null), 2000);
                        }}
                        disabled={isScanningAtId === group.id}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-accent/20 border border-white/5 hover:border-accent/40 group/mref transition-all active:scale-90"
                        title="Force Intelligence Scan"
                      >
                        <RefreshCcw size={14} className={`text-white/40 group-hover/mref:text-accent ${isScanningAtId === group.id ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </motion.div>
                );
              });
            })()}
          </div>
          {demoNotice}
        </div>
      )}

      {activeTab === 'account' && (
        <div className="pt-20 px-4 w-full max-w-[430px] mx-auto flex flex-col gap-4 fade-in pb-20">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Intelligence Logs</h2>
              <span className="text-[9px] font-bold text-white/20 uppercase">Encrypted Signal History</span>
            </div>
            <button
              onClick={() => {
                if (!requireAuth()) return;
                setShowClearLogsModal(true);
              }}
              className="text-[10px] font-black text-white/55 hover:text-white transition-all uppercase tracking-widest border border-white/15 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10"
            >
              Purge Logs
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Log Channel Filter */}
            {historyLogs.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                <button
                  onClick={() => setLogChannelFilter("all")}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${logChannelFilter === "all"
                      ? "bg-accent text-white shadow-lg shadow-accent/30"
                      : "bg-white/5 text-white/40 hover:bg-white/10"
                    }`}
                >
                  All Channels
                </button>
                {Array.from(new Set(historyLogs.map(l => l.channel))).map(channel => (
                  <button
                    key={channel}
                    onClick={() => setLogChannelFilter(channel)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${logChannelFilter === channel
                        ? "bg-accent text-white shadow-lg shadow-accent/30"
                        : "bg-white/5 text-white/40 hover:bg-white/10"
                      }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const filtered = logChannelFilter === "all"
                ? historyLogs
                : historyLogs.filter(l => l.channel === logChannelFilter);

              if (filtered.length === 0) {
                return (
                  <div className="py-10 px-6 flex flex-col items-center gap-4 text-center bg-white/5 rounded-[32px] border border-dashed border-white/10">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                      <Terminal size={32} strokeWidth={1.4} className="text-white/15" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-[16px] font-black uppercase italic tracking-tighter">No signals found</p>
                      <p className="text-[11px] text-white/35 max-w-[260px] leading-relaxed font-bold uppercase tracking-widest">
                        {logChannelFilter === "all" ? "Target acquisitions will be recorded here." : `No logs found for channel "${logChannelFilter}".`}
                      </p>
                    </div>
                  </div>
                );
              }

              return filtered.map((log, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.2) }}
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="card-rich p-4 flex flex-col gap-4 group border border-white/5 relative overflow-hidden cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] transition-all"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    {(() => {
                      const BgIcon = getChannelIcon(log.channel);
                      return <BgIcon size={140} strokeWidth={4} />;
                    })()}
                  </div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-accent border border-accent/20 bg-accent/5 px-2 py-0.5 rounded-lg uppercase tracking-widest">{log.channel}</span>
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">Intelligence:</span>
                      <span className="theme-log-count-accent text-[12px] font-black text-accent italic uppercase tracking-tight">
                        {log.title.includes('Intelligence Acquired') ? `+${log.title.match(/\d+/)?.[0] || ''}` : log.title}
                      </span>
                    </div>
                    <span className="text-[9px] font-black text-white/50 tabular-nums uppercase">
                      {formatTimeAgo(log.timestamp)}
                    </span>
                  </div>

                  {log.articles && log.articles.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1.5">
                        {log.articles.slice(0, 3).map((art, i) => (
                          <div
                            key={i}
                            className="flex flex-col gap-0.5 border-l border-white/5 pl-3 py-0.5 transition-all"
                          >
                            <span className="text-[11px] font-bold text-accent/80 line-clamp-1 leading-tight transition-colors">{art.title}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{art.source}</span>
                              <span className="w-0.5 h-0.5 rounded-full bg-white/10" />
                              <span className="text-[8px] font-black text-white/20 uppercase tabular-nums">{formatTimeAgo(art.publishedAt)}</span>
                            </div>
                          </div>
                        ))}

                        {log.articles.length > 3 && (
                          <div className="mt-2 ml-3 flex items-center">
                            <span className="theme-log-count-accent text-[9px] font-black text-accent italic uppercase tracking-widest">
                              +{log.articles.length - 3} more signals
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ));
            })()}
          </div>
          {demoNotice}
        </div>
      )}

      {/* Premium Bottom Navigation */}
      <motion.nav
        initial={{ y: 0 }}
        animate={{ y: isNavVisible ? 0 : "100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="phone-fixed fixed bottom-0 z-40 bg-[#050507]/90 backdrop-blur-3xl border-t border-white/10 pb-safe pb-3 pt-3 px-6 flex items-center justify-center"
      >
        <div className="flex items-center gap-10">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-accent scale-110 drop-shadow-[0_0_15px_rgba(129,76,255,0.8)]' : 'text-white/40 hover:text-white/70'}`}
          >
            <HomeIcon size={20} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'explore' ? 'text-accent scale-110 drop-shadow-[0_0_15px_rgba(129,76,255,0.8)]' : 'text-white/40 hover:text-white/70'}`}
          >
            <Radio size={20} strokeWidth={activeTab === 'explore' ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-widest">Monitor</span>
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'account' ? 'text-accent scale-110 drop-shadow-[0_0_15px_rgba(129,76,255,0.8)]' : 'text-white/40 hover:text-white/70'}`}
          >
            <Terminal size={20} strokeWidth={activeTab === 'account' ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-widest">Logs</span>
          </button>
        </div>
      </motion.nav>

      {/* Modern tray Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="phone-fixed fixed inset-y-0 z-[60] bg-black/80 backdrop-blur-md flex items-end justify-center p-0"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300, restDelta: 0.1, restSpeed: 0.1 }}
              style={{ willChange: 'transform' }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowSettings(false);
                }
              }}
              className="theme-config-panel bg-[#0a0a0c] w-full max-w-[430px] max-h-[calc(100dvh-72px)] rounded-t-[48px] border border-white/10 border-b-0 flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Draggable Handle and Header Area */}
              <div className="pt-4 pb-3 px-6 flex-shrink-0 cursor-grab active:cursor-grabbing w-full flex flex-col gap-3 rounded-t-[48px]">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto flex-shrink-0" />
                <div className="flex items-center justify-between flex-shrink-0">
                  <div className="flex flex-col cursor-default">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">System Config</h3>
                    <p className="text-xs text-white/30 hidden">Application control panel</p>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    onPointerDownCapture={e => e.stopPropagation()} // Exclude from drag
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 hover:bg-white/10 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable Content Area (Excluded from Drag) */}
              <div
                className="px-4 pb-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto no-scrollbar"
                onPointerDownCapture={e => e.stopPropagation()}
              >
                {/* Column 1: Alerts & Sync */}
                <div className="flex flex-col gap-4">
                  <div className="card bg-white/5 border-white/5 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="theme-icon-box w-11 h-11 rounded-xl flex shrink-0 items-center justify-center bg-white/5 text-white/50">
                          {themeMode === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-sm tracking-tight text-white/90">APPEARANCE</span>
                          <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{themeMode === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
                        aria-label="Toggle light theme"
                        className="theme-switch w-12 h-7 rounded-full relative transition-colors duration-300 border bg-white/5 border-white/5"
                      >
                        <motion.div
                          animate={{ x: themeMode === 'light' ? 22 : 4 }}
                          className={`theme-switch-knob absolute top-1/2 -translate-y-1/2 w-4 h-4 shrink-0 rounded-full shadow-lg ${themeMode === 'light' ? 'bg-white' : 'bg-white/25'}`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="card bg-white/5 border-white/5 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="theme-icon-box w-11 h-11 rounded-xl flex shrink-0 items-center justify-center bg-white/5 text-white/50">
                          <Download size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-sm tracking-tight text-white/90">INSTALL APP</span>
                          <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{isStandaloneApp ? 'Installed' : deferredInstallPrompt ? 'Ready' : 'Available'}</span>
                        </div>
                      </div>
                      <button onClick={installApp} className="theme-config-action text-white/70 text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed" disabled={isStandaloneApp}>
                        {isStandaloneApp ? 'Done' : 'Install'}
                      </button>
                    </div>
                  </div>

                  <div className="card bg-white/5 border-white/5 p-3 flex flex-col gap-2">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="theme-icon-box w-11 h-11 rounded-xl flex shrink-0 items-center justify-center bg-white/5 text-white/50">
                            {notificationHealthy ? <Bell size={18} /> : <BellOff size={18} />}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="font-black text-sm tracking-tight text-white/90">ALERTS</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{notificationStatusLabel}</span>
                          </div>
                        </div>
                        <button
                          onClick={setupAndTestNotifications}
                          disabled={isNotificationBusy}
                          className="theme-config-action shrink-0 text-white/70 text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-wait transition-all"
                        >
                          {isNotificationBusy ? 'Checking' : notificationHealthy ? 'Test' : 'Setup'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {notificationChecks.map((check) => (
                          <div
                            key={check.label}
                            className={`theme-config-check-item flex items-center justify-between rounded-lg border px-2.5 py-2 ${check.ok
                                ? 'bg-white/5 border-white/20 text-white/80'
                                : 'bg-black/20 border-white/5 text-white/30'
                              }`}
                          >
                            <span className="theme-config-check-label text-[9px] font-bold uppercase tracking-widest">{check.label}</span>
                            <span
                              className={`theme-config-check-dot flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${check.ok
                                  ? 'bg-white text-black border-white'
                                  : 'is-missing bg-white/5 text-white/35 border-white/10'
                                }`}
                            >
                              {check.ok ? <Check size={12} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                            </span>
                          </div>
                        ))}
                      </div>
                      {(!isStandaloneApp || notificationDiagnostics.permission === 'denied') && (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                            {notificationDiagnostics.permission === 'denied' ? 'Enable in device settings' : 'PWA improves mobile alerts'}
                          </span>
                          {!isStandaloneApp && (
                            <button
                              onClick={installApp}
                              className="shrink-0 text-white/70 text-[9px] font-black uppercase tracking-widest bg-white/5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-all"
                            >
                              Install
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card bg-white/5 border-white/5 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="theme-icon-box w-11 h-11 rounded-xl flex shrink-0 items-center justify-center bg-white/5 text-white/50">
                          <Volume2 size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-sm tracking-tight text-white/90">PIPELINE SYNC</span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                            {!canManageGlobalSync ? 'Admin Only' : isGlobalSyncEnabled ? (isScanning ? 'Synchronizing Intelligence...' : 'Active') : 'Standby'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleGlobalSync(!isGlobalSyncEnabled)}
                        disabled={!canManageGlobalSync}
                        aria-disabled={!canManageGlobalSync}
                        title={canManageGlobalSync ? 'Toggle global pipeline sync' : 'Admin access required'}
                        className={`theme-switch w-12 h-7 rounded-full relative transition-colors duration-300 bg-white/5 border-white/5 border ${isGlobalSyncEnabled ? 'is-on' : ''} ${canManageGlobalSync ? '' : 'opacity-40 cursor-not-allowed'}`}
                      >
                        <motion.div
                          animate={{ x: isGlobalSyncEnabled ? 22 : 4 }}
                          className={`theme-switch-knob absolute top-1/2 -translate-y-1/2 w-4 h-4 shrink-0 rounded-full shadow-lg ${isGlobalSyncEnabled ? 'bg-white' : 'bg-white/20'}`}
                        />
                      </button>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full relative overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{
                          x: isScanning ? ["-100%", "100%"] : "-100%"
                        }}
                        transition={isScanning ? {
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "linear"
                        } : { duration: 0.5 }}
                        className="theme-config-progress h-full w-1/2 bg-white/60 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Column 2: Bulk Actions (Moved inside a single card) */}
                <div className="card bg-white/5 border-white/5 p-3 flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-sm tracking-tight text-white/90">BULK ACTIONS</span>
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Global Automation</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleAllNotifications(true)}
                      className="theme-config-bulk-action w-full bg-white/5 border border-white/20 text-white/80 text-xs font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/30 hover:text-white transition-all uppercase tracking-widest"
                    >
                      <Bell size={14} /> Enable All
                    </button>
                    <button
                      onClick={() => toggleAllNotifications(false)}
                      className="theme-config-bulk-action w-full bg-white/5 border border-white/20 text-white/80 text-xs font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/30 hover:text-white transition-all uppercase tracking-widest"
                    >
                      <BellOff size={14} /> Silence All
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-white/5 bg-[#0a0a0c] px-6 pb-6 pt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="button-primary py-3 text-sm font-black uppercase italic tracking-tighter w-full"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Demo Authorization Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
            onClick={() => setShowAuthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="card max-w-[400px] w-full bg-gradient-to-br from-[#1a1b26] to-[#0a0b12] border-accent/20 p-8 flex flex-col gap-6 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative mx-auto">
                <div className="absolute -inset-2 rounded-[32px] bg-accent/20 blur-xl" />
                <div className="relative w-20 h-20 rounded-[32px] bg-accent/10 flex items-center justify-center border border-accent/20 overflow-hidden">
                  <img src="/icon-192x192.png" alt="Signalertica Logo" className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Authorize Access</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  You are viewing demo data. Connect Google to create private channels, scan live signals, and receive alerts.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => signIn("google")}
                  className="button-primary py-4 text-xs font-black uppercase tracking-widest"
                >
                  Authorize Google Access
                </button>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="w-full bg-white/5 text-white/45 font-black py-4 rounded-xl hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest text-xs"
                >
                  Continue Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
            onClick={() => setShowLogoutModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="card max-w-[400px] w-full bg-gradient-to-br from-[#1a1b26] to-[#0a0b12] border-white/10 p-8 flex flex-col gap-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="theme-neutral-modal-icon w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/15 mx-auto">
                <X size={40} className="text-white/70" />
              </div>

              <div className="flex flex-col gap-2 text-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Logout?</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  End this Signalertica session and return to the access screen.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="theme-neutral-secondary py-4 rounded-2xl bg-white/5 text-white/50 text-xs font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => signOut()}
                  className="theme-confirm-button theme-neutral-confirm py-4 rounded-2xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/15 transition-all shadow-lg shadow-black/10"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Delete Confirmation Modal */}
      <AnimatePresence>
        {groupToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="card max-w-[400px] w-full bg-gradient-to-br from-[#1a1b26] to-[#0a0b12] border-white/10 p-8 flex flex-col gap-6"
            >
              <div className="theme-neutral-modal-icon w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/15 mx-auto">
                <Trash2 size={40} className="text-white/70" />
              </div>

              <div className="flex flex-col gap-2 text-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Destroy Channel?</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Are you sure you want to delete <span className="text-white font-bold break-all">&quot;{groups.find(g => g.id === groupToDelete)?.name}&quot;</span>? This action is irreversible.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <button
                  onClick={() => setGroupToDelete(null)}
                  className="theme-neutral-secondary py-4 rounded-2xl bg-white/5 text-white/50 text-xs font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteGroup}
                  className="theme-confirm-button theme-neutral-confirm py-4 rounded-2xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/15 transition-all shadow-lg shadow-black/10"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Premium Keyword Delete Confirmation Modal */}
      <AnimatePresence>
        {keywordToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="card max-w-[400px] w-full bg-gradient-to-br from-[#1a1b26] to-[#0a0b12] border-white/10 p-8 flex flex-col gap-6"
            >
              <div className="theme-neutral-modal-icon w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/15 mx-auto">
                <Settings size={40} className="text-white/70" />
              </div>

              <div className="flex flex-col gap-2 text-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Destroy Keyword?</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Are you sure you want to remove <span className="text-white font-bold break-all">&quot;{keywordToDelete.word.toUpperCase()}&quot;</span>? This target will no longer be tracked.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setKeywordToDelete(null)}
                  className="theme-neutral-secondary py-4 rounded-2xl bg-white/5 text-white/50 text-xs font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all border border-white/5"
                >
                  Abort
                </button>
                <button
                  onClick={confirmRemoveKeyword}
                  className="theme-confirm-button theme-neutral-confirm py-4 rounded-2xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/15 transition-all shadow-lg shadow-black/10"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Rename Modal */}
      <AnimatePresence>
        {isRenamingGroupId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="card max-w-[400px] w-full bg-gradient-to-br from-[#1a1b26] to-[#0a0b12] border-white/10 p-8 flex flex-col gap-6"
            >
              <div className="theme-neutral-modal-icon w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/15 mx-auto">
                <Edit2 size={40} className="text-white/70" />
              </div>
              <div className="flex flex-col gap-2 text-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Rename Channel</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Update the intelligence identifier for this monitoring pipeline.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <input
                  autoFocus
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename(isRenamingGroupId);
                    if (e.key === 'Escape') setIsRenamingGroupId(null);
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-white/30 transition-all shadow-inner"
                  placeholder="Encryption handle..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <button
                  onClick={() => setIsRenamingGroupId(null)}
                  className="theme-neutral-secondary py-4 rounded-2xl bg-white/5 text-white/50 text-xs font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all border border-white/5"
                >
                  Abort
                </button>
                <button
                  onClick={() => saveRename(isRenamingGroupId)}
                  className="theme-confirm-button theme-neutral-confirm py-4 rounded-2xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/15 transition-all shadow-lg shadow-black/10"
                >
                  Confirm Rename
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearLogsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="card max-w-[400px] w-full bg-gradient-to-br from-[#1a1b26] to-[#0a0b12] border-white/10 p-8 flex flex-col gap-6"
            >
              <div className="theme-neutral-modal-icon w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/15 mx-auto">
                <Trash2 size={40} className="text-white/70" />
              </div>
              <div className="flex flex-col gap-2 text-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Clear All Logs?</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  This will permanently erase your entire intelligence notification history from memory.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <button
                  onClick={() => setShowClearLogsModal(false)}
                  className="theme-neutral-secondary py-4 rounded-2xl bg-white/5 text-white/50 text-xs font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await fetch('/api/logs', { method: 'DELETE' });
                      setHistoryLogs([]);
                    } catch (e) {
                      console.error("Failed to clear cloud logs", e);
                    }
                    setShowClearLogsModal(false);
                  }}
                  className="theme-confirm-button theme-neutral-confirm py-4 rounded-2xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/15 transition-all shadow-lg shadow-black/10"
                >
                  Confirm Clear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Toast Notification System */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="theme-toast fixed bottom-24 left-1/2 z-[250] w-fit max-w-[calc(100vw-48px)] -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl border backdrop-blur-xl flex items-center justify-center gap-3 text-center bg-white/10 border-white/20 text-white"
          >
            <span className="whitespace-nowrap text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Log Article Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="theme-log-modal-overlay fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="theme-log-modal bg-[#0a0a0c] w-full max-w-[430px] max-h-[80vh] rounded-[48px] border border-white/10 flex flex-col shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="theme-log-chip text-[10px] font-black text-white/70 border border-white/15 bg-white/5 px-3 py-1 rounded-lg uppercase tracking-[.2em]">{selectedLog.channel}</span>
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{formatTimeAgo(selectedLog.timestamp)}</span>
                  </div>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter mt-1">
                    <span className="theme-log-count-accent text-accent">
                      {selectedLog.title.includes('Intelligence Acquired') ? `+${selectedLog.title.match(/\d+/)?.[0] || ''}` : selectedLog.title}
                    </span>{" "}
                    ARTICLES RECOVERED
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/5"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 pt-4 flex flex-col gap-3 no-scrollbar">
                {selectedLog.articles?.map((article, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={article.id}
                    className="theme-log-article flex flex-col gap-1.5 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group/art cursor-pointer"
                    onClick={() => {
                      if (isDemoMode) {
                        setShowAuthModal(true);
                        return;
                      }
                      window.open(article.url, '_blank');
                    }}
                  >
                    <div className="flex items-center gap-3 text-[9px] font-black text-white/40 uppercase tracking-widest">
                      <span>{article.source}</span>
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="text-white/40">{formatTimeAgo(article.publishedAt)}</span>
                    </div>
                    <h4 className="theme-log-article-title text-[13px] font-bold text-white/80 group-hover/art:text-white leading-snug transition-colors">{article.title}</h4>
                  </motion.div>
                ))}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}
