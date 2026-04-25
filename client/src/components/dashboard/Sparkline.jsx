export default function Sparkline({
  data = [],
  width = 96,
  height = 28,
  stroke = '#6366f1',
  fill = 'rgba(99,102,241,0.18)',
  strokeWidth = 1.6,
  className = '',
}) {
  const values = (Array.isArray(data) ? data : [])
    .map((v) => Number(v))
    .filter((v) => !Number.isNaN(v));

  if (values.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`block ${className}`}
        width={width}
        height={height}
        aria-hidden
      >
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="#e2e8f0"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? (width - 4) / (values.length - 1) : width - 4;

  const points = values.map((v, i) => {
    const x = 2 + i * stepX;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return [x, y];
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1][0].toFixed(
    2
  )} ${height - 2} L ${points[0][0].toFixed(2)} ${height - 2} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`block ${className}`}
      width={width}
      height={height}
      aria-hidden
    >
      <path d={areaPath} fill={fill} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={stroke} />
    </svg>
  );
}
