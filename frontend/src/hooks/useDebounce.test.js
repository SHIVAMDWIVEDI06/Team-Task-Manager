import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes with default delay (300ms)', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    expect(result.current).toBe('initial');

    // Update the value
    rerender({ value: 'updated', delay: 300 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 299ms (just before delay)
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    // Fast-forward time by 1ms more (reaching 300ms)
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('should debounce value changes with custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 500 });

    // Value should not change before delay
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe('initial');

    // Value should change after delay
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    // First update
    rerender({ value: 'update1', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Second update before first delay completes
    rerender({ value: 'update2', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Third update before second delay completes
    rerender({ value: 'update3', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Value should still be initial (only 300ms total, but timer reset each time)
    expect(result.current).toBe('initial');

    // Complete the final delay
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('update3');
  });

  it('should handle different data types', () => {
    // Test with number
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 0 } }
    );

    numberRerender({ value: 42 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(numberResult.current).toBe(42);

    // Test with object
    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: { name: 'initial' } } }
    );

    const newObj = { name: 'updated' };
    objectRerender({ value: newObj });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(objectResult.current).toEqual(newObj);

    // Test with array
    const { result: arrayResult, rerender: arrayRerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: [1, 2, 3] } }
    );

    const newArray = [4, 5, 6];
    arrayRerender({ value: newArray });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(arrayResult.current).toEqual(newArray);
  });

  it('should handle null and undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // Test null
    rerender({ value: null });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(null);

    // Test undefined
    rerender({ value: undefined });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(undefined);
  });

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    );

    rerender({ value: 'updated', delay: 0 });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('updated');
  });

  it('should cleanup timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const { unmount } = renderHook(() => useDebounce('test', 300));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    // Update value with 300ms delay
    rerender({ value: 'updated', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Change delay to 500ms (should reset timer)
    rerender({ value: 'updated', delay: 500 });

    // Should still be initial (timer was reset)
    expect(result.current).toBe('initial');

    // Complete the new delay (500ms from the rerender)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('updated');
  });

  it('should handle empty string', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: '' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('');
  });

  it('should handle boolean values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: false } }
    );

    rerender({ value: true });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(true);
  });
});
