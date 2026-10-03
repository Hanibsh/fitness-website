import { createContext, useContext } from 'react'
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

// Hold-and-drag reordering, shared by every list the app lets you reorder
// (your splits, a split's days, a day's exercises, the logger, the dashboard
// cards). Grip-only by design: the rows are full of inputs and buttons, so a
// drag only ever starts from the ⋮⋮ handle.
//
//   mouse    — drag the grip; 4px of movement before it lifts, so a click on
//              it never nudges anything
//   touch    — hold the grip ~180ms, then drag. A swipe that starts on the
//              grip moves more than the tolerance first and scrolls instead
//   keyboard — focus the grip, Space to lift, arrows to move, Space to drop
//
// Vertical only, and the page auto-scrolls near its edges while dragging.
// Rows that move together (a superset) are ONE item: the caller renders the
// group inside a single <SortableItem> and puts a <DragHandle> on each member.

const verticalOnly = ({ transform }) => ({ ...transform, x: 0 })

// `ids` in display order; `onMove(from, to)` gets their indexes.
export function SortableList({ ids, onMove, children }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id)
    const to = ids.indexOf(over.id)
    if (from !== -1 && to !== -1) onMove(from, to)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

const HandleContext = createContext(null)

// One movable item. `as` picks the wrapper element (li inside a list); any
// other props (an onClick on a tappable row) pass through to it.
export function SortableItem({ id, as: Tag = 'div', className = '', children, ...rest }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <Tag
      {...rest}
      ref={setNodeRef}
      className={className}
      data-dragging={isDragging ? '' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? 20 : undefined }}
    >
      <HandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef, isDragging }}>{children}</HandleContext.Provider>
    </Tag>
  )
}

// The ⋮⋮ grip. Must sit inside a SortableItem.
export function DragHandle({ label, small = false, className = '' }) {
  const { attributes, listeners, setActivatorNodeRef, isDragging } = useContext(HandleContext)
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      title="Hold and drag to reorder"
      // Clicks on the grip must not reach a clickable row underneath (the
      // split list opens the split on click).
      onClick={(e) => e.stopPropagation()}
      // p-2 with -m-1: a ~30px target for a thumb on the same footprint as
      // the icon with p-1, so rows don't reflow around it.
      className={`shrink-0 inline-flex items-center justify-center bg-transparent border-none p-2 -m-1 ${
        isDragging ? 'cursor-grabbing text-text-primary' : 'cursor-grab text-text-light hover:text-text-primary'
      } ${className}`}
      // No long-press callout or text selection on iOS while holding the grip.
      style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      <GripVertical className={small ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    </button>
  )
}
