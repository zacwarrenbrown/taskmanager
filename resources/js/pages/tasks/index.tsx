import { Head, router, useForm } from '@inertiajs/react';
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

type Priority = 'first' | 'high' | 'low' | 'last';

type User = { id: number; name: string };

type Task = {
    id: number;
    title: string;
    completed: boolean;
    priority: Priority;
    sort_order: number;
    assigned_to: number | null;
    delegation_note: string | null;
    user: User;
    assignee: User | null;
};

const PRIORITIES: { key: Priority; label: string; color: string; border: string; badge: string }[] = [
    { key: 'first',  label: 'First',  color: 'bg-red-50 dark:bg-red-950/20',    border: 'border-red-300 dark:border-red-800',    badge: 'bg-red-500' },
    { key: 'high',   label: 'High',   color: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-300 dark:border-orange-800', badge: 'bg-orange-500' },
    { key: 'low',    label: 'Low',    color: 'bg-green-50 dark:bg-green-950/20',  border: 'border-green-300 dark:border-green-800',  badge: 'bg-green-500' },
    { key: 'last',   label: 'Last',   color: 'bg-blue-50 dark:bg-blue-950/20',   border: 'border-blue-300 dark:border-blue-800',   badge: 'bg-blue-500' },
];

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Tasks', href: '/tasks' }];

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={cn('flex flex-col gap-2 flex-1 rounded-lg transition-colors', isOver && 'ring-2 ring-inset ring-current opacity-80')}>
            {children}
        </div>
    );
}

function TaskCard({
    task,
    onDelegate,
    onDelete,
}: {
    task: Task;
    onDelegate: (task: Task) => void;
    onDelete: (task: Task) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const priority = PRIORITIES.find((p) => p.key === task.priority)!;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group flex items-start gap-2 rounded-lg border bg-card px-3 py-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onDelegate(task)}
        >
            <button
                {...attributes}
                {...listeners}
                className="mt-0.5 flex-shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
                aria-label="Drag to reorder"
            >
                <GripVertical className="size-4" />
            </button>

            <div className="flex-1 min-w-0">
                <p className={cn('text-sm', task.completed && 'line-through text-muted-foreground')}>{task.title}</p>
                <div className="mt-1 flex items-center gap-2">
                    <span className={cn('inline-block size-2 rounded-full flex-shrink-0', priority.badge)} />
                    <span className="text-xs text-muted-foreground truncate">
                        {task.assignee ? task.assignee.name : task.user.name}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(task); }}
                className="flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive mt-0.5"
                aria-label="Delete task"
            >
                <Trash2 className="size-3.5" />
            </button>
        </div>
    );
}

function DelegateModal({
    task,
    users,
    onClose,
}: {
    task: Task;
    users: User[];
    onClose: () => void;
}) {
    const { data, setData, patch, processing } = useForm({
        assigned_to: task.assigned_to ?? '',
        delegation_note: task.delegation_note ?? '',
        priority: task.priority,
    });

    function submit(e: React.SyntheticEvent) {
        e.preventDefault();
        patch(`/tasks/${task.id}`, { preserveScroll: true, onSuccess: onClose });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Task Details</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="size-5" />
                    </button>
                </div>

                <p className="mb-4 text-sm font-medium">{task.title}</p>

                <form onSubmit={submit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="priority">Priority</Label>
                        <select
                            id="priority"
                            value={data.priority}
                            onChange={(e) => setData('priority', e.target.value as Priority)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                            {PRIORITIES.map((p) => (
                                <option key={p.key} value={p.key}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="assigned_to">Assign to</Label>
                        <select
                            id="assigned_to"
                            value={data.assigned_to}
                            onChange={(e) => setData('assigned_to', e.target.value ? Number(e.target.value) : '')}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                            <option value="">Unassigned</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="note">Delegation note</Label>
                        <textarea
                            id="note"
                            value={data.delegation_note}
                            onChange={(e) => setData('delegation_note', e.target.value)}
                            placeholder="Add a note for the assignee…"
                            rows={3}
                            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={processing}>Save</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddTaskForm({ users, onAdd }: { users: User[]; onAdd: () => void }) {
    const { data, setData, post, processing, reset, errors } = useForm({
        title: '',
        priority: 'high' as Priority,
        assigned_to: '' as number | '',
    });

    function submit(e: React.SyntheticEvent) {
        e.preventDefault();
        post('/tasks', { preserveScroll: true, onSuccess: () => { reset(); onAdd(); } });
    }

    return (
        <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-48">
                <Input
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    placeholder="New task…"
                    autoComplete="off"
                />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
            </div>
            <select
                value={data.priority}
                onChange={(e) => setData('priority', e.target.value as Priority)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            >
                {PRIORITIES.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                ))}
            </select>
            <select
                value={data.assigned_to}
                onChange={(e) => setData('assigned_to', e.target.value ? Number(e.target.value) : '')}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            >
                <option value="">Assign to…</option>
                {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                ))}
            </select>
            <Button type="submit" disabled={processing || !data.title.trim()}>
                <Plus className="size-4" /> Add
            </Button>
        </form>
    );
}

export default function TasksIndex({ tasks: initialTasks, users }: { tasks: Task[]; users: User[] }) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);

    // Sync when Inertia reloads props (e.g. after add/delete)
    useEffect(() => {
        setTasks(initialTasks);
    }, [initialTasks]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [delegating, setDelegating] = useState<Task | null>(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as number);
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const dragged = tasks.find((t) => t.id === active.id);
        if (!dragged) return;

        // Dragged over a column droppable
        const overColumn = PRIORITIES.find((p) => p.key === over.id);
        if (overColumn && dragged.priority !== overColumn.key) {
            setTasks((prev) => prev.map((t) => t.id === active.id ? { ...t, priority: overColumn.key } : t));
            return;
        }

        // Dragged over another task — move to that task's column
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask && overTask.priority !== dragged.priority) {
            setTasks((prev) => prev.map((t) => t.id === active.id ? { ...t, priority: overTask.priority } : t));
        }
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeTask = tasks.find((t) => t.id === active.id);
        if (!activeTask) return;

        // Dropped on a column
        const overPriority = PRIORITIES.find((p) => p.key === over.id);
        if (overPriority) {
            const updated = tasks.map((t) => t.id === active.id ? { ...t, priority: overPriority.key } : t);
            setTasks(updated);
            saveOrder(updated);
            return;
        }

        // Dropped on another task
        const overTask = tasks.find((t) => t.id === over.id);
        if (!overTask) return;

        const newPriority = overTask.priority;
        const columnTasks = tasks.filter((t) => t.priority === newPriority);
        const activeIndex = columnTasks.findIndex((t) => t.id === active.id);
        const overIndex = columnTasks.findIndex((t) => t.id === over.id);

        let reordered = columnTasks;
        if (activeTask.priority === newPriority) {
            reordered = arrayMove(columnTasks, activeIndex, overIndex);
        } else {
            reordered = [...columnTasks.slice(0, overIndex), { ...activeTask, priority: newPriority }, ...columnTasks.slice(overIndex)];
        }

        const updated = [
            ...tasks.filter((t) => t.priority !== newPriority && t.id !== active.id),
            ...reordered,
        ];
        setTasks(updated);
        saveOrder(updated);
    }

    function saveOrder(updatedTasks: Task[]) {
        const items = updatedTasks.map((t) => ({
            id: t.id,
            priority: t.priority,
            order: updatedTasks.filter((x) => x.priority === t.priority).indexOf(t),
        }));

        router.post('/tasks/reorder', { items }, { preserveScroll: true });
    }

    function handleDelete(task: Task) {
        router.delete(`/tasks/${task.id}`, { preserveScroll: true });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tasks" />

            <div className="flex flex-col gap-6 p-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
                    <p className="text-sm text-muted-foreground">{tasks.filter((t) => !t.completed).length} remaining</p>
                </div>

                <AddTaskForm users={users} onAdd={() => {}} />

                {/* Kanban board */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {PRIORITIES.map((priority) => {
                            const columnTasks = tasks.filter((t) => t.priority === priority.key);
                            return (
                                <div
                                    key={priority.key}
                                    className={cn('flex flex-col gap-3 rounded-xl border-2 p-3 min-h-64', priority.color, priority.border)}
                                >
                                    {/* Column header */}
                                    <div className="flex items-center gap-2">
                                        <span className={cn('size-3 rounded-full', priority.badge)} />
                                        <span className="text-sm font-semibold">{priority.label}</span>
                                        <span className="ml-auto text-xs text-muted-foreground">{columnTasks.length}</span>
                                    </div>

                                    <SortableContext
                                        id={priority.key}
                                        items={columnTasks.map((t) => t.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <DroppableColumn id={priority.key}>
                                            {columnTasks.length === 0 && (
                                                <div className="flex-1 rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                                                    Drop tasks here
                                                </div>
                                            )}
                                            {columnTasks.map((task) => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    users={users}
                                                    onDelegate={setDelegating}
                                                    onDelete={handleDelete}
                                                />
                                            ))}
                                        </DroppableColumn>
                                    </SortableContext>
                                </div>
                            );
                        })}
                    </div>

                    <DragOverlay>
                        {activeTask && (
                            <div className="rounded-lg border bg-card px-3 py-2.5 shadow-xl opacity-90 text-sm font-medium">
                                {activeTask.title}
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </div>

            {delegating && (
                <DelegateModal
                    task={delegating}
                    users={users}
                    onClose={() => setDelegating(null)}
                />
            )}
        </AppLayout>
    );
}
