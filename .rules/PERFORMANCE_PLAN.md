# CUOS — Performance & UX Optimization Plan

> **Goal:** Eliminate the 4–5 second silent-delete problem and slow page transitions.  
> Stack: Vite + React 19 + RTK Query + Express + MongoDB  
> Status: **PENDING EXECUTION**

---

## 🩺 Root Causes

### Frontend

| # | Issue | Severity |
|---|-------|----------|
| F1 | **No mutation feedback** — mutations run silently; no spinner, no toast, no optimistic removal | 🔴 High |
| F2 | **No optimistic delete** — UI waits for full server round-trip before item disappears | 🔴 High |
| F3 | **Vite chunk-splitting creates ~60 separate JS files** — one chunk per npm package; cold load downloads 60+ files sequentially | 🔴 High |
| F4 | **No route-change loading indicator** — layout has no visual signal while next page JS + API calls are in flight | 🟡 Medium |
| F5 | **`refetchOnMountOrArgChange: true` scattered inconsistently** — some pages always refetch even when returning to cached data | 🟡 Medium |
| F6 | **Suspense fallback is plain "Loading..."** — no skeleton, causes layout shift | 🟡 Medium |
| F7 | **No `keepUnusedDataFor` configured globally** — RTK Query defaults leave data in cache only 60s | 🟢 Low |

### Build / Bundle

| # | Issue | Severity |
|---|-------|----------|
| B1 | **Per-package chunks** — 60 npm deps → 60 JS download requests on cold load | 🔴 High |
| B2 | **No gzip on build output** — static assets served uncompressed | 🔴 High |
| B3 | **`@react-pdf/renderer` loaded upfront** — 1.4 MB heavy library loaded even for non-PDF users | 🟡 Medium |
| B4 | **No long-term cache headers on Express static server** — browser re-downloads unchanged bundles on every deploy | 🟡 Medium |

### Server / API

| # | Issue | Severity |
|---|-------|----------|
| S1 | **No response compression (gzip)** — all JSON API responses sent uncompressed over the wire | 🔴 High |
| S2 | **No cache-control headers on static assets** — deployed users download fresh JS on every page load | 🟡 Medium |
| S3 | **No `.lean()` on read-heavy list endpoints** — returning full Mongoose documents instead of plain objects | 🟡 Medium |

---

## ✅ Implementation Checklist

### Priority 1 — Mutation Loading + Toast Feedback
> Fixes: F1, F2 — "No feedback on delete/update for 4–5 seconds"

- [ ] **1a.** Create `client/src/components/ui/Toast.tsx` — minimal toast component (success / error / info)
- [ ] **1b.** Create `client/src/app/toastSlice.ts` — Redux slice `{ messages: [{id, type, text}] }`
- [ ] **1c.** Add `toastReducer` to `client/src/app/store.ts`
- [ ] **1d.** Render `<ToastContainer />` inside `DashboardLayout.tsx` (once, globally)
- [ ] **1e.** Add optimistic delete + toast to `financeApi.ts`:
  - `deleteRevenue` → optimist-remove from cache, toast on success/fail, rollback on error
  - `deleteExpense` → same
  - `deleteBankTransaction` → same
- [ ] **1f.** Add optimistic delete + toast to `projectApi.ts`:
  - `deleteTask` → same pattern
  - `deleteProject` → same pattern
- [ ] **1g.** Add optimistic delete + toast to `crmApi.ts`:
  - `deleteLead` → same
  - `deleteClient` → same
- [ ] **1h.** Add optimistic delete + toast to `hrmsApi.ts`:
  - `deleteEmployee` → same
  - `deleteLeave` → same
- [ ] **1i.** Add mutation loading spinners to delete buttons across pages
  - Use `isLoading` from the mutation hook to disable button + show spinner inline

---

### Priority 2 — Route-Change Loading Bar
> Fixes: F4 — "Blank screen during page navigation"

- [ ] **2a.** Create `client/src/components/ui/TopLoadingBar.tsx`
  - Slim 3px colored bar at top of screen (like GitHub/YouTube)
  - Uses `useNavigation()` from react-router-dom v7 (already installed)
  - Shows when `navigation.state === 'loading'`, animates to 100% then fades
- [ ] **2b.** Mount `<TopLoadingBar />` inside `DashboardLayout.tsx` (above everything)

**Implementation sketch:**
```tsx
// TopLoadingBar.tsx
import { useNavigation } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function TopLoadingBar() {
  const { state } = useNavigation();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const isLoading = state === 'loading';

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setWidth(75); // jump to 75% immediately
    } else {
      setWidth(100); // complete
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, zIndex: 9999,
        height: '3px', backgroundColor: 'var(--color-primary)',
        width: `${width}%`,
        transition: isLoading ? 'width 2s ease-out' : 'width 0.2s ease-in',
      }}
    />
  );
}
```

---

### Priority 3 — Fix Vite Bundle Chunking
> Fixes: F3, B1 — "Slow cold loads / 60 JS file waterfall"

- [ ] **3a.** Update `client/vite.config.ts` — replace per-package splitting with smart grouping:

```ts
// BEFORE (current — creates 60 chunks):
manualChunks(id) {
  if (!id.includes('node_modules')) return;
  // ... returns vendor-{packageName} for every single package
}

// AFTER (6 meaningful groups):
manualChunks: {
  'react-core': ['react', 'react-dom', 'react-router-dom'],
  'redux':      ['@reduxjs/toolkit', 'react-redux'],
  'ui-charts':  ['recharts'],
  'ui-dnd':     ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  'ui-editor':  ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/pm', '@tiptap/extension-placeholder'],
  'ui-forms':   ['react-hook-form', '@hookform/resolvers', 'zod', 'react-select', 'react-currency-input-field'],
  'pdf':        ['@react-pdf/renderer'],
  'utils':      ['date-fns', 'lodash.debounce', 'lucide-react', 'clsx', 'tailwind-merge'],
  'socket':     ['socket.io-client'],
  'markdown':   ['react-markdown'],
},
```

- [ ] **3b.** Enable build compression output:
  - Install `vite-plugin-compression2` (dev dep)
  - Add to `vite.config.ts` plugins: generates `.gz` and `.br` alongside each asset

---

### Priority 4 — Server Gzip + Cache Headers
> Fixes: S1, S2, B4 — "API responses slow to arrive"

- [ ] **4a.** Install `compression` on server:
  ```bash
  cd server && npm install compression && npm install -D @types/compression
  ```
- [ ] **4b.** Add to `server/src/index.ts` (before all routes):
  ```ts
  import compression from 'compression';
  app.use(compression()); // gzip all responses > 1 KB — typical 70–80% size reduction
  ```
- [ ] **4c.** Update static file serving with proper cache-control:
  ```ts
  // Production static serving
  app.use(express.static(buildPath, {
    maxAge: '1y',    // fingerprinted bundles cached forever in browser
    etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        // HTML must never be cached — it references fingerprinted assets
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  ```

---

### Priority 5 — RTK Query Cache Tuning
> Fixes: F5, F7 — "Unnecessary refetches / stale screens"

- [ ] **5a.** Update `client/src/services/api.ts`:
  ```ts
  export const api = createApi({
    ...
    keepUnusedDataFor: 300, // keep cache 5 min (was 60s default)
    refetchOnFocus: false,  // don't refetch when user alt-tabs back
    refetchOnReconnect: true, // do refetch on network reconnect
  });
  ```
- [ ] **5b.** Audit and remove stray `refetchOnMountOrArgChange: true` from queries that don't need it:
  - Projects list, employee list, leads list, clients list — accessed often, don't need fresh on every mount
  - **Keep** `refetchOnMountOrArgChange: true` on: Finance dashboard (date-filtered, must always be fresh)
- [ ] **5c.** Add `refetchOnMountOrArgChange: 30` (30-second threshold) to project detail queries — avoids refetch if navigated back within 30s

---

### Priority 6 — Skeleton Suspense Fallback
> Fixes: F6 — "Layout shift / jarring 'Loading...' text"

- [ ] **6a.** Update `RouteFallback` in `client/src/App.tsx`:

```tsx
function RouteFallback() {
  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 space-y-5 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-lg bg-gray-200" />
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl border bg-gray-100" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="h-64 rounded-xl border bg-gray-100" />
    </div>
  );
}
```

---

## 📊 Expected Improvements

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| First JS load (cold) | ~8–12s (60 files) | ~2–3s (10 groups) |
| API response size | ~80–200 KB raw JSON | ~15–40 KB gzip |
| Delete action feedback | 0 ms (silent) | Instant (optimistic) |
| Route transition visual | Blank / nothing | Immediate bar animation |
| Browser cache reuse | None (no max-age) | 1 year for bundles |

---

## 🔢 Execution Order

```
Step 1 → Priority 4 (Server gzip)          ← 15 min, highest ROI, zero risk
Step 2 → Priority 3 (Vite bundle fix)      ← 30 min, major cold-load improvement
Step 3 → Priority 1a-d (Toast system)      ← 45 min, foundation for all feedback
Step 4 → Priority 2 (Top loading bar)      ← 20 min, instant win
Step 5 → Priority 1e-i (Optimistic ops)    ← 60 min, all mutations
Step 6 → Priority 5 (RTK cache tuning)     ← 30 min, nav latency reduction
Step 7 → Priority 6 (Skeleton fallback)    ← 15 min, polish
```

**Total estimated time: ~3.5–4 hours of coding**

---

## ❓ Decisions Needed Before Starting

1. **Toast library**: Custom minimal (~50 lines, zero new dep) or `react-hot-toast` (5 KB)?
2. **Optimistic delete scope**: All modules at once or Finance + Projects first?
3. **Server**: Confirm OK to `npm install compression` on the server.

---

*Created: April 2026 | CUOS — Creative Upaay Operating System*
