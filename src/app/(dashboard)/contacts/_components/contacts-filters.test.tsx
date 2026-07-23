// @vitest-environment jsdom

import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactsFilters } from './contacts-filters';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

/**
 * Behavioural tests for the refactored search input.
 *
 * The component now owns its local state for the field, defers the
 * value through `useDeferredValue`, and emits a single-direction
 * submit. The tests below pin each leg of that contract so future
 * refactors can't regress into the dual-state pattern that caused
 * the re-render storm: every keystroke previously triggered a state
 * update, a parent re-render, a URL round-trip, and a resync
 * effect — four renders per debounced search action. With the
 * refactor, the keystroke is the only render until the debounce
 * fires.
 *
 * Test mechanics:
 *   - `vi.useFakeTimers()` controls the `setTimeout` in the debounce
 *     effect. We must wrap every timer advance in `await act(async
 *     () => { ... })` so React's scheduler flushes the deferred-value
 *     update before the assertion runs. A sync `act` only flushes
 *     microtasks, not the work scheduled by `useDeferredValue`.
 *   - `fireEvent.input(input, { target: { value } })` goes through
 *     React's synthetic event system, which is the only path that
 *     triggers the `onChange` handler in React 19. Setting
 *     `input.value` directly bypasses it.
 */

const baseProps = {
  search: '',
  status: 'active' as const,
  onStatusChange: vi.fn(),
  onSearchSubmit: vi.fn(),
  allTags: [],
  selectedTagIds: [],
  tagsById: {},
  onToggleTag: vi.fn(),
  onClearTags: vi.fn(),
};

function renderFilters(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides };
  const view = render(<ContactsFilters {...props} />);
  return {
    ...view,
    props,
    rerenderWith(nextOverrides: Partial<typeof baseProps>) {
      const merged = { ...props, ...nextOverrides };
      view.rerender(<ContactsFilters {...merged} />);
      return merged;
    },
  };
}

function getSearchInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input');
  if (!input) throw new Error('search input not rendered');
  return input;
}

async function flushDebounce(ms = 250) {
  // Async `act` is required so the React scheduler commits the
  // deferred-value update and the effect re-runs before the timer
  // callback fires the submit.
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ContactsFilters — local ownership of the input', () => {
  it('seeds the input value from the `search` prop on mount', () => {
    const { container } = renderFilters({ search: 'Ada' });
    expect(getSearchInput(container).value).toBe('Ada');
  });

  it('updates the input value immediately on every keystroke (no debounce on the way in)', async () => {
    const { container, props } = renderFilters({ search: '' });
    const input = getSearchInput(container);

    act(() => {
      fireEvent.input(input, { target: { value: 'A' } });
      fireEvent.input(input, { target: { value: 'Ad' } });
      fireEvent.input(input, { target: { value: 'Ada' } });
    });

    expect(input.value).toBe('Ada');
    // The submit must NOT fire mid-typing — the debounce is what
    // coalesces intermediate keystrokes into a single URL push.
    await flushDebounce(500);
    expect(props.onSearchSubmit).toHaveBeenCalledExactlyOnceWith('Ada');
  });

  it('emits onSearchSubmit exactly once after the debounce settles', async () => {
    const { container, props } = renderFilters({ search: '' });
    const input = getSearchInput(container);

    act(() => {
      fireEvent.input(input, { target: { value: 'Ada' } });
    });

    // Halfway through the debounce window — nothing yet.
    await act(async () => {
      vi.advanceTimersByTime(249);
    });
    expect(props.onSearchSubmit).not.toHaveBeenCalled();

    // Cross the threshold and let the deferred value flush.
    await flushDebounce(1);
    expect(props.onSearchSubmit).toHaveBeenCalledExactlyOnceWith('Ada');
  });

  it('resets the debounce timer on every keystroke', async () => {
    const { container, props } = renderFilters({ search: '' });
    const input = getSearchInput(container);

    act(() => {
      fireEvent.input(input, { target: { value: 'A' } });
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      fireEvent.input(input, { target: { value: 'Ad' } });
    });
    await act(async () => {
      // 200ms after the second keystroke; past the first debounce
      // window's tail but not enough for the new one.
      vi.advanceTimersByTime(200);
    });
    expect(props.onSearchSubmit).not.toHaveBeenCalled();

    await flushDebounce(50);
    expect(props.onSearchSubmit).toHaveBeenCalledExactlyOnceWith('Ad');
  });
});

describe('ContactsFilters — URL resync', () => {
  it('resyncs the local input when the URL changes from the outside', () => {
    // Simulates a back/forward navigation, a deep-link arrival, or a
    // programmatic clear. The local field must pick up the new value
    // even mid-typing — the parent's URL is the source of truth for
    // what the page is filtered to.
    const { container, rerenderWith } = renderFilters({ search: '' });
    const input = getSearchInput(container);

    act(() => {
      fireEvent.input(input, { target: { value: 'A' } });
    });

    rerenderWith({ search: 'Bea' });
    expect(getSearchInput(container).value).toBe('Bea');
  });

  it('preserves newer keystrokes when its own older navigation settles', async () => {
    const { container, rerenderWith } = renderFilters({ search: '' });
    const input = getSearchInput(container);

    act(() => {
      fireEvent.input(input, { target: { value: 'Ada' } });
    });
    await flushDebounce();

    act(() => {
      fireEvent.input(input, { target: { value: 'Adam' } });
    });
    rerenderWith({ search: 'Ada' });

    expect(input.value).toBe('Adam');
  });
});

describe('ContactsFilters — feedback loop guard', () => {
  it('does not re-emit a submit when the URL already matches the deferred value', async () => {
    // After the parent navigates and `search` catches up to the
    // value the user just typed, the debounce effect's deferred-value
    // check must short-circuit the submit — otherwise the URL would
    // round-trip forever.
    const onSearchSubmit = vi.fn();
    const { container, rerenderWith } = renderFilters({ search: '', onSearchSubmit });
    const input = getSearchInput(container);

    act(() => {
      fireEvent.input(input, { target: { value: 'Ada' } });
    });

    await flushDebounce(500);
    expect(onSearchSubmit).toHaveBeenCalledExactlyOnceWith('Ada');

    // Parent navigates and the URL catches up to the typed value.
    rerenderWith({ search: 'Ada', onSearchSubmit });

    // Wait long enough for any straggling debounce to fire.
    await flushDebounce(500);
    expect(onSearchSubmit).toHaveBeenCalledExactlyOnceWith('Ada');
  });

  it('does not restart the debounce when the callback prop changes', async () => {
    const firstSubmit = vi.fn();
    const latestSubmit = vi.fn();
    const { container, rerenderWith } = renderFilters({ onSearchSubmit: firstSubmit });

    act(() => {
      fireEvent.input(getSearchInput(container), { target: { value: 'Ada' } });
    });
    await flushDebounce(200);
    rerenderWith({ onSearchSubmit: latestSubmit });
    await flushDebounce(50);

    expect(firstSubmit).not.toHaveBeenCalled();
    expect(latestSubmit).toHaveBeenCalledExactlyOnceWith('Ada');
  });
});
