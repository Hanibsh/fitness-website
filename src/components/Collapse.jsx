// A fold: drop-in for `{open && <div>…</div>}`. Opening fades the content in
// and slides it down a touch (.fold-in in index.css); closing is instant.
//
// Its height deliberately isn't animated. A growing height re-lays out
// everything below it on every frame, which is what made folds stutter on a
// phone; this way the page moves once and only the content animates, on the
// GPU.
export default function Collapse({ open, id, children }) {
  if (!open) return null
  return (
    <div id={id} className="fold-in">
      {children}
    </div>
  )
}
