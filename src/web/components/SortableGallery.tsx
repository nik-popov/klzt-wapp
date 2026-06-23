import { useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import type { Item } from '@shared/types';
import { ItemCard } from './ItemCard';
import type { SortMode } from './ControlBar';

interface SortableGalleryProps {
  items: Item[];
  sortMode: SortMode;
  onReorder: (ids: string[]) => void;
  onProcess: (id: string) => void;
  onOpen: (item: Item) => void;
}

export function SortableGallery({
  items,
  sortMode,
  onReorder,
  onProcess,
  onOpen,
}: SortableGalleryProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Only "custom" mode is drag-sortable; other modes derive order from
  // data and disable dragging to avoid confusing UX.
  const displayed = useMemo(() => {
    if (sortMode === 'newest') {
      return [...items].sort((a, b) => b.created_at - a.created_at);
    }
    if (sortMode === 'status') {
      const rank: Record<Item['status'], number> = {
        raw: 0,
        processing: 1,
        ready: 2,
      };
      return [...items].sort(
        (a, b) => rank[a.status] - rank[b.status] || a.sort_order - b.sort_order,
      );
    }
    return [...items].sort((a, b) => a.sort_order - b.sort_order);
  }, [items, sortMode]);

  const ids = useMemo(() => displayed.map((it) => it.id), [displayed]);
  const sortable = sortMode === 'custom';

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const nextIds = arrayMove(ids, oldIndex, newIndex);
    onReorder(nextIds);
  }

  if (displayed.length === 0) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <div className="max-w-sm">
          <h2 className="text-base font-semibold text-neutral-700">
            Your closet is empty
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Tap <span className="font-medium">Upload</span> to add photos.
            Drag tiles to arrange them like the Photos app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {displayed.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onProcess={onProcess}
              onOpen={onOpen}
              sortable={sortable}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
