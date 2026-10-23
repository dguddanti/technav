import type { Floor } from '../building';
import type { Point } from '../route';

export const MAP_VERSION = 'tech-v1';
export const MAP_WIDTH = 1948;
export const MAP_HEIGHT = 1904;
export type ReportKind = 'map' | 'entrance' | 'photo';
export type IssueCategory = 'wrong_route' | 'blocked_path' | 'incorrect_label' | 'other';
export type MapHeading = 0 | 90 | 180 | 270;

export interface PhotoStation {
  id: string;
  floor: Floor;
  point: Point;
  hallwayNodeId: string;
  segment?: [string, string];
  label: string;
}

export interface ReportContext {
  kind?: ReportKind;
  photoStationId?: string;
  mapHeading?: MapHeading;
  floor: Floor;
  point?: Point;
  from?: string;
  to?: string;
  stepIndex?: number;
  stepText?: string;
}

export interface ReportDraft {
  kind: ReportKind;
  category: IssueCategory;
  floor: Floor;
  point: Point | null;
  placeName: string;
  hallwayNodeId: string | null;
  photoStationId: string | null;
  mapHeading: MapHeading | null;
  description: string;
  photo: File | null;
  context: ReportContext;
}
