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
import { CalendarDays, CheckCircle2, GripVertical, Link2, Lock, Plus, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
    deadline: string | null;
    prerequisite_task_id: number | null;
    user: User;
    assignee: User | null;
    prerequisite: { id: number; title: string; completed: boolean } | null;
};

const PRIORITIES: { key: Priority; label: string; color: string; border: string; badge: string; ring: string }[] = [
    { key: 'first', label: 'First',  color: 'bg-red-50 dark:bg-red-950/20',       border: 'border-red-300 dark:border-red-800',       badge: 'bg-red-500',    ring: 'ring-red-400' },
    { key: 'high',  label: 'High',   color: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-300 dark:border-orange-800', badge: 'bg-orange-500', ring: 'ring-orange-400' },
    { key: 'low',   label: 'Low',    color: 'bg-green-50 dark:bg-green-950/20',   border: 'border-green-300 dark:border-green-800',   badge: 'bg-green-500',  ring: 'ring-green-400' },
    { key: 'last',  label: 'Last',   color: 'bg-blue-50 dark:bg-blue-950/20',     border: 'border-blue-300 dark:border-blue-800',     badge: 'bg-blue-500',   ring: 'ring-blue-400' },
];

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Tasks', href: '/tasks' }];

// ─── Context menu ────────────────────────────────────────────────────────────

type ContextMenuState = { task: Task; x: number; y: number } | null;

function ContextMenu({
    menu,
    onClose,
    onComplete,
    onDelegate,
    onDelete,
}: {
    menu: ContextMenuState;
    onClose: () => void;
    onComplete: (task: Task) => void;
    onDelegate: (task: Task) => void;
    onDelete: (task: Task) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    if (!menu) return null;

    const isLocked = menu.task.prerequisite && !menu.task.prerequisite.completed;

    return (
        <div
            ref={ref}
            style={{ top: menu.y, left: menu.x }}
            className="fixed z-50 min-w-44 rounded-lg border bg-popover py-1 shadow-lg text-sm"
        >
            <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent disabled:opacity-40"
                disabled={!!isLocked}
                onClick={() => { onComplete(menu.task); onClose(); }}
            >
                <CheckCircle2 className="size-4" />
                {menu.task.completed ? 'Mark incomplete' : 'Mark complete'}
            </button>
            <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent"
                onClick={() => { onDelegate(menu.task); onClose(); }}
            >
                <UserRound className="size-4" />
                Delegate / edit
            </button>
            <div className="my-1 border-t" />
            <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-destructive"
                onClick={() => { onDelete(menu.task); onClose(); }}
            >
                <Trash2 className="size-4" />
                Delete
            </button>
        </div>
    );
}

// ─── Task card ───────────────────────────────────────────────────────────────

function TaskCard({
    task,
    onContextMenu,
}: {
    task: Task;
    onContextMenu: (task: Task, e: React.MouseEvent) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        disabled: !!(task.prerequisite && !task.prerequisite.completed),
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const priority = PRIORITIES.find((p) => p.key === task.priority)!;
    const isLocked = task.prerequisite && !task.prerequisite.completed;
    const isOverdue = task.deadline && !task.completed && new Date(task.deadline) < new Date();

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group relative flex items-start gap-2 rounded-lg border bg-card px-3 py-2.5 shadow-sm select-none',
                isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow',
            )}
            {...(!isLocked ? { ...attributes, ...listeners } : {})}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(task, e); }}
        >
            {isLocked && (
                <Lock className="mt-0.5 size-3.5 flex-shrink-0 text-muted-foreground" />
            )}
            {!isLocked && (
                <GripVertical className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}

            <div className="flex-1 min-w-0">
                <p className={cn('text-sm', task.completed && 'line-through text-muted-foreground')}>{task.title}</p>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cn('inline-block size-2 rounded-full flex-shrink-0', priority.badge)} />
                    <span className="text-xs text-muted-foreground truncate">
                        {task.assignee ? task.assignee.name : task.user.name}
                    </span>
                    {task.deadline && (
                        <span className={cn('flex items-center gap-0.5 text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                            <CalendarDays className="size-3" />
                            {new Date(task.deadline).toLocaleDateString('en-GB')}
                        </span>
                    )}
                    {task.prerequisite && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground" title={`Requires: ${task.prerequisite.title}`}>
                            <Link2 className="size-3" />
                            {task.prerequisite.completed ? 'Unblocked' : 'Blocked'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Droppable column ────────────────────────────────────────────────────────

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
    return (
        <div ref={setNodeRef} className={cn('flex flex-col gap-2 flex-1 rounded-lg p-0.5 transition-all', isOver && 'ring-2 ring-inset ring-primary/40 bg-primary/5')}>
            {children}
        </div>
    );
}

// ─── Task modal ───────────────────────────────────────────────────────────────

function TaskModal({
    task,
    users,
    allTasks,
    onClose,
}: {
    task: Task;
    users: User[];
    allTasks: Task[];
    onClose: () => void;
}) {
    const { data, setData, patch, processing } = useForm({
        assigned_to:          task.assigned_to ?? ('' as number | ''),
        delegation_note:      task.delegation_note ?? '',
        priority:             task.priority,
        deadline:             task.deadline ?? '',
        prerequisite_task_id: task.prerequisite_task_id ?? ('' as number | ''),
    });

    function submit(e: React.SyntheticEvent) {
        e.preventDefault();
        patch(`/tasks/${task.id}`, { preserveScroll: true, onSuccess: onClose });
    }

    const otherTasks = allTasks.filter((t) => t.id !== task.id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Edit Task</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
                </div>

                <p className="mb-4 text-sm font-medium">{task.title}</p>

                <form onSubmit={submit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
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
                            <Label htmlFor="deadline">Deadline</Label>
                            <input
                                id="deadline"
                                type="date"
                                value={data.deadline}
                                onChange={(e) => setData('deadline', e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            />
                        </div>
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
                        <Label htmlFor="prereq">Must complete first (sequence)</Label>
                        <select
                            id="prereq"
                            value={data.prerequisite_task_id}
                            onChange={(e) => setData('prerequisite_task_id', e.target.value ? Number(e.target.value) : '')}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                            <option value="">None</option>
                            {otherTasks.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                        {data.prerequisite_task_id && (
                            <p className="text-xs text-muted-foreground">This task will be locked until the selected task is completed.</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="note">Delegation note</Label>
                        <textarea
                            id="note"
                            value={data.delegation_note}
                            onChange={(e) => setData('delegation_note', e.target.value)}
                            placeholder="Add a note for the assignee…"
                            rows={2}
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

// ─── Add task form ────────────────────────────────────────────────────────────

function AddTaskForm({ users }: { users: User[] }) {
    const { data, setData, post, processing, reset, errors } = useForm({
        title:       '',
        priority:    'high' as Priority,
        assigned_to: '' as number | '',
    });

    function submit(e: React.SyntheticEvent) {
        e.preventDefault();
        post('/tasks', { preserveScroll: true, onSuccess: () => reset() });
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TasksIndex({ tasks: initialTasks, users }: { tasks: Task[]; users: User[] }) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [editing, setEditing] = useState<Task | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

    useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

    function handleContextMenu(task: Task, e: React.MouseEvent) {
        setContextMenu({ task, x: e.clientX, y: e.clientY });
    }

    function handleComplete(task: Task) {
        router.patch(`/tasks/${task.id}`, { completed: !task.completed }, { preserveScroll: true });
    }

    function handleDelete(task: Task) {
        router.delete(`/tasks/${task.id}`, { preserveScroll: true });
    }

    function handleDragStart(event: DragStartEvent) {
        setContextMenu(null);
        setActiveId(event.active.id as number);
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const dragged = tasks.find((t) => t.id === active.id);
        if (!dragged) return;

        // Over a column droppable
        const overColKey = PRIORITIES.find((p) => `col-${p.key}` === over.id);
        if (overColKey && dragged.priority !== overColKey.key) {
            setTasks((prev) => prev.map((t) => t.id === active.id ? { ...t, priority: overColKey.key } : t));
            return;
        }

        // Over another task
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask && overTask.priority !== dragged.priority) {
            setTasks((prev) => prev.map((t) => t.id === active.id ? { ...t, priority: overTask.priority } : t));
        }
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const dragged = tasks.find((t) => t.id === active.id);
        if (!dragged) return;

        // Dropped on a column
        const overColKey = PRIORITIES.find((p) => `col-${p.key}` === over.id);
        if (overColKey) {
            const updated = tasks.map((t) => t.id === active.id ? { ...t, priority: overColKey.key } : t);
            setTasks(updated);
            saveOrder(updated);
            return;
        }

        // Dropped on a task
        const overTask = tasks.find((t) => t.id === over.id);
        if (!overTask) return;

        const col = overTask.priority;
        const colTasks = tasks.filter((t) => t.priority === col);
        const fromIndex = colTasks.findIndex((t) => t.id === active.id);
        const toIndex = colTasks.findIndex((t) => t.id === over.id);

        let reordered: Task[];
        if (dragged.priority === col) {
            reordered = arrayMove(colTasks, fromIndex, toIndex);
        } else {
            reordered = [
                ...colTasks.slice(0, toIndex),
                { ...dragged, priority: col },
                ...colTasks.slice(toIndex),
            ];
        }

        const updated = [
            ...tasks.filter((t) => t.priority !== col && t.id !== active.id),
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tasks" />

            <div className="flex flex-col gap-6 p-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
                    <p className="text-sm text-muted-foreground">{tasks.filter((t) => !t.completed).length} remaining · Right-click a task for options</p>
                </div>

                <AddTaskForm users={users} />

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {PRIORITIES.map((priority) => {
                            const colTasks = tasks.filter((t) => t.priority === priority.key);
                            return (
                                <div
                                    key={priority.key}
                                    className={cn('flex flex-col gap-3 rounded-xl border-2 p-3 min-h-64', priority.color, priority.border)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={cn('size-3 rounded-full', priority.badge)} />
                                        <span className="text-sm font-semibold">{priority.label}</span>
                                        <span className="ml-auto text-xs text-muted-foreground">{colTasks.length}</span>
                                    </div>

                                    <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                                        <DroppableColumn id={priority.key}>
                                            {colTasks.length === 0 && (
                                                <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                                                    Drop tasks here
                                                </div>
                                            )}
                                            {colTasks.map((task) => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    onContextMenu={handleContextMenu}
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
                            <div className="rounded-lg border bg-card px-3 py-2.5 shadow-xl text-sm font-medium rotate-1">
                                {activeTask.title}
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </div>

            <ContextMenu
                menu={contextMenu}
                onClose={() => setContextMenu(null)}
                onComplete={handleComplete}
                onDelegate={(task) => setEditing(task)}
                onDelete={handleDelete}
            />

            {editing && (
                <TaskModal
                    task={editing}
                    users={users}
                    allTasks={tasks}
                    onClose={() => setEditing(null)}
                />
            )}
        </AppLayout>
    );
}
