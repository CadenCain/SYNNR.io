/**
 * A pump-down plug and perf string, surface end on the left, drawn as a line
 * schematic: cable head, CCL, weight bar, three guns, firing head, setting
 * tool, and the plug. On a phone it scrolls sideways rather than shrinking
 * until the labels can't be read.
 */

const Y = 78; // the string's centerline
const stroke = "#b4b7bd";
const dim = "#5f636b";
const fill = "#111316";

/** One section of the string: a body centered on the line, with rounded shoulders. */
function Body({ x, w, r, rx = 4 }: { x: number; w: number; r: number; rx?: number }) {
  return <rect x={x} y={Y - r} width={w} height={r * 2} rx={rx} fill={fill} stroke={stroke} strokeWidth={1.25} />;
}

/** A label under the string (or over it), with a leader line to the part it names. */
function Label({ x, r, text, span, above }: { x: number; r: number; text: string; span?: [number, number]; above?: boolean }) {
  if (above) {
    return (
      <g>
        <line x1={x} y1={Y - r - 8} x2={x} y2={Y - 46} stroke={dim} strokeWidth={1} />
        <text x={x} y={Y - 54} textAnchor="middle" fill="#c9ccd1" fontSize={15}>{text}</text>
      </g>
    );
  }
  const top = Y + r + 8;
  return (
    <g>
      {span ? <path d={`M${span[0]} ${top} V${top + 8} H${span[1]} V${top}`} fill="none" stroke={dim} strokeWidth={1} /> : null}
      <line x1={x} y1={span ? top + 8 : top} x2={x} y2={Y + 58} stroke={dim} strokeWidth={1} />
      <text x={x} y={Y + 78} textAnchor="middle" fill="#c9ccd1" fontSize={15}>{text}</text>
    </g>
  );
}

function Gun({ x }: { x: number }) {
  return (
    <g>
      <Body x={x} w={158} r={17} />
      {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={x + 22 + i * 23} cy={Y} r={3.25} fill="none" stroke={dim} strokeWidth={1.25} />)}
    </g>
  );
}

export default function Toolstring() {
  return (
    <div className="overflow-x-auto pb-1">
      <svg viewBox="0 0 1200 176" role="img" className="h-auto w-full min-w-[940px]"
        aria-label="A pump-down plug and perf tool string from the surface end down: cable head, CCL, weight bar, three perforating guns, firing head, setting tool, and frac plug.">
        {/* the line coming down from the truck */}
        <line x1={0} y1={Y} x2={72} y2={Y} stroke={stroke} strokeWidth={2} />
        <text x={0} y={Y - 22} fill="#8b8f97" fontSize={14}>To the truck</text>
        <text x={1200} y={Y - 40} textAnchor="end" fill="#8b8f97" fontSize={14}>Downhole</text>

        {/* cable head: slim fishing neck stepping up to the body */}
        <path d={`M72 ${Y - 5} H96 V${Y - 9} H108 L122 ${Y - 17} H150 V${Y + 17} H122 L108 ${Y + 9} H96 V${Y + 5} H72 Z`} fill={fill} stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" />
        <Body x={154} w={92} r={17} />
        <line x1={184} y1={Y - 17} x2={184} y2={Y + 17} stroke={dim} strokeWidth={1} />
        <line x1={216} y1={Y - 17} x2={216} y2={Y + 17} stroke={dim} strokeWidth={1} />
        <Body x={250} w={166} r={17} />

        {/* three guns with a tandem sub between each */}
        <Gun x={424} />
        <Body x={582} w={10} r={13} rx={1} />
        <Gun x={592} />
        <Body x={750} w={10} r={13} rx={1} />
        <Gun x={760} />

        <Body x={922} w={46} r={14} />
        <Body x={972} w={104} r={21} />
        {/* setting sleeve and the plug on the end of it */}
        <Body x={1080} w={34} r={24} rx={2} />
        <path d={`M1118 ${Y - 24} H1162 Q1186 ${Y - 24} 1186 ${Y} Q1186 ${Y + 24} 1162 ${Y + 24} H1118 Z`} fill={fill} stroke="#ff5a1f" strokeWidth={1.5} />
        {[1132, 1144, 1156].map((x) => <line key={x} x1={x} y1={Y - 24} x2={x - 8} y2={Y + 24} stroke="#ff5a1f" strokeOpacity={0.6} strokeWidth={1.25} />)}

        <Label x={123} r={17} text="Cable head" />
        <Label x={200} r={17} text="CCL" />
        <Label x={333} r={17} text="Weight bar" />
        <Label x={671} r={17} text="Guns" span={[503, 839]} />
        <Label x={945} r={14} text="Firing head" above />
        <Label x={1024} r={21} text="Setting tool" />
        <Label x={1140} r={24} text="Plug" />
      </svg>
    </div>
  );
}
