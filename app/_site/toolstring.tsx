/**
 * A packer setting string, surface end on the left, drawn as a line
 * schematic: cable head, CCL, weight bars, firing head, setting tool, adapter
 * kit, and the packer. On a phone it scrolls sideways rather than shrinking
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

export default function Toolstring() {
  return (
    <div className="overflow-x-auto pb-1">
      <svg viewBox="0 0 1200 176" role="img" className="h-auto w-full min-w-[940px]"
        aria-label="A packer setting tool string from the surface end down: cable head, CCL, two weight bars, firing head, setting tool, adapter kit, and the packer.">
        {/* the line coming down from the truck */}
        <line x1={0} y1={Y} x2={72} y2={Y} stroke={stroke} strokeWidth={2} />
        <text x={0} y={Y - 22} fill="#8b8f97" fontSize={14}>To the truck</text>
        <text x={1200} y={Y - 54} textAnchor="end" fill="#8b8f97" fontSize={14}>Downhole</text>

        {/* cable head: slim fishing neck stepping up to the body */}
        <path d={`M72 ${Y - 5} H96 V${Y - 9} H108 L122 ${Y - 17} H150 V${Y + 17} H122 L108 ${Y + 9} H96 V${Y + 5} H72 Z`} fill={fill} stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" />
        <Body x={154} w={92} r={17} />
        <line x1={184} y1={Y - 17} x2={184} y2={Y + 17} stroke={dim} strokeWidth={1} />
        <line x1={216} y1={Y - 17} x2={216} y2={Y + 17} stroke={dim} strokeWidth={1} />
        <Body x={250} w={220} r={17} />

        <Body x={476} w={220} r={17} />

        <Body x={704} w={56} r={14} />
        <Body x={766} w={194} r={21} />
        <Body x={966} w={64} r={24} rx={2} />
        {/* the packer: slips at each end, the element between them */}
        <path d={`M1036 ${Y - 24} H1162 Q1186 ${Y - 24} 1186 ${Y} Q1186 ${Y + 24} 1162 ${Y + 24} H1036 Z`} fill={fill} stroke="#ff5a1f" strokeWidth={1.5} />
        {[1050, 1060, 1070, 1140, 1150, 1160].map((x) => <line key={x} x1={x} y1={Y - 24} x2={x - 8} y2={Y + 24} stroke="#ff5a1f" strokeOpacity={0.6} strokeWidth={1.25} />)}
        <rect x={1082} y={Y - 24} width={40} height={48} fill="#ff5a1f" fillOpacity={0.12} stroke="#ff5a1f" strokeOpacity={0.6} strokeWidth={1} />

        <Label x={123} r={17} text="Cable head" />
        <Label x={200} r={17} text="CCL" />
        <Label x={473} r={17} text="Weight bars" span={[360, 586]} />
        <Label x={732} r={14} text="Firing head" above />
        <Label x={863} r={21} text="Setting tool" />
        <Label x={998} r={24} text="Adapter kit" above />
        <Label x={1111} r={24} text="Packer" />
      </svg>
    </div>
  );
}
