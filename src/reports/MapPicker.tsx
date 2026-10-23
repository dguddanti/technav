import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react';
import { FLOORS } from '../building';
import type { Floor } from '../building';
import type { Point } from '../route';
import { MAP_HEIGHT, MAP_WIDTH } from '../types/reports';
import type { MapHeading, PhotoStation } from '../types/reports';

interface MapPickerProps {
  readOnly?: boolean;
  floor: Floor;
  point: Point | null;
  center?: Point;
  heading?: MapHeading | null;
  onHeadingChange?: (heading: MapHeading) => void;
  connection?: Point;
  spots?: PhotoStation[];
  hallwayPoints?: Point[];
  original?: Point;
  onPick: (point: Point) => void;
}
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

export const MapPicker = ({ readOnly = false, floor, point, center, heading, onHeadingChange, connection, spots, hallwayPoints, original, onPick }: MapPickerProps) => {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(center ? 2 : 1);
  const [focus, setFocus] = useState<Point>(center ?? [MAP_WIDTH / 2, MAP_HEIGHT / 2]);
  const drag = useRef<{ start: Point; focus: Point; moved: boolean } | null>(null);
  const width = MAP_WIDTH / zoom;
  const height = MAP_HEIGHT / zoom;
  const x = Math.max(0, Math.min(MAP_WIDTH - width, focus[0] - width / 2));
  const y = Math.max(0, Math.min(MAP_HEIGHT - height, focus[1] - height / 2));
  const toMap = (clientX: number, clientY: number): Point | null => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return [clamp(Math.round(p.x), MAP_WIDTH), clamp(Math.round(p.y), MAP_HEIGHT)];
  };
  const pick = (position: Point) => { if (!readOnly) onPick(position); };
  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (event.isPrimary === false) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { start: [event.clientX, event.clientY], focus, moved: false };
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current || event.isPrimary === false) return;
    const dx = event.clientX - drag.current.start[0], dy = event.clientY - drag.current.start[1];
    if (Math.hypot(dx, dy) > 5) drag.current.moved = true;
    if (drag.current.moved) {
      const matrix = event.currentTarget.getScreenCTM();
      if (!matrix) return;
      setFocus([clamp(drag.current.focus[0] - dx / matrix.a, MAP_WIDTH), clamp(drag.current.focus[1] - dy / matrix.d, MAP_HEIGHT)]);
    }
  };
  const up = (event: PointerEvent<SVGSVGElement>) => {
    if (event.isPrimary === false) return;
    if (drag.current && !drag.current.moved) {
      const position = toMap(event.clientX, event.clientY);
      if (position) pick(position);
    }
    drag.current = null;
  };
  const key = (event: KeyboardEvent<SVGSVGElement>) => {
    const arrows: Record<string, Point> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (arrows[event.key]) {
      event.preventDefault();
      const delta = arrows[event.key];
      const p = spots || readOnly ? focus : point ?? focus;
      const next: Point = [clamp(p[0] + delta[0] * 20 / zoom, MAP_WIDTH), clamp(p[1] + delta[1] * 20 / zoom, MAP_HEIGHT)];
      if (spots || readOnly) setFocus(next); else { onPick(next); setFocus(next); }
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(spots ? focus : point ?? focus); }
  };
  const wheel = (event: WheelEvent<SVGSVGElement>) => {
    if (event.ctrlKey || event.metaKey) setZoom((z) => Math.max(1, Math.min(6, z + (event.deltaY < 0 ? .25 : -.25))));
  };
  const radius = 16 / zoom;
  const ray = point && heading !== null && heading !== undefined
    ? [point[0] + Math.sin(heading * Math.PI / 180) * 140 / zoom, point[1] - Math.cos(heading * Math.PI / 180) * 140 / zoom] : null;
  return (
    <div className="report-map-wrap" data-directions={!!onHeadingChange}>
      <svg ref={svg} className="report-map" viewBox={`${x} ${y} ${width} ${height}`} tabIndex={0}
        role="application" aria-label={readOnly ? "Location map. Drag or use arrow keys to pan." : "Location map. Tap to place a pin, drag to pan, or use arrow keys and Enter."}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} onKeyDown={key} onWheel={wheel}>
        <image href={FLOORS.find((f) => f.id === floor)!.image} width={MAP_WIDTH} height={MAP_HEIGHT} />
        {hallwayPoints?.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={radius} className="photo-spot" />)}
        {original && <circle cx={original[0]} cy={original[1]} r={radius * 1.6} className="report-original" />}
        {spots?.map((spot) => <circle key={spot.id} cx={spot.point[0]} cy={spot.point[1]} r={radius} className="photo-spot" />)}
        {point && connection && <><line x1={point[0]} y1={point[1]} x2={connection[0]} y2={connection[1]} className="report-connection" /><circle cx={connection[0]} cy={connection[1]} r={radius * 1.2} className="report-hallway" /></>}
        {point && <circle cx={point[0]} cy={point[1]} r={radius * 1.5} className="report-pin" />}
        {point && ray && <g className="report-facing-arrow" transform={`translate(${point[0]} ${point[1]}) rotate(${heading ?? 0})`}><path d={`M 0 ${-140 / zoom} L ${-36 / zoom} ${-78 / zoom} L 0 ${-92 / zoom} L ${36 / zoom} ${-78 / zoom} Z`} /><line x1={0} y1={-26 / zoom} x2={0} y2={-106 / zoom} className="report-facing" /></g>}
      </svg>
      {onHeadingChange && <><div className="report-camera-compass" aria-live="polite"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" /><path transform={`rotate(${heading ?? 0} 16 16)`} d="M16 6 23 22 16 19 9 22Z" /></svg><span>{heading === null || heading === undefined ? 'Camera direction' : `Facing ${({0:'up',90:'right',180:'down',270:'left'})[heading]}`}</span></div><div className="report-map-directions" role="group" aria-label="Photo direction">{([{value:0,label:'Up',arrow:'↑'},{value:90,label:'Right',arrow:'→'},{value:180,label:'Down',arrow:'↓'},{value:270,label:'Left',arrow:'←'}] as const).map((direction) => <button key={direction.value} type="button" aria-pressed={heading === direction.value} onClick={() => onHeadingChange(direction.value)}><span aria-hidden="true">{direction.arrow}</span>{direction.label}</button>)}</div></>}
      <div className="map-zoom" aria-label="Map zoom">
        <button type="button" aria-label="Zoom in" disabled={zoom >= 6} onClick={() => setZoom((z) => Math.min(6, z + .5))}>+</button>
        <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - .5))}>−</button>
      </div>
    </div>
  );
};
