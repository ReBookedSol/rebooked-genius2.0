import React, { useMemo } from 'react';

interface GraphData {
  functions?: {
    id: string;
    label: string;
    type: 'linear' | 'quadratic' | 'hyperbola' | 'cubic' | 'exponential' | 'absolute' | 'sqrt';
    m?: number;
    c?: number;
    a?: number;
    b?: number;
    d?: number;
    h?: number;
    k?: number;
    base?: number;
    color: string;
  }[];
  points?: {
    id: string;
    x: number;
    y: number;
    label: string;
  }[];
  shapes?: {
    id: string;
    type: 'triangle' | 'rectangle' | 'polygon';
    vertices: { x: number; y: number }[];
    color: string;
  }[];
  config: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    step: number;
  };
}

interface GraphRendererProps {
  data: GraphData;
  width?: number;
  height?: number;
}

const GraphRenderer: React.FC<GraphRendererProps> = ({ data, width = 400, height = 400 }) => {
  const { xMin, xMax, yMin, yMax } = data.config;

  const toSvgX = (x: number) => ((x - xMin) / (xMax - xMin)) * width;
  const toSvgY = (y: number) => ((yMax - y) / (yMax - yMin)) * height;

  const gridLines = useMemo(() => {
    const lines = [];
    if (data.config.step <= 0) return lines;
    for (let x = xMin; x <= xMax; x += data.config.step) {
      const svgX = toSvgX(x);
      if (isNaN(svgX)) continue;
      lines.push(
        <line key={`x-${x}`} x1={svgX} y1={0} x2={svgX} y2={height} stroke="currentColor" strokeWidth="1" className="text-border" />
      );
    }
    for (let y = yMin; y <= yMax; y += data.config.step) {
      const svgY = toSvgY(y);
      if (isNaN(svgY)) continue;
      lines.push(
        <line key={`y-${y}`} x1={0} y1={svgY} x2={width} y2={svgY} stroke="currentColor" strokeWidth="1" className="text-border" />
      );
    }
    return lines;
  }, [xMin, xMax, yMin, yMax, data.config.step, width, height]);

  const axes = (
    <>
      <line x1={toSvgX(0)} y1={0} x2={toSvgX(0)} y2={height} stroke="currentColor" strokeWidth="2" className="text-foreground" />
      <line x1={0} y1={toSvgY(0)} x2={width} y2={toSvgY(0)} stroke="currentColor" strokeWidth="2" className="text-foreground" />
      {/* Ticks and Labels */}
      {data.config.step > 0 && Array.from({ length: Math.floor((xMax - xMin) / data.config.step) + 1 }, (_, i) => xMin + i * data.config.step).map(val => {
        const svgX = toSvgX(val);
        const svgY = toSvgY(0);
        if (isNaN(svgX) || isNaN(svgY) || val === 0) return null;
        return (
          <g key={`xtick-${val}`}>
            <line x1={svgX} y1={svgY - 5} x2={svgX} y2={svgY + 5} stroke="currentColor" />
            <text x={svgX} y={svgY + 15} fontSize="10" textAnchor="middle" fill="currentColor">{val}</text>
          </g>
        );
      })}
      {data.config.step > 0 && Array.from({ length: Math.floor((yMax - yMin) / data.config.step) + 1 }, (_, i) => yMin + i * data.config.step).map(val => {
        const svgX = toSvgX(0);
        const svgY = toSvgY(val);
        if (isNaN(svgX) || isNaN(svgY) || val === 0) return null;
        return (
          <g key={`ytick-${val}`}>
            <line x1={svgX - 5} y1={svgY} x2={svgX + 5} y2={svgY} stroke="currentColor" />
            <text x={svgX - 10} y={svgY + 4} fontSize="10" textAnchor="end" fill="currentColor">{val}</text>
          </g>
        );
      })}
    </>
  );

  const renderFunction = (fn: NonNullable<GraphData['functions']>[0]) => {
    const points = [];
    const resolution = 100;
    const step = (xMax - xMin) / resolution;

    for (let x = xMin; x <= xMax; x += step) {
      let y = 0;
      switch (fn.type) {
        case 'linear':
          y = (fn.m || 0) * x + (fn.c || 0);
          break;
        case 'quadratic':
          y = (fn.a || 0) * Math.pow(x, 2) + (fn.b || 0) * x + (fn.c || 0);
          break;
        case 'hyperbola':
          y = (fn.a || 0) / (x - (fn.h || 0)) + (fn.k || 0);
          break;
        case 'cubic':
          y = (fn.a || 0) * Math.pow(x, 3) + (fn.b || 0) * Math.pow(x, 2) + (fn.c || 0) * x + (fn.d || 0);
          break;
        case 'exponential':
          y = (fn.a || 0) * Math.pow(fn.base || 2, x) + (fn.c || 0);
          break;
        case 'absolute':
          y = (fn.a || 0) * Math.abs(x - (fn.h || 0)) + (fn.k || 0);
          break;
        case 'sqrt':
          if (x - (fn.h || 0) >= 0) {
            y = (fn.a || 0) * Math.sqrt(x - (fn.h || 0)) + (fn.k || 0);
          } else {
            continue;
          }
          break;
      }

      if (y >= yMin - 10 && y <= yMax + 10) {
        points.push(`${toSvgX(x)},${toSvgY(y)}`);
      } else if (points.length > 0) {
        // Break the polyline if it goes out of bounds
        points.push("M");
      }
    }

    const paths = points.join(" ").split(" M ").map((p, i) => (
      <polyline key={`${fn.id}-${i}`} points={p} fill="none" stroke={fn.color} strokeWidth="2" />
    ));
    
    return <g key={fn.id}>{paths}</g>;
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="border border-border bg-background rounded-lg shadow-sm w-full max-w-full" style={{ maxHeight: height }}>
        {gridLines}
        {axes}
        {data.functions?.map(renderFunction)}
        {data.shapes?.map(shape => (
          <polygon
            key={shape.id}
            points={shape.vertices.map(v => `${toSvgX(v.x)},${toSvgY(v.y)}`).join(' ')}
            fill={shape.color}
            fillOpacity="0.3"
            stroke={shape.color}
            strokeWidth="2"
          />
        ))}
        {data.points?.map(point => (
          <g key={point.id}>
            <circle cx={toSvgX(point.x)} cy={toSvgY(point.y)} r="4" fill="red" />
            <text x={toSvgX(point.x) + 5} y={toSvgY(point.y) - 5} fontSize="12" fontWeight="bold">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default GraphRenderer;
