// The house panel: white on cream, one hairline border, no shadow and no radius.
//
// Lifted here after a third identical copy appeared. Dashboard, the calendar and
// the injuries page each had their own byte-for-byte duplicate of this, which is
// fine right up until someone changes the padding in one of them.
export default function Card({ children, className = '' }) {
  return <div className={`bg-white border border-border p-5 sm:p-6 ${className}`}>{children}</div>
}
