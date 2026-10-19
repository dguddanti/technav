import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RouteMarker } from './RouteMarker';
import { pathLength, pointAlongPath } from './routeGeometry';
import type { Point } from '../route';

const route: Point[] = [[0, 0], [100, 0], [100, 100], [130, 100]];
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('follows every corner, including the final door leg', () => {
  expect(pathLength(route)).toBe(230);
  expect(pointAlongPath(route, 50)).toEqual([50, 0]);
  expect(pointAlongPath(route, 150)).toEqual([100, 50]);
  expect(pointAlongPath(route, 215)).toEqual([115, 100]);
  expect(pointAlongPath(route, 1000)).toEqual([130, 100]);
});

it('animates forward, reverses from its current position, and reaches the door', () => {
  let now = 0;
  let next = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++next, callback); return next; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  const advance = (time: number) => {
    now = time;
    const pending = [...callbacks.values()];
    callbacks.clear();
    act(() => pending.forEach((callback) => callback(time)));
  };
  const { container, rerender } = render(<svg><RouteMarker points={route} distance={0} /></svg>);
  const position = () => {
    const circle = container.querySelector('circle')!;
    return [Number(circle.getAttribute('cx')), Number(circle.getAttribute('cy'))];
  };
  rerender(<svg><RouteMarker points={route} distance={200} /></svg>);
  expect(position()).toEqual([0, 0]);
  advance(325);
  expect(position()[0]).toBeCloseTo(100, 1);
  expect(position()[1]).toBeCloseTo(0, 1);
  rerender(<svg><RouteMarker points={route} distance={0} /></svg>);
  expect(position()[0]).toBeCloseTo(100, 1);
  advance(650);
  expect(position()[0]).toBeCloseTo(50, 1);
  advance(975);
  expect(position()).toEqual([0, 0]);
  rerender(<svg><RouteMarker points={route} distance={230} /></svg>);
  advance(1625);
  expect(position()).toEqual([130, 100]);
});

it('updates immediately when reduced motion is requested', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const { container, rerender } = render(<svg><RouteMarker points={route} distance={0} /></svg>);
  rerender(<svg><RouteMarker points={route} distance={230} /></svg>);
  const circle = container.querySelector('circle')!;
  expect(circle).toHaveAttribute('cx', '130');
  expect(circle).toHaveAttribute('cy', '100');
});
