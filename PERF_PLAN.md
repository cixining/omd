# Performance Optimization Plan — `omd`

## Branch: `perf-optimization`

## Goal
Improve rendering performance **without changing any functionality**.

---

## Benchmark Targets

| File | Size | Description |
|------|------|-------------|
| `benchmark/small.md` | ~100 lines | Single README-style doc |
| `benchmark/medium.md` | ~500 lines | Long-form article with tables |
| `benchmark/large.md` | ~2000 lines | Many headings, code blocks, tables |
| `benchmark/huge.md` | ~5000 lines | Dense mixed content |

## Metrics to Capture

- **Wall-clock time** (hyperfine, 10 runs each)
- **Lines/second throughput**
- **Startup overhead** (node startup time baseline)
- **Throughput comparison**: plain cat vs omd rendering

---

## Benchmark Results (Baseline — hyperfine, 10 runs each)

| File | Lines | Mean Time | Std Dev | Lines/sec | Overhead Cat |
|------|-------|-----------|---------|-----------|--------------|
| small.md | 14 | 135.1 ms | ±0.5 ms | 104 | 198x slower |
| medium.md | 342 | 139.9 ms | ±0.9 ms | 2,445 | 121x slower |
| large.md | 839 | 146.4 ms | ±0.8 ms | 5,731 | 125x slower |
| huge.md | 2,636 | 156.3 ms | ±0.9 ms | 16,865 | 128x slower |

**Node startup baseline:** `node -e "process.exit(0)"` = **48.5 ms** (fixed cost, always)

## Bottlenecks Identified

1. **Node.js startup: ~48ms fixed** (unavoidable)
2. **Module loading (marked + cli-highlight): ~80-90ms** (most impactful)
3. **Actual rendering: ~10-20ms** for even 2636-line files (fast)

**Key insight:** Rendering itself is fast. Most time is startup + module load.
- small.md (14 lines): 135ms total → ~5ms rendering, ~130ms startup
- huge.md (2636 lines): 156ms total → ~20ms rendering, ~136ms startup

Scaling is very flat (146ms vs 135ms for 60x more content), confirming rendering is efficient.

---

## Optimization Tasks

- [ ] **T1**: Pre-compile regexes to module scope
- [ ] **T2**: Use array.join() instead of string concatenation
- [ ] **T3**: Lazy-load cli-highlight only for code blocks
- [ ] **T4**: Cache highlighted code blocks
- [ ] **T5**: Batch stdout writes

---

## Progress Log

| Date | Task | Result |
|------|------|--------|
| 2026-03-29 | Baseline benchmark | Pending |
